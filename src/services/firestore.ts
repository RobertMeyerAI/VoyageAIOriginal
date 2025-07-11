
'use server';

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, where, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { defaultSettings, type AppSettings } from '@/lib/settings-types';
import type { GroupSegmentsIntoTripsOutput } from '@/ai/flows/group-segments-into-trips';

// --- Types ---
export type Alert = GroupSegmentsIntoTripsOutput[number]['alerts'][number];
export type Segment = GroupSegmentsIntoTripsOutput[number]['segments'][number] & {
    id: string; 
    isArchived?: boolean;
};

export type Trip = Omit<GroupSegmentsIntoTripsOutput[number], 'segments'> & {
    id: string;
    isArchived?: boolean;
    archivedAt?: string;
    icon?: string;
    segments: Segment[];
    dismissedAlertIds?: string[];
};

// --- Helper for Timestamp conversion ---
const processDoc = (doc: any) => {
    const data = doc.data();
    if (!data) return null;
    if (data.archivedAt && data.archivedAt instanceof Timestamp) {
        data.archivedAt = data.archivedAt.toDate().toISOString();
    }
    return { ...data, id: doc.id } as Trip;
};


// --- Trips ---

export async function getTripsForUser(userEmail: string): Promise<Trip[]> {
    if (!db) return [];
    
    const tripsCollection = collection(db, 'users', userEmail, 'trips');
    const q = query(tripsCollection, where("isArchived", "!=", true));
    
    try {
        const snapshot = await getDocs(q);
        const trips = snapshot.docs.map(processDoc).filter((trip): trip is Trip => !!trip);
        trips.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        return trips;
    } catch (e) {
        console.warn("Could not fetch trips, might be a new user or permissions issue:", e);
        return [];
    }
}

export async function getTripForUser(userEmail: string, id: string): Promise<Trip | null> {
    if (!db) return null;
    const tripDocRef = doc(db, 'users', userEmail, 'trips', id);
    const docSnap = await getDoc(tripDocRef);
    if (docSnap.exists()) {
        const trip = processDoc(docSnap);
        if (trip?.isArchived) return null;
        return trip;
    }
    return null;
}

export async function archiveTrip(userEmail: string, id: string) {
    if (!db) return;
    await updateDoc(doc(db, 'users', userEmail, 'trips', id), { isArchived: true, archivedAt: Timestamp.now() });
}

export async function restoreTrip(userEmail: string, id: string) {
    if (!db) return;
    await updateDoc(doc(db, 'users', userEmail, 'trips', id), { isArchived: false, archivedAt: null });
}

export async function archiveSegment(userEmail: string, tripId: string, segmentId: string) {
    if (!db) return;
    const tripDocRef = doc(db, 'users', userEmail, 'trips', tripId);
    const docSnap = await getDoc(tripDocRef);
    if (!docSnap.exists()) return;
    const trip = docSnap.data() as Trip;

    const newSegments = trip.segments.map(s => {
        if (s.id === segmentId) {
            return { ...s, isArchived: true };
        }
        return s;
    });

    await updateDoc(tripDocRef, { segments: newSegments });
}

export async function restoreSegment(userEmail: string, tripId: string, segmentId: string) {
    if (!db) return;
    const tripDocRef = doc(db, 'users', userEmail, 'trips', tripId);
    const tripDoc = await getDoc(tripDocRef);
    if (!tripDoc.exists()) return;
    const trip = tripDoc.data() as Trip;

    const newSegments = trip.segments.map(s => {
        if (s.id === segmentId) {
            return { ...s, isArchived: false };
        }
        return s;
    });

    await updateDoc(tripDocRef, { segments: newSegments });
}

export async function dismissAlert(userEmail: string, tripId: string, alertId: string) {
    if (!db) return;
    const tripDocRef = doc(db, 'users', userEmail, 'trips', tripId);
    await updateDoc(tripDocRef, {
        dismissedAlertIds: arrayUnion(alertId)
    });
}

export async function getArchivedTripsForUser(userEmail: string): Promise<Trip[]> {
    if (!db) return [];
    const tripsCollection = collection(db, 'users', userEmail, 'trips');
    const q = query(tripsCollection);
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    const tripsWithArchives = snapshot.docs
        .map(processDoc)
        .filter((trip): trip is Trip => !!trip && (trip.isArchived || trip.segments.some(s => s.isArchived)));

    return tripsWithArchives;
}


export async function deleteTrip(userEmail: string, id: string) {
    if (!db) return;
    await deleteDoc(doc(db, 'users', userEmail, 'trips', id));
}

export async function updateTrip(userEmail: string, id: string, data: Partial<Omit<Trip, 'id'>>) {
    if (!db) return;
    const dataToUpdate: { [key: string]: any } = { ...data };
    if (dataToUpdate.archivedAt && typeof dataToUpdate.archivedAt === 'string') {
        dataToUpdate.archivedAt = Timestamp.fromDate(new Date(dataToUpdate.archivedAt));
    }
    await updateDoc(doc(db, 'users', userEmail, 'trips', id), dataToUpdate);
}


// --- Settings ---

export async function getDBSettingsForUser(userEmail: string): Promise<AppSettings> {
    if (db) {
        const settingsDocRef = doc(db, 'users', userEmail, 'settings', 'user_default');
        const settingsDoc = await getDoc(settingsDocRef);
        if (settingsDoc.exists()) {
            const dbData = settingsDoc.data();
             return {
                ...defaultSettings,
                ...dbData,
                alerts: { ...defaultSettings.alerts, ...dbData.alerts },
                appearance: {
                    ...defaultSettings.appearance,
                    ...dbData.appearance,
                    colors: { ...defaultSettings.appearance.colors, ...dbData.appearance?.colors },
                },
                data: { ...defaultSettings.data, ...dbData.data },
                profile: { ...defaultSettings.profile, ...dbData.profile },
            };
        }
    }
    return defaultSettings;
}

export async function saveDBSettingsForUser(userEmail: string, settings: AppSettings) {
    if (!db) return;
    const settingsDocRef = doc(db, 'users', userEmail, 'settings', 'user_default');
    await setDoc(settingsDocRef, settings, { merge: true });
}
