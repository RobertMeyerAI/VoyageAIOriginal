
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore } from 'firebase-admin/firestore';

let adminDb: Firestore | null = null;

function initializeFirebaseAdmin() {
    if (getApps().length > 0 && adminDb) {
        return;
    }
    try {
        if (getApps().length === 0) {
            initializeApp();
        }
        adminDb = getAdminFirestore();
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error instanceof Error ? error.message : String(error));
        adminDb = null;
    }
}

initializeFirebaseAdmin();

export { adminDb };
