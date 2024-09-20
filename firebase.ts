// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
// const analytics = getAnalytics(firebaseApp);

import { getFirestore, collection, query, where, getDocs, addDoc } from "firebase/firestore";

export const db = getFirestore(firebaseApp);

interface Reservation {
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
}

export async function saveReservation(reservation: Reservation) {
  try {
    const docRef = await addDoc(collection(db, "reservations"), reservation);
    console.log("Reservation saved with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding reservation: ", e);
    throw e;
  }
}
