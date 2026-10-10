import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';

function serverApp() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase project is not configured');
  if (process.env.TABLEGO_ENVIRONMENT === 'staging' && projectId !== 'tablego-staging-1d712') {
    throw new Error('Staging cannot access the live Firebase project');
  }
  const name = `tablego-server-${projectId}`;
  const existing = getApps().find(app => app.name === name);
  if (existing) return existing;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS ? readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8') : null);
  if (credentials) {
    const key = JSON.parse(credentials);
    if (key.project_id !== projectId) throw new Error('Server credentials must belong to the configured project');
    return initializeApp({ credential: cert(key), projectId }, name);
  }
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

export const getServerDatabase = () => getFirestore(serverApp());
export const getServerAuth = () => getAuth(serverApp());
