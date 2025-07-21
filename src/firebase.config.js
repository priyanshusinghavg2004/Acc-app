import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrx0Sxs0yoJHUahGB59ojOEulPfNd57_Y",
  authDomain: "acc-app-e5316.firebaseapp.com",
  projectId: "acc-app-e5316",
  storageBucket: "acc-app-e5316.firebasestorage.app",
  messagingSenderId: "447193481869",
  appId: "1:447193481869:web:6bdc560f454c2f894e98c4",
  measurementId: "G-PLY7P9M3F8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth }; 