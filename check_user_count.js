const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Your Firebase configuration
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

async function getUserCount() {
  try {
    console.log('🔍 Checking user count in Firestore...');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const totalUsers = snapshot.size;
    console.log(`\n📊 Total Users: ${totalUsers}`);
    
    if (totalUsers > 0) {
      console.log('\n📋 User Details:');
      snapshot.forEach((doc) => {
        const userData = doc.data();
        console.log(`- User ID: ${doc.id}`);
        console.log(`  Email: ${userData.email || 'N/A'}`);
        console.log(`  Company: ${userData.companyName || userData.firmName || 'N/A'}`);
        console.log(`  Status: ${userData.status || 'N/A'}`);
        console.log(`  Created: ${userData.createdAt ? userData.createdAt.toDate().toLocaleString() : 'N/A'}`);
        console.log('---');
      });
    }
    
    return totalUsers;
  } catch (error) {
    console.error('❌ Error getting user count:', error);
    return 0;
  }
}

// Run the function
getUserCount().then(() => {
  console.log('\n✅ User count check completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 