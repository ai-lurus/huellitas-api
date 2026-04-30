import admin from 'firebase-admin';
import { env } from './env';

let initialized = false;

export function initFirebase(): boolean {
  if (initialized) return true;
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return false;
  }

  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  initialized = true;
  return true;
}

export function messaging(): admin.messaging.Messaging {
  return admin.messaging();
}
