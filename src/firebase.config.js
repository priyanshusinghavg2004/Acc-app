import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import browserSupport from './utils/browserSupport';

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

// Conditionally initialize messaging only if browser supports it
let messaging = null;

// Use an async function to handle dynamic imports
const initializeMessaging = async () => {
  try {
    // Check if the browser supports the required APIs for Firebase messaging
    if (browserSupport.hasFirebaseMessaging()) {
      const { getMessaging } = await import('firebase/messaging');
      messaging = getMessaging(app);
      console.log('Firebase messaging initialized successfully');
    } else {
      console.log('Firebase messaging not supported in this browser');
      browserSupport.logSupportInfo();
    }
  } catch (error) {
    console.log('Firebase messaging initialization failed:', error.message);
    browserSupport.logSupportInfo();
  }
};

// Initialize messaging
initializeMessaging();

export { db, auth, messaging, app }; 