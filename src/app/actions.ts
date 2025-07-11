
'use server';

import { adminDb } from '@/services/firestore-admin';
import { getEmails, markEmailAsRead } from '@/services/gmail';
import { extractTravelSegments, type ExtractTravelSegmentsOutput } from '@/ai/flows/extract-travel-segments';
import { groupSegmentsIntoTrips, type GroupSegmentsIntoTripsInput, type GroupSegmentsIntoTripsOutput } from '@/ai/flows/group-segments-into-trips';
import { getDBSettingsForUser, getTripsForUser, type Trip } from '@/services/firestore';
import { randomBytes } from 'crypto';
import { addPoiRecommendations, type AddPoiRecommendationsInput, type AddPoiRecommendationsOutput } from '@/ai/flows/add-poi-recommendations';


export type ScanResult = {
  type: 'idle' | 'success' | 'error';
  trips: GroupSegmentsIntoTripsOutput;
  message?: string | null;
  logs?: string[];
};

type EmailToProcess = {
    id: string;
    body: string | null;
    imageAttachments: { filename: string; mimeType: string; dataUri: string; }[];
};

type EmailProcessingOutcome = {
    emailId: string;
    status: string;
    error?: string;
    segments: any[];
};

async function processInChunks<T, U>(
  items: T[],
  processor: (item: T) => Promise<U>,
  chunkSize: number,
  log: (message: string) => void
): Promise<U[]> {
  const allResults: U[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    log(`Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(items.length / chunkSize)}...`);
    const chunkPromises = chunk.map(processor);
    const chunkResults = await Promise.allSettled(chunkPromises);
    chunkResults.forEach(result => {
        if (result.status === 'fulfilled') {
            allResults.push(result.value);
        } else {
            const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
            log(`  - ERROR in chunk processing: ${errorMessage}`);
        }
    });
  }
  return allResults;
}


export async function handleSync(userEmail: string): Promise<ScanResult> {
    const logs: string[] = [];
    const log = (message: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    const CHUNK_SIZE = 5;
    
    try {
        if (!adminDb) {
            throw new Error('Firebase Admin SDK could not be initialized. Check server logs for details.');
        }
        
        const userRef = adminDb.collection('users').doc(userEmail);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({ createdAt: new Date().toISOString() });
            log(`Created new user document for ${userEmail}`);
        }
        
        const settings = await getDBSettingsForUser(userEmail);

        log('Starting inbox scan for new travel emails...');
        let allEmails;
        try {
            allEmails = await getEmails();
            log(`Found ${allEmails.length} potential email(s) in the central inbox.`);
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : String(error);
             if (errorMessage.startsWith('GMAIL_AUTH_ERROR')) {
                log(`FATAL: Gmail authentication failed. ${errorMessage}`);
                return { 
                    type: 'error', 
                    trips: [], 
                    message: `Gmail connection failed. Your refresh token seems to be invalid or expired. Please re-authenticate the application to generate a new token.`, 
                    logs 
                };
             }
             throw error; // Re-throw other errors
        }
        
        
        const processedEmailsCollection = userRef.collection('processed_emails');
        const processedSnapshot = await processedEmailsCollection.get();
        const processedEmailIds = new Set(processedSnapshot.docs.map(d => d.id));
        
        const emailsToProcess = allEmails.filter(email => !processedEmailIds.has(email.id));
        log(`Identified ${emailsToProcess.length} new, un-processed email(s) for this user.`);

        if (emailsToProcess.length === 0) {
            log('No new emails to process for this user. Sync complete.');
            const finalTrips = await getTripsForUser(userEmail);
            return { type: 'success', trips: finalTrips, message: 'No new emails found. Your trips are up to date.', logs };
        }

        const emailProcessor = async (email: EmailToProcess): Promise<EmailProcessingOutcome> => {
            try {
                if (!email.body && email.imageAttachments.length === 0) {
                    return { emailId: email.id, status: 'skipped_no_content', segments: [] };
                }
                const extractedSegments = await extractTravelSegments({ 
                    emailText: email.body || '',
                    imageAttachments: email.imageAttachments,
                });
                if (extractedSegments.length > 0) {
                    log(`  - Found ${extractedSegments.length} segment(s) in email ${email.id.slice(0, 10)}...`);
                }
                return { emailId: email.id, status: 'processed_success', segments: extractedSegments };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                log(`  - ERROR processing email ${email.id}: ${errorMessage}`);
                return { emailId: email.id, status: 'processed_error', error: errorMessage, segments: [] };
            }
        };
        
        const processingOutcomes = await processInChunks(emailsToProcess, emailProcessor, CHUNK_SIZE, log);
        
        const rawEmailBatch = adminDb.batch();
        emailsToProcess.forEach(email => {
            const rawEmailRef = userRef.collection('raw_emails').doc(email.id);
            rawEmailBatch.set(rawEmailRef, { ...email, receivedAt: new Date().toISOString() });
        });
        await rawEmailBatch.commit();
        log(`Stored ${emailsToProcess.length} raw email(s) in Firestore for user.`);


        const newSegments = processingOutcomes.flatMap(result => {
            return (result.segments as ExtractTravelSegmentsOutput).map(s => {
                const { travelerName, details, ...restOfSegment } = s;
                const { confirmationNumber, boardingPassDataUri, ...restOfDetails } = details;
                return {
                    ...restOfSegment,
                    id: randomBytes(8).toString('hex'), // Add unique ID for segment
                    isArchived: false,
                    emailId: result.emailId,
                    tripId: undefined, 
                    details: {
                        ...restOfDetails,
                        confirmations: [{
                            number: confirmationNumber,
                            travelerName: travelerName,
                            boardingPassDataUri: boardingPassDataUri,
                        }],
                    }
                };
            });
        });

        if (emailsToProcess.length > 0) {
            log(newSegments.length > 0 ? `Found ${newSegments.length} new segments.` : 'No new travel segments found in any scanned emails.');
        }

        const markAsProcessedBatch = adminDb.batch();
        emailsToProcess.forEach(email => {
            const outcome = processingOutcomes.find(o => o.emailId === email.id);
            if (outcome) {
                markAsProcessedBatch.set(processedEmailsCollection.doc(email.id), { 
                    processedAt: new Date().toISOString(), 
                    status: outcome.status,
                    foundSegments: outcome.segments.length > 0,
                });
            }
        });
        if (emailsToProcess.length > 0) {
            await markAsProcessedBatch.commit();
            log(`Marked ${emailsToProcess.length} emails as processed in user's subcollection.`);
        }
        
        log(newSegments.length > 0 ? `Fetching existing trips for user ${userEmail} for analysis.` : 'No new segments found. Checking existing trips...');
        const existingTrips = await getTripsForUser(userEmail); 
        
        const allSegments: GroupSegmentsIntoTripsInput['segments'] = [
            ...newSegments,
            ...existingTrips.flatMap(trip => 
                trip.segments.map(seg => ({ ...seg, id: seg.id || randomBytes(8).toString('hex'), tripId: trip.id }))
            )
        ];
        
        let comprehensiveTrips: GroupSegmentsIntoTripsOutput;
        if (allSegments.length > 0) {
            log(`Sending ${allSegments.length} total segments (${newSegments.length} new) to AI for grouping.`);
            comprehensiveTrips = await groupSegmentsIntoTrips({
                segments: allSegments,
                lodgingGapHours: settings.alerts.lodgingGapHours,
                checkInLeadTimeHours: settings.alerts.checkInLeadTimeHours,
                currentDate: new Date().toISOString(),
            });
            log(`AI grouping complete. Resulted in ${comprehensiveTrips.length} final trip(s).`);
        } else {
            comprehensiveTrips = existingTrips;
            log('No segments to process. No changes to trips.');
        }

        const comprehensiveTripIds = new Set(comprehensiveTrips.map(t => t.id));
        const dbBatch = adminDb.batch();
        const tripsCollection = userRef.collection('trips');

        for (const trip of comprehensiveTrips) {
            const finalTrip = {
                ...trip,
                isArchived: trip.isArchived || false,
                segments: trip.segments.map(s => ({...s, id: s.id || randomBytes(8).toString('hex'), isArchived: s.isArchived || false}))
            }
            dbBatch.set(tripsCollection.doc(trip.id), finalTrip);
        }

        const existingTripIds = new Set(existingTrips.map(t => t.id));
        let archivedCount = 0;
        existingTripIds.forEach(id => {
            if (!comprehensiveTripIds.has(id)) {
                dbBatch.update(tripsCollection.doc(id), { isArchived: true, archivedAt: new Date().toISOString() });
                archivedCount++;
            }
        });
        if (archivedCount > 0) {
            log(`Archiving ${archivedCount} trip(s) that were merged or are no longer valid.`);
        }

        await dbBatch.commit();
        log('Database synchronized with trip data.');

        const emailsToMarkAsRead = processingOutcomes
            .filter(o => o.status === 'processed_success' && o.segments.length > 0)
            .map(o => o.emailId);
        
        if (emailsToMarkAsRead.length > 0) {
            await Promise.all(emailsToMarkAsRead.map(id => markEmailAsRead(id)));
            log(`Marked ${emailsToMarkAsRead.length} email(s) as read in central Gmail inbox.`);
        }
        
        let message = `Sync complete. Processed ${comprehensiveTrips.length} total trip(s).`;
        if (newSegments.length > 0) {
            message = `Sync complete. Found ${newSegments.length} new segments, resulting in ${comprehensiveTrips.length} trip(s).`;
        }

        log('Sync complete.');
        const finalTrips = await getTripsForUser(userEmail);
        return { type: 'success', trips: finalTrips, message, logs };

    } catch (error) {
        console.error("Error during sync:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`FATAL ERROR: ${errorMessage}`);
        return { type: 'error', trips: [], message: errorMessage, logs };
    }
}

export async function getPoiRecommendations(input: AddPoiRecommendationsInput): Promise<AddPoiRecommendationsOutput> {
    try {
        const recommendations = await addPoiRecommendations(input);
        return recommendations;
    } catch (error) {
        console.error("Error getting POI recommendations:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to get AI recommendations.";
        throw new Error(errorMessage);
    }
}
