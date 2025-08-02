import { 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  confirmPasswordReset,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  setDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase.config';

// Email Verification Functions
export const sendVerificationEmail = async (user, continueUrl = null) => {
  try {
    const actionCodeSettings = {
      url: continueUrl || `${window.location.origin}/complete-verification.html?continueUrl=${encodeURIComponent(window.location.href)}`,
      handleCodeInApp: true
    };
    
    await sendEmailVerification(user, actionCodeSettings);
    return { success: true, message: 'Verification email sent successfully!' };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, message: error.message };
  }
};

export const checkEmailVerification = async (user) => {
  try {
    await user.reload();
    return user.emailVerified;
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
};

export const updateUserEmailVerificationStatus = async (userId, isVerified) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const newStatus = isVerified && userData.phoneVerified ? 'active' : 
                       isVerified ? 'pending_phone' : 'pending_email';
      
      await updateDoc(userRef, {
        emailVerified: isVerified,
        status: newStatus,
        emailVerifiedAt: isVerified ? serverTimestamp() : null
      });
      
      return { success: true, status: newStatus };
    }
    return { success: false, message: 'User document not found' };
  } catch (error) {
    console.error('Error updating email verification status:', error);
    return { success: false, message: error.message };
  }
};

// Phone Verification Functions
export const generateVerificationCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const storeVerificationCode = async (userId, phoneNumber, code) => {
  try {
    const verificationRef = await addDoc(collection(db, 'verificationCodes'), {
      userId,
      phoneNumber,
      code,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      used: false
    });
    
    return { success: true, codeId: verificationRef.id };
  } catch (error) {
    console.error('Error storing verification code:', error);
    return { success: false, message: error.message };
  }
};

export const verifyPhoneCode = async (userId, phoneNumber, code) => {
  try {
    const codesRef = collection(db, 'verificationCodes');
    const q = query(
      codesRef, 
      where('userId', '==', userId),
      where('phoneNumber', '==', phoneNumber),
      where('code', '==', code),
      where('used', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, message: 'Invalid or expired verification code' };
    }
    
    const codeDoc = querySnapshot.docs[0];
    const codeData = codeDoc.data();
    
    // Check if code is expired
    if (codeData.expiresAt.toDate() < new Date()) {
      await deleteDoc(doc(db, 'verificationCodes', codeDoc.id));
      return { success: false, message: 'Verification code has expired' };
    }
    
    // Mark code as used
    await updateDoc(doc(db, 'verificationCodes', codeDoc.id), {
      used: true,
      usedAt: serverTimestamp()
    });
    
    // Update user phone verification status
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const newStatus = userData.emailVerified ? 'active' : 'pending_email';
      
      await updateDoc(userRef, {
        phoneVerified: true,
        phoneVerifiedAt: serverTimestamp(),
        status: newStatus
      });
      
      return { success: true, status: newStatus };
    }
    
    return { success: false, message: 'User document not found' };
  } catch (error) {
    console.error('Error verifying phone code:', error);
    return { success: false, message: error.message };
  }
};

// Password Reset Functions
export const sendPasswordReset = async (email, continueUrl = null) => {
  try {
    const actionCodeSettings = {
      url: continueUrl || `${window.location.origin}/complete-verification.html?continueUrl=${encodeURIComponent(window.location.href)}`,
      handleCodeInApp: true
    };
    
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    return { success: true, message: 'Password reset email sent successfully!' };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    if (error.code === 'auth/user-not-found') {
      return { success: false, message: 'No account found with this email address' };
    }
    return { success: false, message: error.message };
  }
};

export const resetPassword = async (actionCode, newPassword) => {
  try {
    await confirmPasswordReset(auth, actionCode, newPassword);
    return { success: true, message: 'Password reset successfully!' };
  } catch (error) {
    console.error('Error resetting password:', error);
    if (error.code === 'auth/invalid-action-code') {
      return { success: false, message: 'Invalid or expired reset code' };
    }
    return { success: false, message: error.message };
  }
};

// Security Functions
export const trackLoginAttempt = async (email, success = false) => {
  try {
    const sessionRef = await addDoc(collection(db, 'userSessions'), {
      email,
      success,
      timestamp: serverTimestamp(),
      ipAddress: 'unknown', // In production, get from request
      userAgent: navigator.userAgent
    });
    
    return { success: true, sessionId: sessionRef.id };
  } catch (error) {
    console.error('Error tracking login attempt:', error);
    return { success: false, message: error.message };
  }
};

export const getLoginAttempts = async (email, timeWindow = 15 * 60 * 1000) => {
  try {
    const cutoffTime = new Date(Date.now() - timeWindow);
    const sessionsRef = collection(db, 'userSessions');
    const q = query(
      sessionsRef,
      where('email', '==', email),
      where('timestamp', '>=', cutoffTime),
      where('success', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    return { success: true, attempts: querySnapshot.size };
  } catch (error) {
    console.error('Error getting login attempts:', error);
    return { success: false, attempts: 0 };
  }
};

// User Registration Functions
export const registerUser = async (userData) => {
  try {
    const { email, contact, companyName, uid } = userData;
    
    // Check if email already exists
    const emailQuery = query(collection(db, 'users'), where('email', '==', email));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      return { success: false, message: 'Email already registered' };
    }
    
    // Create user document
    await setDoc(doc(db, 'users', uid), {
      email,
      contact,
      companyName,
      emailVerified: false,
      phoneVerified: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      status: 'pending_verification',
      profileComplete: false
    });
    
    // Update user profile
    await updateProfile(auth.currentUser, {
      displayName: companyName
    });
    
    return { success: true, message: 'User registered successfully' };
  } catch (error) {
    console.error('Error registering user:', error);
    return { success: false, message: error.message };
  }
};

// User Status Functions
export const getUserStatus = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    }
    return { success: false, message: 'User not found' };
  } catch (error) {
    console.error('Error getting user status:', error);
    return { success: false, message: error.message };
  }
};

export const updateUserStatus = async (userId, status) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      status,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user status:', error);
    return { success: false, message: error.message };
  }
};

// Validation Functions
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const validatePassword = (password) => {
  // At least 6 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/;
  return passwordRegex.test(password);
};

// Utility Functions
export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `+91${cleaned}`; // Indian format
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`; // US format
  }
  
  return `+${cleaned}`;
};

export const generateUserId = () => {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Session Management
export const createUserSession = async (userId) => {
  try {
    const sessionRef = await addDoc(collection(db, 'userSessions'), {
      userId,
      loginTime: serverTimestamp(),
      userAgent: navigator.userAgent,
      active: true
    });
    
    return { success: true, sessionId: sessionRef.id };
  } catch (error) {
    console.error('Error creating user session:', error);
    return { success: false, message: error.message };
  }
};

export const endUserSession = async (sessionId) => {
  try {
    await updateDoc(doc(db, 'userSessions', sessionId), {
      logoutTime: serverTimestamp(),
      active: false
    });
    return { success: true };
  } catch (error) {
    console.error('Error ending user session:', error);
    return { success: false, message: error.message };
  }
}; 