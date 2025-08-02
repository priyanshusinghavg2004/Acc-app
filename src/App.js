import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Items from './components/Items';
import Parties from './components/Parties';
import Sales from './components/Sales';
import Purchases from './components/Purchases';
import Payments from './components/Payments';
import Manufacturing from './components/ManufacturingNew';
import Reports from './components/Reports';
import Taxes from './components/Taxes';
import BillTemplates from './components/BillTemplates';
import CompanyDetails from './components/CompanyDetails';
import CompanyDetailsWizard from './components/CompanyDetailsWizard';
import Expenses from './components/Expenses';
import UserOnboarding from './components/UserOnboarding';
import HelpSupport from './components/HelpSupport';
import NotificationSettings from './components/NotificationSettings';
import AdvancedSearch from './components/AdvancedSearch';
import QuickSearch from './components/QuickSearch';
import DataExport from './components/DataExport';
import VoiceCommands from './components/VoiceCommands';
import OfflineIndicator from './components/OfflineIndicator';
import GestureControls from './components/GestureControls';
import GestureIntegration from './components/GestureIntegration';
import MobileBottomNav from './components/MobileBottomNav';
import { db, auth } from './firebase.config';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile
} from 'firebase/auth';
import { 
  setDoc, 
  doc, 
  getDoc, 
  serverTimestamp, 
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  sendVerificationEmail,
  checkEmailVerification,
  updateUserEmailVerificationStatus,
  generateVerificationCode,
  storeVerificationCode,
  verifyPhoneCode,
  sendPasswordReset,
  resetPassword,
  trackLoginAttempt,
  getLoginAttempts,
  registerUser,
  validateEmail,
  validatePhone,
  validatePassword,
  formatPhoneNumber
} from './utils/verification';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCompany, setRegisterCompany] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerContact, setRegisterContact] = useState('');
  const [showCompanyDetailsWizard, setShowCompanyDetailsWizard] = useState(false);
  const [companyWizardStep, setCompanyWizardStep] = useState(1);
  const [showCompanyDetailsModal, setShowCompanyDetailsModal] = useState(false);
  const appId = 'acc-app-e5316'; // Use the Firebase project ID
  
  // Verification states
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneVerificationId, setPhoneVerificationId] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  
  // Password reset states
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  
  // Dropdown state for desktop/mobile
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownFocusIdx, setDropdownFocusIdx] = useState(-1);
  const [dropdownOpenedByClick, setDropdownOpenedByClick] = useState(false);
  const [isMouseOverNavOrDropdown, setIsMouseOverNavOrDropdown] = useState(false);
  const dropdownRefs = useRef([]);
  const navBarRef = useRef(null);
  const mouseLeaveTimeout = useRef(null); // NEW

  // Remove manualUserId and useManualUserId state
  // const manualUserId = "tVzTkH95LXYZbPcQeEsMUnByZ3R2"; // Set your manual UID here
  // const [useManualUserId, setUseMan
  // Remove effectiveUserId logic
  // const effectiveUserId = useManualUserId ? manualUserId : user?.uid;
  const [companyDetails, setCompanyDetails] = useState({});

  // Custom tour state
  const [showTour, setShowTour] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  // Update tour steps to be more relevant:
  const tourSteps = [
    {
      title: 'Welcome to LekhaJokha!',
      content: 'Your complete accounting and business management solution. Let us show you around.',
      position: 'center'
    },
    {
      title: 'Navigation Menu',
      content: 'Use this navigation bar to access all modules like Sales, Purchases, Expenses, and more.',
      position: 'bottom'
    },
    {
      title: 'Dashboard Overview',
      content: 'Your dashboard shows key business metrics and quick access to important functions.',
      position: 'center'
    },
    {
      title: 'You\'re All Set!',
      content: 'You can now explore all the features. Start with Sales or Company Details to get going.',
      position: 'center'
    }
  ];

  // Onboarding and Help state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showDataExport, setShowDataExport] = useState(false);
  const [showVoiceCommands, setShowVoiceCommands] = useState(false);
  const [showGestureControls, setShowGestureControls] = useState(false);

  // Add state to store the newly created user's UID during registration:
  const [newUserId, setNewUserId] = useState(null);

  // Load login attempts from localStorage
  useEffect(() => {
    const attempts = localStorage.getItem('loginAttempts') || 0;
    const lockoutTime = localStorage.getItem('lockoutTime') || 0;
    const currentTime = Date.now();
    
    if (lockoutTime && currentTime < parseInt(lockoutTime)) {
      setIsAccountLocked(true);
      const remainingTime = Math.ceil((parseInt(lockoutTime) - currentTime) / 1000);
      setLockoutTimer(remainingTime);
    } else {
      setLoginAttempts(parseInt(attempts));
      setIsAccountLocked(false);
    }
  }, []);

  // Handle lockout timer
  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setInterval(() => {
        setLockoutTimer(prev => {
          if (prev <= 1) {
            setIsAccountLocked(false);
            setLoginAttempts(0);
            localStorage.removeItem('loginAttempts');
            localStorage.removeItem('lockoutTime');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTimer]);

  // Handle resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      
      // Clear newUserId when user logs out
      if (!user) {
        setNewUserId(null);
        setShowEmailVerification(false);
        setShowPhoneVerification(false);
      } else {
        // Check if email is verified
        if (user && !user.emailVerified) {
          setShowEmailVerification(true);
        }
        
        // Check if phone is verified
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && !userDoc.data().phoneVerified) {
          setShowPhoneVerification(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Remove the automatic tour trigger for existing users:
  // useEffect(() => {
  //   if (user && localStorage.getItem('hasSeenTour') !== 'true') {
  //     setShowTour(true);
  //     setCurrentTourStep(0);
  //   }
  // }, [user]);

  useEffect(() => {
    if (openDropdown !== null) {
      setDropdownFocusIdx(0);
    } else {
      setDropdownFocusIdx(-1);
      setDropdownOpenedByClick(false);
    }
  }, [openDropdown]);

  useEffect(() => {
    if (openDropdown !== null && dropdownFocusIdx >= 0 && dropdownRefs.current[dropdownFocusIdx]) {
      dropdownRefs.current[dropdownFocusIdx].focus();
    }
  }, [dropdownFocusIdx, openDropdown]);

  // Click outside to close dropdown (refined logic)
  useEffect(() => {
    if (openDropdown === null) return;
    function handleClickOutside(event) {
      if (
        navBarRef.current &&
        !navBarRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
        setDropdownOpenedByClick(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Add a ref to track if we've already tried to show the wizard
  const wizardShownRef = useRef(false);

  // Reset wizard shown ref when user changes
  useEffect(() => {
    wizardShownRef.current = false;
  }, [user?.uid]);

  // Fetch company details for logo/avatar
  useEffect(() => {
    if (!db || !user?.uid || !isAuthReady) return;
    const docRef = doc(db, `artifacts/${appId}/users/${user.uid}/companyDetails`, 'myCompany');
    getDoc(docRef).then(docSnap => {
      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data());
        // If company details exist, don't show the wizard
        setShowCompanyDetailsWizard(false);
        wizardShownRef.current = false;
      } else {
        // If no company details exist, show the wizard for first-time users
        // Only show if user is not in the middle of registration process and we haven't shown it yet
        if (!wizardShownRef.current) {
          setShowCompanyDetailsWizard(true);
          wizardShownRef.current = true;
        }
      }
    }).catch(error => {
      console.error('Error fetching company details:', error);
    });
  }, [db, user, isAuthReady, appId]);

  useEffect(() => {
    if (user && localStorage.getItem('hasSeenTour') !== 'true') {
      window.startShepherdTour = true;
    }
  }, [user]);

  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarRef = useRef(null);
  // Close avatar dropdown on outside click
  useEffect(() => {
    if (!avatarDropdownOpen) return;
    function handleClickOutside(event) {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setAvatarDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarDropdownOpen]);

  // Enhanced login with rate limiting
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (isAccountLocked) {
      setLoginError(`Account temporarily locked. Please try again in ${lockoutTimer} seconds.`);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // Reset login attempts on successful login
      setLoginAttempts(0);
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('lockoutTime');
    } catch (err) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('loginAttempts', newAttempts.toString());
      
      if (newAttempts >= 5) {
        // Lock account for 15 minutes
        const lockoutTime = Date.now() + (15 * 60 * 1000);
        localStorage.setItem('lockoutTime', lockoutTime.toString());
        setIsAccountLocked(true);
        setLockoutTimer(15 * 60);
        setLoginError('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        setLoginError(`Invalid credentials. ${5 - newAttempts} attempts remaining.`);
      }
    }
  };

  // Enhanced registration with email verification
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');
    
    // Enhanced validation
    if (!registerEmail.trim()) {
      setRegisterError('Email is required.');
      return;
    }
    if (!validateEmail(registerEmail)) {
      setRegisterError('Please enter a valid email address.');
      return;
    }
    if (!registerContact.trim()) {
      setRegisterError('Contact Number is required.');
      return;
    }
    if (!validatePhone(registerContact)) {
      setRegisterError('Please enter a valid phone number.');
      return;
    }
    if (!registerPassword.trim()) {
      setRegisterError('Password is required.');
      return;
    }
    if (!validatePassword(registerPassword)) {
      setRegisterError('Password must be at least 6 characters with uppercase, lowercase, and number.');
      return;
    }
    if (!registerCompany.trim()) {
      setRegisterError('Company Name is required.');
      return;
    }

    try {
      // Create user account
      const newUser = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      
      // Store the new user's UID for later use
      setNewUserId(newUser.user.uid);
      
      // Register user with verification utilities
      const registrationResult = await registerUser({
        email: registerEmail,
        contact: formatPhoneNumber(registerContact),
        companyName: registerCompany,
        uid: newUser.user.uid
      });
      
      if (!registrationResult.success) {
        setRegisterError(registrationResult.message);
        return;
      }
      
      // Send email verification
      const emailResult = await sendVerificationEmail(newUser.user);
      if (!emailResult.success) {
        setRegisterError(emailResult.message);
        return;
      }
      
      // Store registration data in localStorage for later use
      localStorage.setItem('registrationData', JSON.stringify({
        contact: registerContact,
        email: registerEmail,
        companyName: registerCompany
      }));
      
      setRegisterError('✅ Registration successful! Please check your email for verification link.');
      setShowEmailVerification(true);
      
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setRegisterError('Email already registered. Please login instead.');
      } else if (err.code === 'auth/weak-password') {
        setRegisterError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setRegisterError('Invalid email address. Please check your email format.');
      } else {
        setRegisterError('Registration failed. Please try again.');
      }
    }
  };

  // Email verification functions
  const handleResendEmailVerification = async () => {
    if (resendTimer > 0) return;
    
    try {
      const result = await sendVerificationEmail(auth.currentUser);
      if (result.success) {
        setResendTimer(60);
        setVerificationError('✅ Verification email sent! Please check your inbox.');
      } else {
        setVerificationError(result.message);
      }
    } catch (error) {
      setVerificationError('Failed to send verification email. Please try again.');
    }
  };

  const handleEmailVerificationCheck = async () => {
    setIsVerifying(true);
    try {
      const isVerified = await checkEmailVerification(auth.currentUser);
      if (isVerified) {
        const result = await updateUserEmailVerificationStatus(auth.currentUser.uid, true);
        if (result.success) {
          setShowEmailVerification(false);
          setVerificationError('');
        } else {
          setVerificationError(result.message);
        }
      } else {
        setVerificationError('Email not verified yet. Please check your inbox and click the verification link.');
      }
    } catch (error) {
      setVerificationError('Error checking verification status. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Phone verification functions (using SMS)
  const handleSendPhoneVerification = async () => {
    if (resendTimer > 0) return;
    
    try {
      const code = generateVerificationCode();
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const phoneNumber = userDoc.data()?.contact || '';
      
      const result = await storeVerificationCode(auth.currentUser.uid, phoneNumber, code);
      if (result.success) {
        setPhoneVerificationId(code);
        setResendTimer(60);
        setVerificationError(`✅ Verification code sent! Demo code: ${code}`);
      } else {
        setVerificationError(result.message);
      }
    } catch (error) {
      setVerificationError('Failed to send verification code. Please try again.');
    }
  };

  const handleVerifyPhone = async () => {
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code.');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const phoneNumber = userDoc.data()?.contact || '';
      
      const result = await verifyPhoneCode(auth.currentUser.uid, phoneNumber, verificationCode);
      if (result.success) {
        setShowPhoneVerification(false);
        setVerificationError('');
        setVerificationCode('');
      } else {
        setVerificationError(result.message);
      }
    } catch (error) {
      setVerificationError('Error verifying phone number. Please try again.');
    }
  };

  // Password reset functions
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.');
      return;
    }

    if (!validateEmail(resetEmail)) {
      setResetError('Please enter a valid email address.');
      return;
    }

    try {
      const result = await sendPasswordReset(resetEmail);
      if (result.success) {
        setResetSuccess(true);
        setResetError('');
      } else {
        setResetError(result.message);
      }
    } catch (error) {
      setResetError('Failed to send reset email. Please try again.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    
    if (!resetCode.trim()) {
      setResetError('Please enter the reset code.');
      return;
    }
    if (!newPassword.trim()) {
      setResetError('Please enter a new password.');
      return;
    }
    if (!validatePassword(newPassword)) {
      setResetError('Password must be at least 6 characters with uppercase, lowercase, and number.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    try {
      const result = await resetPassword(resetCode, newPassword);
      if (result.success) {
        setResetSuccess(true);
        setShowResetPasswordForm(false);
        setResetError('');
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setResetError(result.message);
      }
    } catch (error) {
      setResetError('Failed to reset password. Please try again.');
    }
  };





  const handleTourNext = () => {
    if (currentTourStep < tourSteps.length - 1) {
      setCurrentTourStep(currentTourStep + 1);
    } else {
      setShowTour(false);
      localStorage.setItem('hasSeenTour', 'true');
    }
  };

  const handleTourSkip = () => {
    setShowTour(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  // Handle gesture actions
  const handleGestureAction = (action) => {
    switch (action) {
      case 'search':
        setShowAdvancedSearch(true);
        break;
      case 'export':
        setShowDataExport(true);
        break;
      case 'help':
        setShowHelp(true);
        break;
      case 'settings':
        setShowNotificationSettings(true);
        break;
      case 'voice':
        setShowVoiceCommands(true);
        break;
      case 'zoom-in':
        document.body.style.zoom = '1.2';
        break;
      case 'zoom-out':
        document.body.style.zoom = '1';
        break;
      case 'context-menu':
        // Handle context menu gesture
        break;
      default:
        console.log('Unknown gesture action:', action);
    }
  };













  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword}>
              <h2 className="text-2xl font-bold mb-4 text-center">Forgot Password</h2>
              {resetError && <div className="mb-2 text-red-600 text-sm">{resetError}</div>}
              {resetSuccess && <div className="mb-2 text-green-600 text-sm">Password reset email sent! Please check your inbox.</div>}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  value={resetEmail} 
                  onChange={e => setResetEmail(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Enter your email address"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">
                Send Reset Email
              </button>
              <div className="mt-4 text-center space-y-2">
                <button type="button" className="text-blue-600 underline block" onClick={() => setShowForgotPassword(false)}>
                  Back to Login
                </button>
                <button type="button" className="text-blue-600 underline block" onClick={() => setShowRegister(true)}>
                  New user? Register
                </button>
              </div>
            </form>
          ) : showRegister ? (
            <form onSubmit={handleRegister}>
              <h2 className="text-2xl font-bold mb-4 text-center">Register</h2>
              {registerError && <div className="mb-2 text-red-600 text-sm">{registerError}</div>}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={registerCompany} 
                  onChange={e => setRegisterCompany(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Enter your company name"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  value={registerEmail} 
                  onChange={e => setRegisterEmail(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Enter your email address"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Contact Number</label>
                <input 
                  type="tel" 
                  value={registerContact} 
                  onChange={e => setRegisterContact(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Enter your phone number"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Password</label>
                <input 
                  type="password" 
                  value={registerPassword} 
                  onChange={e => setRegisterPassword(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Minimum 6 characters"
                  minLength={6}
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">
                Register
              </button>
              <div className="mt-4 text-center">
                <button type="button" className="text-blue-600 underline" onClick={() => setShowRegister(false)}>
                  Already have an account? Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
              {loginError && <div className="mb-2 text-red-600 text-sm">{loginError}</div>}
              {isAccountLocked && (
                <div className="mb-2 text-red-600 text-sm">
                  Account locked. Please try again in {lockoutTimer} seconds.
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  value={loginEmail} 
                  onChange={e => setLoginEmail(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Enter your email"
                  disabled={isAccountLocked}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Password</label>
                <input 
                  type="password" 
                  value={loginPassword} 
                  onChange={e => setLoginPassword(e.target.value)} 
                  required 
                  className="w-full border rounded p-2" 
                  placeholder="Enter your password"
                  disabled={isAccountLocked}
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={isAccountLocked}
              >
                Login
              </button>
              <div className="mt-4 text-center space-y-2">
                <button type="button" className="text-blue-600 underline block" onClick={() => setShowForgotPassword(true)}>
                  Forgot Password?
                </button>
                <button type="button" className="text-blue-600 underline block" onClick={() => setShowRegister(true)}>
                  New user? Register
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }



  // Navigation groups for dropdowns
  const navGroups = [
    {
      label: 'Sales & Purchases',
      links: [
        { to: '/sales', label: 'Sales' },
        { to: '/purchases', label: 'Purchases' },
        { to: '/payments', label: 'Payments' },
        { to: '/parties', label: 'Parties' },
      ],
    },
    {
      label: 'Inventory & Manufacturing',
      links: [
        { to: '/items', label: 'Items' },
        { to: '/manufacturing', label: 'Manufacturing' },
      ],
    },
    {
      label: 'Reports & Analysis',
      links: [
        { to: '/reports', label: 'Reports' },
        { to: '/taxes', label: 'Taxes' },
      ],
    },
    {
      label: 'Company & Settings',
      links: [
        { to: '/company', label: 'Company Details' },
        { to: '/bill-templates', label: 'Bill Templates' },
      ],
    },
  ];

  return (
    <Router>
      <AppContent 
        user={user}
        isAuthReady={isAuthReady}
        appId={appId}
        companyDetails={companyDetails}
        showTour={showTour}
        currentTourStep={currentTourStep}
        tourSteps={tourSteps}
        handleTourNext={handleTourNext}
        handleTourSkip={handleTourSkip}
        setShowTour={setShowTour}
        setCurrentTourStep={setCurrentTourStep}
        showCompanyDetailsWizard={showCompanyDetailsWizard}
        setShowCompanyDetailsWizard={setShowCompanyDetailsWizard}
        registerContact={registerContact}
        registerEmail={registerEmail}
        newUserId={newUserId}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
        showOnboarding={showOnboarding}
        setShowOnboarding={setShowOnboarding}
        showNotificationSettings={showNotificationSettings}
        setShowNotificationSettings={setShowNotificationSettings}
        showAdvancedSearch={showAdvancedSearch}
        setShowAdvancedSearch={setShowAdvancedSearch}
        showDataExport={showDataExport}
        setShowDataExport={setShowDataExport}
        showVoiceCommands={showVoiceCommands}
        setShowVoiceCommands={setShowVoiceCommands}
        showGestureControls={showGestureControls}
        setShowGestureControls={setShowGestureControls}
        handleGestureAction={handleGestureAction}
        showEmailVerification={showEmailVerification}
        setShowEmailVerification={setShowEmailVerification}
        handleEmailVerificationCheck={handleEmailVerificationCheck}
        handleResendEmailVerification={handleResendEmailVerification}
        showPhoneVerification={showPhoneVerification}
        setShowPhoneVerification={setShowPhoneVerification}
        handleSendPhoneVerification={handleSendPhoneVerification}
        handleVerifyPhone={handleVerifyPhone}
        verificationCode={verificationCode}
        setVerificationCode={setVerificationCode}
        verificationError={verificationError}
        isVerifying={isVerifying}
        resendTimer={resendTimer}
        loginAttempts={loginAttempts}
        isAccountLocked={isAccountLocked}
        lockoutTimer={lockoutTimer}
        showForgotPassword={showForgotPassword}
        setShowForgotPassword={setShowForgotPassword}
        resetEmail={resetEmail}
        setResetEmail={setResetEmail}
        resetError={resetError}
        setResetError={setResetError}
        resetSuccess={resetSuccess}
        setResetSuccess={setResetSuccess}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmNewPassword={confirmNewPassword}
        setConfirmNewPassword={setConfirmNewPassword}
        resetCode={resetCode}
        setResetCode={setResetCode}
        showResetPasswordForm={showResetPasswordForm}
        setShowResetPasswordForm={setShowResetPasswordForm}
        handleForgotPassword={handleForgotPassword}
        handleResetPassword={handleResetPassword}
      />
    </Router>
  );
}

// Separate component that can use useLocation
function AppContent({ 
  user, 
  isAuthReady, 
  appId, 
  companyDetails, 
  showTour, 
  currentTourStep, 
  tourSteps, 
  handleTourNext, 
  handleTourSkip,
  setShowTour,
  setCurrentTourStep,
  showCompanyDetailsWizard,
  setShowCompanyDetailsWizard,
  registerContact,
  registerEmail,
  newUserId,
  showHelp,
  setShowHelp,
  showOnboarding,
  setShowOnboarding,
  showNotificationSettings,
  setShowNotificationSettings,
  showAdvancedSearch,
  setShowAdvancedSearch,
  showDataExport,
  setShowDataExport,
  showVoiceCommands,
  setShowVoiceCommands,
  showGestureControls,
  setShowGestureControls,
  handleGestureAction,
  showEmailVerification,
  setShowEmailVerification,
  handleEmailVerificationCheck,
  handleResendEmailVerification,
  showPhoneVerification,
  setShowPhoneVerification,
  handleSendPhoneVerification,
  handleVerifyPhone,
  verificationCode,
  setVerificationCode,
  verificationError,
  isVerifying,
  resendTimer,
  loginAttempts,
  isAccountLocked,
  lockoutTimer,
  showForgotPassword,
  setShowForgotPassword,
  resetEmail,
  setResetEmail,
  resetError,
  setResetError,
  resetSuccess,
  setResetSuccess,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  resetCode,
  setResetCode,
  showResetPasswordForm,
  setShowResetPasswordForm,
  handleForgotPassword,
  handleResetPassword
}) {
  const currentLocation = useLocation();
  
  // Dropdown state for desktop/mobile
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownFocusIdx, setDropdownFocusIdx] = useState(-1);
  const [dropdownOpenedByClick, setDropdownOpenedByClick] = useState(false);
  const [isMouseOverNavOrDropdown, setIsMouseOverNavOrDropdown] = useState(false);
  const dropdownRefs = useRef([]);
  const navBarRef = useRef(null);
  const mouseLeaveTimeout = useRef(null);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarRef = useRef(null);
  
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenGroup, setMobileOpenGroup] = useState(null);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  


  // Navigation groups for dropdowns
  const navGroups = [
    {
      label: 'Sales & Purchases',
      links: [
        { to: '/sales', label: 'Sales' },
        { to: '/purchases', label: 'Purchases' },
        { to: '/payments', label: 'Payments' },
        { to: '/parties', label: 'Parties' },
      ],
    },
    {
      label: 'Inventory & Manufacturing',
      links: [
        { to: '/items', label: 'Items' },
        { to: '/manufacturing', label: 'Manufacturing' },
      ],
    },
    {
      label: 'Reports & Analysis',
      links: [
        { to: '/reports', label: 'Reports' },
        { to: '/taxes', label: 'Taxes' },
      ],
    },
    {
      label: 'Company & Settings',
      links: [
        { to: '/company', label: 'Company Details' },
        { to: '/bill-templates', label: 'Bill Templates' },
      ],
    },
  ];

  useEffect(() => {
    if (openDropdown !== null) {
      setDropdownFocusIdx(0);
    } else {
      setDropdownFocusIdx(-1);
      setDropdownOpenedByClick(false);
    }
  }, [openDropdown]);

  useEffect(() => {
    if (openDropdown !== null && dropdownFocusIdx >= 0 && dropdownRefs.current[dropdownFocusIdx]) {
      dropdownRefs.current[dropdownFocusIdx].focus();
    }
  }, [dropdownFocusIdx, openDropdown]);

  // Click outside to close dropdown (refined logic)
  useEffect(() => {
    if (openDropdown === null) return;
    function handleClickOutside(event) {
      if (
        navBarRef.current &&
        !navBarRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
        setDropdownOpenedByClick(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);



  return (
    <>
      {/* Custom Tour Modal */}
      {showTour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {tourSteps[currentTourStep].title}
              </h3>
              <p className="text-gray-600 mb-6">
                {tourSteps[currentTourStep].content}
              </p>
              <div className="flex justify-between items-center">
                <button
                  onClick={handleTourSkip}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Skip Tour
                </button>
                <div className="flex space-x-2">
                  {currentTourStep > 0 && (
                    <button
                      onClick={() => setCurrentTourStep(currentTourStep - 1)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Previous
                    </button>
                  )}
                  <button
                    onClick={handleTourNext}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {currentTourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-center space-x-1">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentTourStep ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Details Modal */}
      <CompanyDetailsWizard 
        isOpen={showCompanyDetailsWizard} 
        onClose={() => setShowCompanyDetailsWizard(false)}
        db={db}
        userId={user?.uid || newUserId}
        appId={appId}
        registrationData={(() => {
          // Try to get registration data from localStorage first
          const storedData = localStorage.getItem('registrationData');
          if (storedData) {
            try {
              const parsed = JSON.parse(storedData);
              return {
                contact: parsed.contact || registerContact || user?.contact || '',
                email: parsed.email || registerEmail || user?.email || ''
              };
            } catch (e) {
              console.error('Error parsing stored registration data:', e);
            }
          }
          // Fallback to current state
          return {
            contact: registerContact || user?.contact || '',
            email: registerEmail || user?.email || ''
          };
        })()}
        onComplete={() => {
          setShowCompanyDetailsWizard(false);
          // Clear any existing tour state
          localStorage.removeItem('hasSeenTour');
          // Start the app tour here
          setShowTour(true);
          setCurrentTourStep(0);
        }}
      />

      {/* Show company wizard overlay for first-time users */}
      {showCompanyDetailsWizard && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to LekhaJokha!</h2>
            <p className="text-gray-600 mb-6">
              Please complete your company profile setup to get started with your business management.
            </p>
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
              <p className="text-sm text-gray-500">Loading company setup...</p>
            </div>
            <button 
              onClick={() => setShowCompanyDetailsWizard(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      <div className={`min-h-screen bg-gray-100 ${showCompanyDetailsWizard ? 'hidden' : ''} pb-16 lg:pb-0`} style={{ paddingTop: '70px' }}>
        {/* Navigation */}
        
                {/* Global Search Bar - Removed from below navbar */}
        <nav ref={navBarRef} className="fixed top-0 left-0 w-full z-50 bg-white shadow"
          onMouseEnter={() => {
            setIsMouseOverNavOrDropdown(true);
            if (mouseLeaveTimeout.current) clearTimeout(mouseLeaveTimeout.current);
          }}
          onMouseLeave={() => {
            setIsMouseOverNavOrDropdown(false);
            mouseLeaveTimeout.current = setTimeout(() => {
              if (!isMouseOverNavOrDropdown) setOpenDropdown(null);
            }, 120);
          }}
        >
                    <div className="max-w-7xl mx-auto px-4 lg:px-6">
            {/* Desktop Layout */}
            <div className="hidden lg:grid lg:grid-cols-12 items-center h-16 gap-4">
              {/* Logo and Brand */}
              <div className="col-span-3 flex items-center justify-start">
                <Link to="/" className="flex items-center" style={{ gap: '30px' }}>
                  <img src={process.env.PUBLIC_URL + '/logolekhajokha.png'} alt="LekhaJokha Logo" style={{ height: 40 }} />
                  <span className="text-2xl font-bold" style={{ color: '#003399' }}>
                    LEKHA<span style={{ color: '#ff8800' }}>JOKHA</span>
                  </span>
                </Link>
              </div>
              
              {/* Desktop menu */}
              <div className="hidden lg:flex items-center space-x-6 col-span-7 justify-center">
                {navGroups.map((group, idx) => (
                  group.links.length === 1 ? (
                    <Link
                      key={group.label}
                      to={group.links[0].to}
                      className="text-gray-900 inline-flex items-center px-2 py-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium whitespace-nowrap"
                      onClick={() => {
                        setOpenDropdown(null);
                        setDropdownOpenedByClick(false);
                      }}
                    >
                      {group.links[0].label}
                    </Link>
                  ) : (
                    <div
                      key={group.label}
                      className="relative"
                      onMouseEnter={() => {
                        setOpenDropdown(idx);
                        setIsMouseOverNavOrDropdown(true);
                        if (mouseLeaveTimeout.current) clearTimeout(mouseLeaveTimeout.current);
                      }}
                      onMouseLeave={() => {
                        setIsMouseOverNavOrDropdown(false);
                        mouseLeaveTimeout.current = setTimeout(() => {
                          if (!isMouseOverNavOrDropdown) setOpenDropdown(null);
                        }, 120);
                      }}
                    >
                      <button
                        className="text-gray-900 inline-flex items-center px-2 py-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium whitespace-nowrap focus:outline-none"
                        onClick={e => {
                          e.stopPropagation();
                          if (openDropdown === idx) {
                            setOpenDropdown(null);
                            setDropdownOpenedByClick(false);
                          } else {
                            setOpenDropdown(idx);
                            setDropdownOpenedByClick(true);
                          }
                        }}
                        aria-haspopup="true"
                        aria-expanded={openDropdown === idx}
                        type="button"
                        onKeyDown={e => {
                          if (openDropdown === idx) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setDropdownFocusIdx(i => (i + 1) % group.links.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setDropdownFocusIdx(i => (i - 1 + group.links.length) % group.links.length);
                            } else if (e.key === 'Escape') {
                              setOpenDropdown(null);
                              setDropdownOpenedByClick(false);
                            }
                          } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                            setOpenDropdown(idx);
                            setDropdownOpenedByClick(true);
                          }
                        }}
                      >
                        {group.label}
                      </button>
                      {/* Dropdown with animation */}
                      <div
                        onMouseEnter={() => {
                          setIsMouseOverNavOrDropdown(true);
                          if (mouseLeaveTimeout.current) clearTimeout(mouseLeaveTimeout.current);
                        }}
                        onMouseLeave={() => {
                          setIsMouseOverNavOrDropdown(false);
                          mouseLeaveTimeout.current = setTimeout(() => {
                            if (!isMouseOverNavOrDropdown) setOpenDropdown(null);
                          }, 120);
                        }}
                        className={`absolute left-0 mt-2 min-w-[180px] border border-gray-300 rounded-lg shadow-lg z-50 transition-all duration-200 ease-in-out backdrop-blur-sm bg-gray-100 bg-opacity-95
                          ${openDropdown === idx ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
                        style={{
                          visibility: openDropdown === idx ? 'visible' : 'hidden',
                        }}
                      >
                          {group.links.map((link, linkIdx) => (
                            <Link
                              key={link.to}
                              to={link.to}
                            className="block px-4 py-2 text-gray-800 hover:bg-gray-200 text-sm whitespace-nowrap transition-colors duration-150"
                              tabIndex={0}
                              ref={el => dropdownRefs.current[linkIdx] = el}
                              onClick={() => {
                                setOpenDropdown(null);
                                setDropdownOpenedByClick(false);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setDropdownFocusIdx(i => (i + 1) % group.links.length);
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setDropdownFocusIdx(i => (i - 1 + group.links.length) % group.links.length);
                                } else if (e.key === 'Escape') {
                                  setOpenDropdown(null);
                                  setDropdownOpenedByClick(false);
                                } else if (e.key === 'Enter' || e.key === ' ') {
                                  e.currentTarget.click();
                                }
                              }}
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                    </div>
                  )
                ))}
                {/* Expenses as a single link */}
                <Link
                  to="/expenses"
                  className="text-gray-900 inline-flex items-center px-2 py-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium whitespace-nowrap"
                  onClick={() => {
                    setOpenDropdown(null);
                    setDropdownOpenedByClick(false);
                  }}
                >
                  Expenses
                </Link>
              </div>
              
                            {/* Desktop: Search Button */}
              <div className="hidden lg:flex items-center justify-end col-span-1 relative">
                <div className="relative group">
                  <button
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors duration-200"
                    aria-label="Search"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  
                  {/* Search Dropdown */}
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="p-4">
                      <QuickSearch 
                        onAdvancedSearch={(query) => {
                          setShowAdvancedSearch(true);
                          // The AdvancedSearch component will handle the query
                        }}
                        placeholder="Search invoices, bills, parties..."
                        appId={appId}
                        userId={user?.uid}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Desktop: User avatar/profile dropdown */}
              <div className="hidden lg:flex items-center justify-end col-span-1 relative" ref={avatarRef}>
                <button
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 border-2 border-white shadow focus:outline-none z-50"
                  onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
                  aria-label="User menu"
                  style={{ position: 'relative', top: '0.5rem' }}
                >
                  {companyDetails.logoUrl ? (
                    <img src={companyDetails.logoUrl} alt="Company Logo" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gray-700">{companyDetails.firmName ? companyDetails.firmName[0] : 'U'}</span>
                  )}
                </button>
                {avatarDropdownOpen && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 mt-0 pt-8 w-64 bg-white border border-gray-200 rounded shadow-lg z-40 flex flex-col items-center" style={{ minWidth: '16rem', top: '2.5rem' }}>
                    {/* Overlapping avatar on top of card */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow z-50">
                      {companyDetails.logoUrl ? (
                        <img src={companyDetails.logoUrl} alt="Company Logo" className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-gray-700">{companyDetails.firmName ? companyDetails.firmName[0] : 'U'}</span>
                      )}
                    </div>
                    <div className="pt-10 pb-2 px-4 w-full text-center">
                      <div className="font-bold text-base text-gray-900">{companyDetails.firmName || 'Company Name'}</div>
                      {companyDetails.email && <div className="text-xs text-gray-600">{companyDetails.email}</div>}
                    </div>
                    <div className="text-xs text-gray-700 space-y-1 mb-3 px-4 w-full text-left">
                      {companyDetails.gstin && <div><span className="font-semibold">GSTIN:</span> {companyDetails.gstin}</div>}
                      {companyDetails.address && <div><span className="font-semibold">Address:</span> {companyDetails.address}</div>}
                      {companyDetails.city && <div><span className="font-semibold">City:</span> {companyDetails.city}</div>}
                      {companyDetails.state && <div><span className="font-semibold">State:</span> {companyDetails.state}</div>}
                      {companyDetails.pincode && <div><span className="font-semibold">Pincode:</span> {companyDetails.pincode}</div>}
                      {companyDetails.contactNumber && <div><span className="font-semibold">Contact:</span> {companyDetails.contactNumber}</div>}
                    </div>
                    <div className="border-t border-gray-200 my-2 w-full"></div>
                            <button
          className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
          onClick={() => {
            setShowTour(true);
            setCurrentTourStep(0);
            setAvatarDropdownOpen(false);
          }}
        >
          Restart Tour
        </button>
        <button
          className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
          onClick={() => {
            setShowOnboarding(true);
            setAvatarDropdownOpen(false);
          }}
        >
          Restart Onboarding
        </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setShowHelp(true);
                        setAvatarDropdownOpen(false);
                      }}
                    >
                      Help & Support
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setShowNotificationSettings(true);
                        setAvatarDropdownOpen(false);
                      }}
                    >
                      🔔 Notification Settings
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setShowAdvancedSearch(true);
                        setAvatarDropdownOpen(false);
                      }}
                    >
                      🔍 Advanced Search
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setShowDataExport(true);
                        setAvatarDropdownOpen(false);
                      }}
                    >
                      📊 Export Data
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setShowVoiceCommands(true);
                        setAvatarDropdownOpen(false);
                      }}
                    >
                      🎤 Voice Commands
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setShowGestureControls(true);
                        setAvatarDropdownOpen(false);
                      }}
                    >
                      👆 Gesture Controls
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => signOut(auth)}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
              


            </div>
            
            {/* Mobile Layout */}
            <div className="lg:hidden flex items-center justify-between h-16 px-4">
              {/* Mobile Logo and Brand */}
              <div className="flex items-center">
                <Link to="/" className="flex items-center">
                  <img src={process.env.PUBLIC_URL + '/logolekhajokha.png'} alt="LekhaJokha Logo" style={{ height: 32 }} />
                  <span className="text-lg font-bold ml-2" style={{ color: '#003399' }}>
                    LEKHA<span style={{ color: '#ff8800' }}>JOKHA</span>
                  </span>
                </Link>
              </div>
              
              {/* Mobile Right Side - Search and Menu */}
              <div className="flex items-center space-x-3">
                {/* Mobile Search Button */}
                <div className="relative group">
                  <button
                    className="p-2 rounded-full bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center"
                    aria-label="Search"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  
                  {/* Mobile Search Dropdown */}
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="p-4">
                      <QuickSearch 
                        onAdvancedSearch={(query) => {
                          setShowAdvancedSearch(true);
                          // The AdvancedSearch component will handle the query
                        }}
                        placeholder="Search invoices, bills, parties..."
                        appId={appId}
                        userId={user?.uid}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Mobile Menu Button */}
                <button
                  ref={mobileMenuButtonRef}
                  className="p-2 rounded-full bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Mobile Menu */}
            <div 
              ref={mobileMenuRef}
              className="fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-white shadow-xl transform transition-transform duration-300 ease-in-out"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      {companyDetails.logoUrl ? (
                        <img src={companyDetails.logoUrl} alt="Company Logo" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-gray-700">{companyDetails.firmName ? companyDetails.firmName[0] : 'A'}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800">LekhaJokha</h2>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto py-4">
                  {navGroups.map((group, groupIdx) => (
                    <div key={group.label} className="mb-2">
                      {group.links.length === 1 ? (
                        // Single link - no dropdown needed
                        <Link
                          to={group.links[0].to}
                          className={`block px-4 py-3 transition-colors duration-150 border border-gray-200 rounded-lg ${
                            currentLocation.pathname === group.links[0].to
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setMobileOpenGroup(null);
                          }}
                        >
                          {group.links[0].label}
                        </Link>
                      ) : (
                        // Multiple links - use dropdown
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-150 ${
                              mobileOpenGroup === groupIdx 
                                ? 'bg-blue-50 text-blue-700 border-b border-blue-200' 
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            onClick={() => setMobileOpenGroup(mobileOpenGroup === groupIdx ? null : groupIdx)}
                            aria-expanded={mobileOpenGroup === groupIdx}
                            aria-haspopup="true"
                          >
                            <span className="font-medium">{group.label}</span>
                            <svg 
                              className={`w-4 h-4 transition-transform duration-200 ${
                                mobileOpenGroup === groupIdx ? 'rotate-180 text-blue-600' : 'text-gray-500'
                              }`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {/* Dropdown content */}
                          <div className={`overflow-hidden transition-all duration-200 bg-gray-50 ${
                            mobileOpenGroup === groupIdx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          }`}>
                            {group.links.map((link, linkIdx) => (
                              <Link
                                key={link.to}
                                to={link.to}
                                className={`block px-8 py-3 text-sm transition-colors duration-150 ${
                                  linkIdx === group.links.length - 1 ? '' : 'border-b border-gray-100'
                                } ${
                                  currentLocation.pathname === link.to
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                }`}
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                  setMobileOpenGroup(null);
                                }}
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Expenses as separate item */}
                  <div className="mb-2">
                    <Link
                      to="/expenses"
                      className={`block px-4 py-3 transition-colors duration-150 border border-gray-200 rounded-lg ${
                        currentLocation.pathname === '/expenses'
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileOpenGroup(null);
                      }}
                    >
                      Expenses
                    </Link>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4">
                          <button
          className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
          onClick={() => {
            setShowTour(true);
            setCurrentTourStep(0);
            setMobileMenuOpen(false);
          }}
        >
          Restart Tour
        </button>
        <button
          className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
          onClick={() => {
            setShowOnboarding(true);
            setMobileMenuOpen(false);
          }}
        >
          Restart Onboarding
        </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    onClick={() => {
                      setShowHelp(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    Help & Support
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    onClick={() => {
                      setShowNotificationSettings(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    🔔 Notification Settings
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    onClick={() => {
                      setShowAdvancedSearch(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    🔍 Advanced Search
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    onClick={() => {
                      setShowDataExport(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    📊 Export Data
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    onClick={() => {
                      setShowVoiceCommands(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    🎤 Voice Commands
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    onClick={() => {
                      signOut(auth);
                      setMobileMenuOpen(false);
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Add top padding to main content so it's not hidden behind navbar */}
        <GestureIntegration 
          gestureSettings={{
            swipeEnabled: true,
            pinchEnabled: true,
            longPressEnabled: true,
            doubleTapEnabled: true,
            hapticFeedback: true
          }}
          onGestureAction={handleGestureAction}
          enableGlobalGestures={true}
        >
          <div className="pt-24 md:pt-20 max-w-6xl mx-auto px-4">
            <Routes>
            <Route path="/" element={
              <Dashboard 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/items" element={
              <Items 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/parties" element={
              <Parties 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/sales" element={
              <Sales 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/purchases" element={
              <Purchases 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/payments" element={
              <Payments 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/manufacturing" element={
              <Manufacturing 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/reports" element={
              <Reports 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/taxes" element={
              <Taxes 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/bill-templates" element={
              <BillTemplates 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/company" element={
              <CompanyDetails 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
                onOpenWizard={() => setShowCompanyDetailsWizard(true)}
              />
            } />
            <Route path="/expenses" element={
              <Expenses 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
          </Routes>
        </div>
        </GestureIntegration>
      </div>
      
      {/* Offline Indicator */}
      <OfflineIndicator />
      
      {/* User Onboarding */}
      {showOnboarding && (
        <UserOnboarding 
          user={user}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      
      {/* Help & Support */}
      <HelpSupport 
        isVisible={showHelp}
        onClose={() => setShowHelp(false)}
      />
      
      {/* Notification Settings */}
      <NotificationSettings 
        userId={user?.uid}
        appId={appId}
        isVisible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
      
      {/* Advanced Search */}
      <AdvancedSearch 
        db={db}
        userId={user?.uid}
        appId={appId}
        isVisible={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
      />
      
      {/* Data Export */}
      <DataExport 
        db={db}
        userId={user?.uid}
        appId={appId}
        isVisible={showDataExport}
        onClose={() => setShowDataExport(false)}
      />
      
      {/* Voice Commands */}
      <VoiceCommands 
        isVisible={showVoiceCommands}
        onClose={() => setShowVoiceCommands(false)}
        onVoiceAction={(action) => {
          switch (action) {
            case 'search':
              setShowAdvancedSearch(true);
              break;
            case 'export':
              setShowDataExport(true);
              break;
            case 'help':
              setShowHelp(true);
              break;
            case 'settings':
              setShowNotificationSettings(true);
              break;
            default:
              console.log('Voice action:', action);
          }
        }}
      />
      
      {/* Gesture Controls */}
      <GestureControls 
        isVisible={showGestureControls}
        onClose={() => setShowGestureControls(false)}
        onGestureAction={handleGestureAction}
      />



      {/* Email Verification Modal */}
      {showEmailVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Email Verification Required</h3>
                          <p className="text-gray-600 mb-6 text-center">
                Please check your email ({auth.currentUser?.email || 'your email'}) and click the verification link to complete your registration.
              </p>
            <div className="flex justify-center space-x-2 mb-4">
              <button
                onClick={handleEmailVerificationCheck}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isVerifying}
              >
                {isVerifying ? 'Verifying...' : 'Check Verification Status'}
              </button>
              <button
                onClick={handleResendEmailVerification}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={resendTimer > 0}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Verification Email'}
              </button>
            </div>
            <div className="text-center">
              <button
                onClick={() => setShowEmailVerification(false)}
                className="text-gray-500 text-sm underline hover:text-gray-700"
              >
                Skip for now (Testing only)
              </button>
            </div>
            {verificationError && <div className="mt-4 text-red-600 text-sm text-center">{verificationError}</div>}
          </div>
        </div>
      )}

      {/* Phone Verification Modal */}
      {showPhoneVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Phone Verification Required</h3>
                          <p className="text-gray-600 mb-6 text-center">
                Please enter the verification code sent to your phone number ({auth.currentUser?.phoneNumber || 'your phone'}).
              </p>
            <div className="flex flex-col items-center mb-4">
              <input
                type="text"
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full border rounded p-2 mb-4"
                maxLength={6}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleSendPhoneVerification}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={resendTimer > 0}
                >
                  {resendTimer > 0 ? `Send in ${resendTimer}s` : 'Send Code'}
                </button>
                <button
                  onClick={handleVerifyPhone}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={isVerifying}
                >
                  {isVerifying ? 'Verifying...' : 'Verify Phone Number'}
                </button>
              </div>
            </div>
            <div className="text-center">
              <button
                onClick={() => setShowPhoneVerification(false)}
                className="text-gray-500 text-sm underline hover:text-gray-700"
              >
                Skip for now (Testing only)
              </button>
            </div>
            {verificationError && <div className="mt-4 text-red-600 text-sm text-center">{verificationError}</div>}
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetPasswordForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Reset Password</h3>
            <p className="text-gray-600 mb-6 text-center">
              Enter the reset code sent to your email ({resetEmail}) to reset your password.
            </p>
            <div className="flex flex-col items-center">
              <input
                type="text"
                placeholder="Enter reset code"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full border rounded p-2 mb-4"
                maxLength={6}
              />
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded p-2 mb-4"
                minLength={6}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full border rounded p-2 mb-4"
                minLength={6}
              />
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isVerifying}
              >
                {isVerifying ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
            {resetError && <div className="mt-4 text-red-600 text-sm text-center">{resetError}</div>}
            {resetSuccess && <div className="mt-4 text-green-600 text-sm text-center">Password reset successful!</div>}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
