/**
 * One-time migration: updates inventoryItems that have old-style location keys
 * ('walk-in', 'reach-in', 'dry-storage', 'upstairs') to the new full names,
 * and seeds the inventoryLocations collection if it doesn't exist yet.
 *
 * Usage: node scripts/migrate-inventory-locations.mjs
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';

config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const KEY_TO_NAME = {
    'walk-in':     'Walk-in Fridge',
    'reach-in':    'Reach-in Fridge',
    'dry-storage': 'Dry Storage',
    'upstairs':    'Upstairs',
};

const LOCATIONS = [
    { name: 'Walk-in Fridge',  sortOrder: 0 },
    { name: 'Reach-in Fridge', sortOrder: 1 },
    { name: 'Dry Storage',     sortOrder: 2 },
    { name: 'Upstairs',        sortOrder: 3 },
];

async function migrate() {
    // 1. Seed inventoryLocations if empty
    console.log('📍 Checking inventoryLocations...');
    const locSnap = await getDocs(collection(db, 'inventoryLocations'));
    if (locSnap.size === 0) {
        for (const loc of LOCATIONS) {
            await addDoc(collection(db, 'inventoryLocations'), loc);
            console.log(`   ✅ Added location: ${loc.name}`);
        }
    } else {
        console.log(`   Found ${locSnap.size} existing locations — skipping seed.`);
    }

    // 2. Migrate items with old-style location keys
    console.log('\n🔄 Migrating inventory items...');
    const itemsSnap = await getDocs(collection(db, 'inventoryItems'));
    const toMigrate = itemsSnap.docs.filter(d => KEY_TO_NAME[d.data().location]);

    if (toMigrate.length === 0) {
        console.log('   Nothing to migrate — all items already use full location names.');
        process.exit(0);
    }

    const batch = writeBatch(db);
    for (const d of toMigrate) {
        const oldKey = d.data().location;
        const newName = KEY_TO_NAME[oldKey];
        batch.update(doc(db, 'inventoryItems', d.id), { location: newName });
        console.log(`   ${d.data().name}: "${oldKey}" → "${newName}"`);
    }
    await batch.commit();

    console.log(`\n🎉 Migrated ${toMigrate.length} item(s).`);
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
