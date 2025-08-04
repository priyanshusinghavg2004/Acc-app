import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase.config';

const Settings = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('mpin');
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [mpinError, setMpinError] = useState('');
  const [mpinSuccess, setMpinSuccess] = useState('');
  const [isMpinSet, setIsMpinSet] = useState(false);
  
  // MPIN change security states
  const [showCurrentMpinModal, setShowCurrentMpinModal] = useState(false);
  const [currentMpin, setCurrentMpin] = useState('');
  const [currentMpinError, setCurrentMpinError] = useState('');
  const [showForgotMpinModal, setShowForgotMpinModal] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState(''); // 'email', 'mobile', 'google'
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  


  useEffect(() => {
    loadUserSettings();
  }, []);



  const loadUserSettings = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsMpinSet(!!userData.mpin);
      }


    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const handleMpinSubmit = async (e) => {
    e.preventDefault();
    setMpinError('');
    setMpinSuccess('');

    console.log('Setting MPIN...', { mpin, confirmMpin, userId: auth.currentUser?.uid });

    // Validation
    if (!mpin || mpin.length !== 4) {
      setMpinError('MPIN must be exactly 4 digits');
      return;
    }

    if (!/^\d+$/.test(mpin)) {
      setMpinError('MPIN must contain only numbers');
      return;
    }

    if (mpin !== confirmMpin) {
      setMpinError('MPIN and confirmation do not match');
      return;
    }

    // If MPIN is already set, require current MPIN verification
    if (isMpinSet) {
      setShowCurrentMpinModal(true);
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setMpinError('User not authenticated');
        return;
      }

      console.log('User authenticated:', userId);

      // Hash the MPIN (in production, use proper hashing)
      const hashedMpin = btoa(mpin); // Simple encoding for demo
      console.log('Hashed MPIN:', hashedMpin);

      // Check if user document exists, if not create it
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      console.log('User document exists:', userDoc.exists());
      
      if (userDoc.exists()) {
        // Update existing document
        console.log('Updating existing user document...');
        await updateDoc(userDocRef, {
          mpin: hashedMpin,
          mpinSetAt: new Date()
        });
      } else {
        // Create new document
        console.log('Creating new user document...');
        await setDoc(userDocRef, {
          mpin: hashedMpin,
          mpinSetAt: new Date(),
          email: auth.currentUser.email,
          createdAt: new Date()
        });
      }

      setMpinSuccess('MPIN set successfully!');
      setIsMpinSet(true);
      setMpin('');
      setConfirmMpin('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setMpinSuccess(''), 3000);
    } catch (error) {
      console.error('Error setting MPIN:', error);
      setMpinError(`Failed to set MPIN: ${error.message}`);
    }
  };

  // Verify current MPIN before allowing change
  const handleCurrentMpinSubmit = async (e) => {
    e.preventDefault();
    setCurrentMpinError('');

    if (!currentMpin || currentMpin.length !== 4) {
      setCurrentMpinError('Please enter your current 4-digit MPIN');
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setCurrentMpinError('User not authenticated');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        setCurrentMpinError('User data not found');
        return;
      }

      const userData = userDoc.data();
      const storedMpin = userData.mpin;

      if (!storedMpin) {
        setCurrentMpinError('No MPIN found. Please set a new MPIN.');
        return;
      }

      // Verify current MPIN
      const hashedInput = btoa(currentMpin);
      if (hashedInput === storedMpin) {
        // Current MPIN is correct, proceed with setting new MPIN
        setShowCurrentMpinModal(false);
        setCurrentMpin('');
        setCurrentMpinError('');
        await setNewMpin();
      } else {
        setCurrentMpinError('Incorrect current MPIN');
        setCurrentMpin('');
      }
    } catch (error) {
      console.error('Error verifying current MPIN:', error);
      setCurrentMpinError('Error verifying MPIN. Please try again.');
    }
  };

  // Handle forgot MPIN
  const handleForgotMpin = () => {
    setShowCurrentMpinModal(false);
    setShowForgotMpinModal(true);
    setVerificationMethod('');
    setVerificationCode('');
    setVerificationError('');
  };

  // Send verification code
  const handleSendVerificationCode = async (method) => {
    setVerificationMethod(method);
    setIsVerifying(true);
    setVerificationError('');

    try {
      // In a real app, you would send verification codes here
      // For demo purposes, we'll simulate this
      console.log(`Sending verification code via ${method}...`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo, we'll use a fixed code: 123456
      alert(`Verification code sent to your ${method}. Demo code: 123456`);
      
    } catch (error) {
      console.error('Error sending verification code:', error);
      setVerificationError('Failed to send verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Verify code and allow MPIN change
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setVerificationError('');

    if (!verificationCode || verificationCode.length !== 6) {
      setVerificationError('Please enter the 6-digit verification code');
      return;
    }

    try {
      // In a real app, you would verify the code with your backend
      // For demo purposes, we'll accept the code 123456
      if (verificationCode === '123456') {
        setShowForgotMpinModal(false);
        setVerificationCode('');
        setVerificationError('');
        await setNewMpin();
      } else {
        setVerificationError('Incorrect verification code');
        setVerificationCode('');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      setVerificationError('Error verifying code. Please try again.');
    }
  };

  // Set new MPIN (extracted from original function)
  const setNewMpin = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setMpinError('User not authenticated');
        return;
      }

      console.log('User authenticated:', userId);

      // Hash the MPIN (in production, use proper hashing)
      const hashedMpin = btoa(mpin); // Simple encoding for demo
      console.log('Hashed MPIN:', hashedMpin);

      // Check if user document exists, if not create it
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      console.log('User document exists:', userDoc.exists());
      
      if (userDoc.exists()) {
        // Update existing document
        console.log('Updating existing user document...');
        await updateDoc(userDocRef, {
          mpin: hashedMpin,
          mpinSetAt: new Date()
        });
      } else {
        // Create new document
        console.log('Creating new user document...');
        await setDoc(userDocRef, {
          mpin: hashedMpin,
          mpinSetAt: new Date(),
          email: auth.currentUser.email,
          createdAt: new Date()
        });
      }

      setMpinSuccess('MPIN set successfully!');
      setIsMpinSet(true);
      setMpin('');
      setConfirmMpin('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setMpinSuccess(''), 3000);
    } catch (error) {
      console.error('Error setting MPIN:', error);
      setMpinError(`Failed to set MPIN: ${error.message}`);
    }
  };











  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('mpin')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'mpin'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔐 MPIN Settings
          </button>
          
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {activeTab === 'mpin' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">MPIN Security</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set a 4-digit MPIN for additional security. This will be required for sensitive operations.
                </p>
              </div>

              {isMpinSet && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-800 font-medium">MPIN is already set</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleMpinSubmit} className="space-y-4">
                <div>
                  <label htmlFor="mpin" className="block text-sm font-medium text-gray-700 mb-1">
                    Enter 4-digit MPIN
                  </label>
                  <input
                    type="password"
                    id="mpin"
                    value={mpin}
                    onChange={(e) => setMpin(e.target.value)}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter 4 digits"
                  />
                </div>

                <div>
                  <label htmlFor="confirmMpin" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm MPIN
                  </label>
                  <input
                    type="password"
                    id="confirmMpin"
                    value={confirmMpin}
                    onChange={(e) => setConfirmMpin(e.target.value)}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm 4 digits"
                  />
                </div>

                {mpinError && (
                  <div className="text-red-600 text-sm">{mpinError}</div>
                )}

                {mpinSuccess && (
                  <div className="text-green-600 text-sm">{mpinSuccess}</div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Set MPIN
                </button>
              </form>
            </div>
          )}

          
        </div>
      </div>

      {/* Current MPIN Verification Modal */}
      {showCurrentMpinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Verify Current MPIN</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please enter your current MPIN to change it.
              </p>
              
              <form onSubmit={handleCurrentMpinSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={currentMpin}
                    onChange={(e) => setCurrentMpin(e.target.value)}
                    maxLength={4}
                    className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••"
                    autoFocus
                  />
                </div>
                
                {currentMpinError && (
                  <div className="text-red-600 text-sm">{currentMpinError}</div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCurrentMpinModal(false);
                      setCurrentMpin('');
                      setCurrentMpinError('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </form>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleForgotMpin}
                  className="text-blue-600 text-sm hover:text-blue-700 underline"
                >
                  Forgot MPIN?
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot MPIN Modal */}
      {showForgotMpinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Forgot MPIN?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Choose a verification method to reset your MPIN.
              </p>
              
              {!verificationMethod ? (
                <div className="space-y-3">
                  <button
                    onClick={() => handleSendVerificationCode('email')}
                    disabled={isVerifying}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Sending...' : '📧 Send Code via Email'}
                  </button>
                  <button
                    onClick={() => handleSendVerificationCode('mobile')}
                    disabled={isVerifying}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Sending...' : '📱 Send Code via SMS'}
                  </button>
                  <button
                    onClick={() => handleSendVerificationCode('google')}
                    disabled={isVerifying}
                    className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Verifying...' : '🔐 Verify with Google'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowForgotMpinModal(false);
                      setVerificationMethod('');
                      setVerificationCode('');
                      setVerificationError('');
                    }}
                    className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Enter the 6-digit code sent to your {verificationMethod}
                    </p>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      className="w-full px-4 py-3 text-center text-xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456"
                      autoFocus
                    />
                  </div>
                  
                  {verificationError && (
                    <div className="text-red-600 text-sm">{verificationError}</div>
                  )}
                  
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationMethod('');
                        setVerificationCode('');
                        setVerificationError('');
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Verify Code
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 