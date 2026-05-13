import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc, query, where } from "firebase/firestore";

config({ path: ".env.local" });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

const snap = await getDocs(query(collection(db, "menu"), where("category", "==", "Dessert")));

if (snap.empty) {
  console.log('No docs with category "Dessert" found.');
  process.exit(0);
}

const batch = writeBatch(db);
snap.docs.forEach(d => batch.update(doc(db, "menu", d.id), { category: "Desserts" }));
await batch.commit();
console.log(`✓ Updated ${snap.size} items: "Dessert" → "Desserts"`);
process.exit(0);
