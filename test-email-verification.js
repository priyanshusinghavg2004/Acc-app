// Email Verification Test Script
// Run this in browser console to test email verification flow

const testEmailVerification = async () => {
  console.log('🧪 Starting Email Verification Test...');
  
  try {
    // Test 1: Check if Firebase is properly initialized
    console.log('1️⃣ Checking Firebase initialization...');
    if (!window.firebase && !window.auth) {
      console.error('❌ Firebase not initialized properly');
      return;
    }
    console.log('✅ Firebase initialized');
    
    // Test 2: Check current user
    console.log('2️⃣ Checking current user...');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('ℹ️ No user logged in. Please login first.');
      return;
    }
    console.log('✅ User found:', currentUser.email);
    console.log('📧 Email verified:', currentUser.emailVerified);
    
    // Test 3: Send verification email
    console.log('3️⃣ Sending verification email...');
    const emailResult = await sendVerificationEmail(currentUser);
    console.log('📧 Email result:', emailResult);
    
    if (emailResult.success) {
      console.log('✅ Verification email sent successfully');
      console.log('📋 Check your email inbox and spam folder');
      console.log('🔗 Look for email from: noreply@acc-app-e5316.firebaseapp.com');
    } else {
      console.error('❌ Failed to send verification email:', emailResult.message);
    }
    
    // Test 4: Check verification status
    console.log('4️⃣ Checking verification status...');
    const isVerified = await checkEmailVerification(currentUser);
    console.log('📧 Verification status:', isVerified);
    
    // Test 5: Update user status
    if (isVerified) {
      console.log('5️⃣ Updating user verification status...');
      const statusResult = await updateUserEmailVerificationStatus(currentUser.uid, true);
      console.log('📊 Status update result:', statusResult);
    }
    
    console.log('🎉 Email verification test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

// Test verification link parsing
const testVerificationLink = (url) => {
  console.log('🔗 Testing verification link parsing...');
  
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    const mode = params.get('mode');
    const actionCode = params.get('oobCode');
    const continueUrl = params.get('continueUrl');
    const lang = params.get('lang');
    
    console.log('📋 Parsed parameters:', {
      mode,
      actionCode: actionCode ? 'Present' : 'Missing',
      continueUrl,
      lang
    });
    
    if (mode === 'verifyEmail' && actionCode) {
      console.log('✅ Valid verification link format');
    } else {
      console.log('❌ Invalid verification link format');
    }
    
  } catch (error) {
    console.error('❌ Error parsing URL:', error);
  }
};

// Test Firebase configuration
const testFirebaseConfig = () => {
  console.log('⚙️ Testing Firebase configuration...');
  
  const config = {
    apiKey: "AIzaSyDrx0Sxs0yoJHUahGB59ojOEulPfNd57_Y",
    authDomain: "acc-app-e5316.firebaseapp.com",
    projectId: "acc-app-e5316",
    storageBucket: "acc-app-e5316.firebasestorage.app",
    messagingSenderId: "447193481869",
    appId: "acc-app-e5316",
    measurementId: "G-PLY7P9M3F8"
  };
  
  console.log('📋 Firebase config:', config);
  
  // Check if auth domain is correct
  if (config.authDomain === 'acc-app-e5316.firebaseapp.com') {
    console.log('✅ Auth domain is correct');
  } else {
    console.log('❌ Auth domain mismatch');
  }
  
  // Check if project ID matches
  if (config.projectId === 'acc-app-e5316') {
    console.log('✅ Project ID is correct');
  } else {
    console.log('❌ Project ID mismatch');
  }
};

// Export functions for use in console
window.testEmailVerification = testEmailVerification;
window.testVerificationLink = testVerificationLink;
window.testFirebaseConfig = testFirebaseConfig;

console.log('🧪 Email verification test functions loaded!');
console.log('📝 Available functions:');
console.log('  - testEmailVerification() - Test complete verification flow');
console.log('  - testVerificationLink(url) - Test verification link parsing');
console.log('  - testFirebaseConfig() - Test Firebase configuration');

// Auto-run configuration test
testFirebaseConfig(); 