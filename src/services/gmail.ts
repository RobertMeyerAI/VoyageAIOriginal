
'use server';

import type { gmail_v1 } from 'googleapis';

const getGmailClient = async () => {
    const { google } = await import('googleapis');
    
    const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
    const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
    const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
        throw new Error('GMAIL_CREDENTIALS_MISSING: Please ensure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN are set in your .env file.');
    }
    
    const oAuth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET
    );

    oAuth2Client.setCredentials({
      refresh_token: GMAIL_REFRESH_TOKEN,
    });

    return google.gmail({ version: 'v1', auth: oAuth2Client });
}

export type EmailAttachment = {
    filename: string;
    mimeType: string;
    dataUri: string;
};

export type EmailData = {
    id: string;
    snippet: string;
    body: string;
    imageAttachments: EmailAttachment[];
};


async function extractParts(
    gmail: gmail_v1.Gmail,
    messageId: string,
    payload: gmail_v1.Schema$MessagePart,
): Promise<{ body: string; imageAttachments: EmailAttachment[] }> {
    let body = '';
    const imageAttachments: EmailAttachment[] = [];
    const partsToProcess = payload.parts ? [...payload.parts] : [];

    if (!payload.parts && payload.mimeType === 'text/plain' && payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    while (partsToProcess.length > 0) {
        const part = partsToProcess.shift();
        if (!part) continue;

        const mimeType = part.mimeType || '';
        const filename = part.filename || '';
        
        if (mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n\n';
        } else if (mimeType.startsWith('image/') && filename && part.body?.attachmentId) {
            try {
                const attachment = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId: messageId,
                    id: part.body.attachmentId,
                });
                if (attachment.data.data) {
                    const dataUri = `data:${mimeType};base64,${attachment.data.data}`;
                    imageAttachments.push({ filename, mimeType, dataUri });
                }
            } catch (error) {
                console.error(`Failed to fetch attachment ${part.body.attachmentId} for message ${messageId}`, error);
            }
        } else if (mimeType.startsWith('multipart/')) {
            if (part.parts) {
                partsToProcess.push(...part.parts);
            }
        }
    }
    return { body, imageAttachments };
}


export async function getEmails(): Promise<EmailData[]> {
    try {
        const gmail = await getGmailClient();
        
        const travelQuery = 'is:unread subject:("your reservation" OR "your booking" OR "your flight" OR "e-ticket" OR "itinerary" OR "confirmation")';
        
        const listRes = await gmail.users.messages.list({
            userId: 'me',
            q: travelQuery,
            maxResults: 25,
        });

        const messages = listRes.data.messages;
        if (!messages || messages.length === 0) {
            return [];
        }

        const emailPromises = messages.map(async (msg) => {
            if (!msg.id) return null;
            
            try {
              const messageRes = await gmail.users.messages.get({
                  userId: 'me',
                  id: msg.id,
                  format: 'full',
              });

              const payload = messageRes.data.payload;
              if (!payload) return null;

              const { body, imageAttachments } = await extractParts(gmail, msg.id, payload);
              if (!body && imageAttachments.length === 0) return null;

              const snippet = messageRes.data.snippet || '';
              return { id: msg.id, snippet, body, imageAttachments };
            } catch (error) {
              console.error(`Failed to fetch email ${msg.id}`, error);
              return null;
            }
        });

        const emails = await Promise.all(emailPromises);
        return emails.filter((email): email is EmailData => email !== null);
    } catch (error: any) {
        let errorMessage = 'An unknown error occurred while communicating with the Gmail API.';
        if (error.response?.data?.error) {
            const errType = error.response.data.error;
            if (errType === 'invalid_grant' || (error.response.status === 500 && error.response.data.error_description?.includes('token'))) {
                errorMessage = 'GMAIL_AUTH_ERROR: Could not refresh access token. The Gmail refresh token is likely expired or has been revoked. Please re-authenticate the application to generate a new token.';
            } else {
                 errorMessage = errType;
                if (error.response.data.error_description) {
                    errorMessage += `: ${error.response.data.error_description}`;
                }
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
}

export async function markEmailAsRead(messageId: string): Promise<void> {
    try {
        const gmail = await getGmailClient();
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: ['UNREAD'],
            },
        });
    } catch(error) {
        console.error(`Failed to mark email ${messageId} as read`, error);
    }
}
