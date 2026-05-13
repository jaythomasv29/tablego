import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, writeBatch, doc } from "firebase/firestore";

config({ path: ".env.local" });

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

const desserts = [
  {
    name: "Fried Banana & Ice Cream",
    price: 9.50,
    category: "Dessert",
    description: "Banana fried in a crispy roll drizzled with honey and served with homemade coconut ice cream",
    imageUrl: "",
  },
  {
    name: "Sweet Sticky Rice Fresh Mango",
    price: 9.00,
    category: "Dessert",
    description: "A Thai delicacy of savory sweet sticky rice, coconut milk, and thinly sliced mangos",
    imageUrl: "",
  },
  {
    name: "Sweet Sticky Rice Mango Combo",
    price: 10.00,
    category: "Dessert",
    description: "Savory sweet sticky rice topped with coconut milk, thinly sliced mango and your choice of ice cream",
    imageUrl: "",
  },
  {
    name: "Sweet Sticky Rice Pumpkin Custard",
    price: 9.00,
    category: "Dessert",
    description: "Sweet sticky rice and coconut milk with pumpkin custard",
    imageUrl: "",
  },
  {
    name: "Tapioca Pudding & Coconut Milk",
    price: 5.50,
    category: "Dessert",
    description: "Savory and sweet pandan tapioca that is paired with our homemade coconut milk sauce",
    imageUrl: "",
  },
  {
    name: "Tapioca Pudding & Fresh Mango",
    price: 6.50,
    category: "Dessert",
    description: "Savory and sweet pandan tapioca that is paired with our homemade coconut milk sauce and topped with mangos",
    imageUrl: "",
  },
  {
    name: "Roti with Condensed Milk",
    price: 5.50,
    category: "Dessert",
    description: "Lightly baked flaky roti bread drizzled with condensed milk and sprinkled with sugar",
    imageUrl: "",
  },
  {
    name: "Ice Cream Scoops (2)",
    price: 6.50,
    category: "Dessert",
    description: "Two scoops of ice cream. Choose: Coconut, Green tea, Vanilla, Mango, Thai tea",
    imageUrl: "",
  },
];

async function seed() {
  const batch = writeBatch(db);

  desserts.forEach((item) => {
    const ref = doc(collection(db, "menu"));
    batch.set(ref, item);
  });

  await batch.commit();
  console.log(`✓ Added ${desserts.length} dessert items to /menu`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
