import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrx0Sxs0yoJHUahGB59ojOEulPfNd57_Y",
  authDomain: "acc-app-e5316.firebaseapp.com",
  projectId: "acc-app-e5316",
  storageBucket: "acc-app-e5316.firebasestorage.app",
  messagingSenderId: "447193481869",
  appId: "acc-app-e5316",
  measurementId: "G-PLY7P9M3F8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

export { db, auth, messaging }; 