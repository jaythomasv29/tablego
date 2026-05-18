/**
 * One-time seed script to populate inventory vendors and items from supplier sheets.
 *
 * Usage: node scripts/seed-inventory.mjs
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

// Location name constants (must match what's stored in inventoryLocations)
const LOC_WALKIN   = 'Walk-in Fridge';
const LOC_REACHIN  = 'Reach-in Fridge';
const LOC_DRY      = 'Dry Storage';
const LOC_UPSTAIRS = 'Upstairs';

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

// ─── Locations ───────────────────────────────────────────────────────────────

const LOCATIONS = [
    { name: LOC_WALKIN,   sortOrder: 0 },
    { name: LOC_REACHIN,  sortOrder: 1 },
    { name: LOC_DRY,      sortOrder: 2 },
    { name: LOC_UPSTAIRS, sortOrder: 3 },
];

// ─── Vendors ─────────────────────────────────────────────────────────────────

const VENDORS = [
    { name: 'Ocean Paradise', phone: '415-486-3538' },
    { name: 'Bestt Impex',    phone: '408-718-9127' },
    { name: 'SJ Distributor', phone: '408-915-5318' },
];

// ─── Items per vendor ─────────────────────────────────────────────────────────
// Format: [name, category, location]

const OCEAN_PARADISE_ITEMS = [
    ['Basil (4 lbs.)',                    'Produce',               LOC_WALKIN],
    ['Bean Sprout 5lbs/bag',              'Produce',               LOC_WALKIN],
    ['Broccoli (case)',                   'Produce',               LOC_WALKIN],
    ['Carrot 25lbs bag',                  'Produce',               LOC_WALKIN],
    ['Celery (Bunch)',                    'Produce',               LOC_WALKIN],
    ['Cherry Tomato (3x Small pack)',     'Produce',               LOC_REACHIN],
    ['Chinese EggPlant (1/2 case)',       'Produce',               LOC_WALKIN],
    ['Chow Fun for Pad See Ew',          'Noodles & Rice',        LOC_DRY],
    ['Chow Mien Yellow Noodle (box)',     'Noodles & Rice',        LOC_DRY],
    ['Cilantro (bunch)',                  'Produce',               LOC_WALKIN],
    ['Eggs medium/large',                'Produce',               LOC_REACHIN],
    ['Eggroll Wrap Skin Wei Chuen Brand','Pantry & Dry Goods',    LOC_DRY],
    ['Egg Roll VEGGIE/PORK',             'Frozen',                LOC_WALKIN],
    ['Fresh Young Coconut (9pcs/cs)',    'Produce',               LOC_WALKIN],
    ['Green Bean 10 lbs',                'Produce',               LOC_WALKIN],
    ['Green Bell Pepper (5lbs)',         'Produce',               LOC_WALKIN],
    ['Green Bok Choy Shanghai (5 lbs.)', 'Produce',               LOC_WALKIN],
    ['Green Cabbage (4 Pcs.)',           'Produce',               LOC_WALKIN],
    ['Green Onion (case)',               'Produce',               LOC_WALKIN],
    ['Green Papaya (4-pieces)',          'Produce',               LOC_WALKIN],
    ['Jalapeno (5lbs.)',                 'Produce',               LOC_WALKIN],
    ['Lemongrass 5 lbs.',               'Produce',               LOC_WALKIN],
    ['Lettuce',                         'Produce',               LOC_WALKIN],
    ['Mint Leaf (5-bunch)',              'Produce',               LOC_WALKIN],
];

const BESTT_IMPEX_ITEMS = [
    ['Bamboo Strips',                    'Packaging & Supplies',  LOC_DRY],
    ['Black Soy Sauce DSB brand',        'Sauces & Condiments',   LOC_DRY],
    ['Brown Rice',                       'Noodles & Rice',        LOC_DRY],
    ['Bun Thap Chua',                    'Noodles & Rice',        LOC_DRY],
    ['Cashew Nut 5 lbs bag',            'Pantry & Dry Goods',    LOC_DRY],
    ['Coconut Milk',                     'Pantry & Dry Goods',    LOC_DRY],
    ['Curry Powder',                     'Pantry & Dry Goods',    LOC_DRY],
    ['Fish Sauce Lucky brand',           'Sauces & Condiments',   LOC_DRY],
    ['Galanga Frozen',                   'Frozen',                LOC_WALKIN],
    ['Green Curry Mae Sri',              'Pantry & Dry Goods',    LOC_DRY],
    ['Maggie Sauce GMT brand',           'Sauces & Condiments',   LOC_DRY],
    ['Panang Curry Mae',                 'Pantry & Dry Goods',    LOC_DRY],
    ['Peanut',                           'Pantry & Dry Goods',    LOC_DRY],
    ['Peprika Powder',                   'Pantry & Dry Goods',    LOC_DRY],
    ['Pineapple Chuck',                  'Pantry & Dry Goods',    LOC_DRY],
    ['Plastic Compartment 6x6',          'Packaging & Supplies',  LOC_DRY],
    ['Plastic Compartment 8x2',          'Packaging & Supplies',  LOC_DRY],
    ['Red Curry Mae Ploy',               'Pantry & Dry Goods',    LOC_DRY],
    ['Rice Paper Round',                 'Pantry & Dry Goods',    LOC_DRY],
    ['ROTI Frozen',                      'Frozen',                LOC_WALKIN],
    ['Singha Beer Big & Small bottle',   'Beverages',             LOC_REACHIN],
    ['Sriracha Shark brand',             'Sauces & Condiments',   LOC_DRY],
    ['Sugar Palm',                       'Pantry & Dry Goods',    LOC_DRY],
    ['Sweet Sticky Rice 50 lbs',         'Noodles & Rice',        LOC_UPSTAIRS],
    ['Togo Box #16',                     'Packaging & Supplies',  LOC_DRY],
    ['Togo Box #32',                     'Packaging & Supplies',  LOC_DRY],
    ['Water Chestnut',                   'Pantry & Dry Goods',    LOC_DRY],
    ['Wet Tamarind',                     'Pantry & Dry Goods',    LOC_DRY],
    ['White Rice 50 lbs',                'Noodles & Rice',        LOC_UPSTAIRS],
    ['White Vinegar',                    'Sauces & Condiments',   LOC_DRY],
    ['Woonsen',                          'Noodles & Rice',        LOC_DRY],
    ['Yellow Curry Mae',                 'Pantry & Dry Goods',    LOC_DRY],
];

const SJ_DISTRIBUTOR_ITEMS = [
    ['Basa Fish Fillet',                 'Protein & Seafood',     LOC_WALKIN],
    ['BEEF TriTip Peeled',               'Protein & Seafood',     LOC_WALKIN],
    ['Black 7in Round Container',        'Packaging & Supplies',  LOC_DRY],
    ['Black Pepper Powder 5lbs bag',     'Pantry & Dry Goods',    LOC_DRY],
    ['Calamari Squid Tube U5',           'Protein & Seafood',     LOC_WALKIN],
    ['Chicken Breast Fresh',             'Protein & Seafood',     LOC_WALKIN],
    ['Chicken Breast Frozen',            'Protein & Seafood',     LOC_WALKIN],
    ['Chicken Thigh Meat BBQ',           'Protein & Seafood',     LOC_WALKIN],
    ['Cooking Oil',                      'Pantry & Dry Goods',    LOC_DRY],
    ['Crab Meat 5lbs (2xBox)',           'Protein & Seafood',     LOC_WALKIN],
    ['Hoisin Sauce Koon Chun Brand',     'Sauces & Condiments',   LOC_DRY],
    ['Lamb Leg Boneless',                'Protein & Seafood',     LOC_WALKIN],
    ['Mussel Large size (case)',         'Protein & Seafood',     LOC_WALKIN],
    ['Oyster Sauce Panda Brand',         'Sauces & Condiments',   LOC_DRY],
    ['Pho Noodle Fresh (4bag)',          'Noodles & Rice',        LOC_WALKIN],
    ['Plastic Soup Cup 16oz',            'Packaging & Supplies',  LOC_DRY],
    ['Plastic Soup Cup 32oz',            'Packaging & Supplies',  LOC_DRY],
    ['Plastic Soup Cup 8oz',             'Packaging & Supplies',  LOC_DRY],
    ['Pork Loin Boneless',               'Protein & Seafood',     LOC_WALKIN],
    ['Pot Sticker Pork Wei Chuen Brand', 'Frozen',                LOC_WALKIN],
    ['Roast Duck (1 case)',              'Protein & Seafood',     LOC_WALKIN],
    ['Round Black Container 24oz',       'Packaging & Supplies',  LOC_DRY],
    ['Round Black Container 16oz',       'Packaging & Supplies',  LOC_DRY],
    ['Salmon Fillet No Skin',            'Protein & Seafood',     LOC_WALKIN],
    ['Scallop (2 box)',                  'Protein & Seafood',     LOC_WALKIN],
    ['Shrimp 16/20 p&d',                 'Protein & Seafood',     LOC_WALKIN],
    ['Soy Sauce Kikoman 5 gallon',       'Sauces & Condiments',   LOC_DRY],
    ['Sugar 50 lbs',                     'Pantry & Dry Goods',    LOC_UPSTAIRS],
    ['Wooden Chop Sticks',               'Packaging & Supplies',  LOC_DRY],
];

const ITEMS_BY_VENDOR = [
    OCEAN_PARADISE_ITEMS,
    BESTT_IMPEX_ITEMS,
    SJ_DISTRIBUTOR_ITEMS,
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
    console.log('🔍 Checking for existing data...');

    const existingVendors = await getDocs(collection(db, 'inventoryVendors'));
    if (existingVendors.size > 0) {
        console.log(`⚠️  Found ${existingVendors.size} existing vendor(s). Skipping seed to avoid duplicates.`);
        console.log('   Delete the inventoryVendors and inventoryItems collections first if you want to re-seed.');
        process.exit(0);
    }

    console.log('\n📍 Seeding locations...');
    for (const loc of LOCATIONS) {
        await addDoc(collection(db, 'inventoryLocations'), loc);
        console.log(`   ✅ ${loc.name}`);
    }

    console.log('\n📦 Seeding vendors...');
    const vendorIds = [];
    for (const vendor of VENDORS) {
        const ref = await addDoc(collection(db, 'inventoryVendors'), vendor);
        vendorIds.push(ref.id);
        console.log(`   ✅ ${vendor.name} (${vendor.phone})`);
    }

    console.log('\n🥬 Seeding inventory items...');
    let totalItems = 0;
    for (let i = 0; i < VENDORS.length; i++) {
        const vendorId = vendorIds[i];
        const vendorName = VENDORS[i].name;
        const items = ITEMS_BY_VENDOR[i];
        for (const [name, category, location] of items) {
            await addDoc(collection(db, 'inventoryItems'), {
                name,
                category,
                vendorId,
                vendorName,
                location,
                status: 'ok',
                lastCheckedAt: null,
                lastOrderedAt: null,
            });
            totalItems++;
        }
        console.log(`   ✅ ${vendorName}: ${items.length} items`);
    }

    console.log(`\n🎉 Done! Seeded ${LOCATIONS.length} locations, ${VENDORS.length} vendors, and ${totalItems} items.`);
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
