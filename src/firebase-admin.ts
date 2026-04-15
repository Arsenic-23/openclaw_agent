import admin from 'firebase-admin';
import { CONFIG } from './config.js';

let _db: admin.firestore.Firestore | null = null;
let _initialized = false;

export function initFirebase(): void {
  if (_initialized) return;

  if (!CONFIG.firebase.projectId || !CONFIG.firebase.privateKey || !CONFIG.firebase.clientEmail) {
    console.warn('⚠️  Firebase Admin credentials not configured — running in MOCK mode (Check .env)');
    console.warn('   Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL');
    _initialized = true;
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: CONFIG.firebase.projectId,
      privateKey: CONFIG.firebase.privateKey,
      clientEmail: CONFIG.firebase.clientEmail,
    }),
  });

  _initialized = true;
  console.log('✅ Firebase Admin initialized');
}

export function getDb(): admin.firestore.Firestore {
  if (!_db) {
    if (!CONFIG.firebase.projectId) {
      throw new Error('Firebase not configured. Set FIREBASE_ADMIN_* env vars.');
    }
    _db = admin.firestore();
  }
  return _db;
}

export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

export { admin };
