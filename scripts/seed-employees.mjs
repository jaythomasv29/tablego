/**
 * One-time seed script to add employees to the Firebase `employees` collection.
 * Each employee is added with role: "unassigned" so the admin can assign their
 * role (Front of House, Kitchen, or Both) later in the Team View.
 *
 * Usage:  node scripts/seed-employees.mjs
 */

import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";

// Load .env.local
config({ path: ".env.local" });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const employeeNames = [
    "Wisit Vongampai",
    "Hong Hanh Tong",
    "Chutima Vongampai",
    "Nualpong Ketviboon",
    "Nam Dang",
    "Pornphimol Taiwijit",
    "Nathan Kalayanamitr",
    "Liya Dias",
    "Oumsub Guamsub",
    "Ever Monroy-Lopes",
    "Chatphinya Khetphutsa",
    "Santos Hernandez",
    "Nutthee Dissayajaroenpong",
    "Sulma Perez-Sanchez",
    "Manuel Perez",
    "Carlos Perez",
    "Yuvarin Dissayajaroenpong",
    "Maya Amangell",
    "Karla Fabela",
    "Wilder Perez-Sanchez",
    "Ruddy Diaz",
];

async function seed() {
    console.log("🔍 Checking for existing employees...");

    // Fetch existing employees to avoid duplicates
    const existingSnap = await getDocs(collection(db, "employees"));
    const existingNames = new Set(existingSnap.docs.map((d) => d.data().name));

    console.log(`   Found ${existingNames.size} existing employee(s).`);

    let added = 0;
    let skipped = 0;

    for (const name of employeeNames) {
        if (existingNames.has(name)) {
            console.log(`   ⏭  Skipping "${name}" (already exists)`);
            skipped++;
            continue;
        }

        await addDoc(collection(db, "employees"), {
            name,
            role: "unassigned",
        });
        console.log(`   ✅ Added "${name}"`);
        added++;
    }

    console.log(`\n🎉 Done! Added ${added} employee(s), skipped ${skipped}.`);
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
