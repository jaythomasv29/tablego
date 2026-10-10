import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const env = dotenv.parse(await readFile('.env.staging.local'));
const key = JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS));
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'tablego-staging-1d712' || key.project_id !== 'tablego-staging-1d712') throw new Error('Staging fixtures only');
const db = getFirestore(initializeApp({ projectId: key.project_id, credential: cert(key) }, `service-fixtures-${randomUUID()}`));
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const base = { name: 'Synthetic Service Guest', email: 'service@example.invalid', phone: '+16505550100', guests: 2, time: '7:00 PM', date, status: 'pending', comments: '', createdAt: new Date(), isTest: true, schemaVersion: 2, version: 1, notificationRevision: 1, phoneVerified: false, smsOptIn: false, noteVersion: 0 };
const fixtures = [
  [`staging-service-pending-${date}`, { guests: 6, comments: 'Peanut allergy. A quiet table would help.' }],
  [`staging-service-arrival-${date}`, { status: 'confirmed', time: '5:00 PM' }],
  ['staging-service-history-completed', { status: 'completed', date: '2026-09-10' }],
  ['staging-service-history-no-show', { status: 'no-show', date: '2026-09-11' }],
  ['staging-service-shared-contact', { name: 'Synthetic Other Guest', email: 'other@example.invalid', date: '2026-11-01' }],
  [`staging-service-legacy-date-${date}`, { date: new Date(`${date}T20:00:00Z`), time: '1:00 PM', status: 'confirmed' }],
  ['staging-service-review', { date: '2026-02-30', status: 'cancelled' }],
];
let created = 0;
for (const [id, changes] of fixtures) {
  const ref = db.doc(`reservations/${id}`);
  if (!(await ref.get()).exists) { await ref.create({ ...base, ...changes }); created++; }
}
console.log(`Prepared ${created} new synthetic service fixtures in the isolated staging project. Existing test history preserved.`);
process.exit(0);
