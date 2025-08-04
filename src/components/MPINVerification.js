import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase.config';

const MPINVerification = ({ onSuccess, onCancel, onGoToSettings, title = "Enter MPIN", message = "Please enter your 4-digit MPIN to continue" }) => {
  const [mpin, setMpin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isMpinSet, setIsMpinSet] = useState(false);

  useEffect(() => {
    checkMpinStatus();
  }, []);

  const checkMpinStatus = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsMpinSet(!!userData.mpin);
      }
    } catch (error) {
      console.error('Error checking MPIN status:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    if (!mpin || mpin.length !== 4) {
      setError('Please enter a 4-digit MPIN');
      setIsVerifying(false);
      return;
    }

    if (!/^\d+$/.test(mpin)) {
      setError('MPIN must contain only numbers');
      setIsVerifying(false);
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setError('User not authenticated');
        setIsVerifying(false);
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        setError('User data not found');
        setIsVerifying(false);
        return;
      }

      const userData = userDoc.data();
      const storedMpin = userData.mpin;

      if (!storedMpin) {
        setError('MPIN not set. Please set your MPIN in Settings first.');
        setIsVerifying(false);
        return;
      }

      // Verify MPIN (simple comparison for demo - use proper hashing in production)
      const hashedInput = btoa(mpin);
      if (hashedInput === storedMpin) {
        onSuccess();
      } else {
        setError('Incorrect MPIN. Please try again.');
        setMpin('');
      }
    } catch (error) {
      console.error('Error verifying MPIN:', error);
      setError('Error verifying MPIN. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e) => {
    // Only allow numbers
    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab') {
      e.preventDefault();
    }
  };

  if (!isMpinSet) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">MPIN Not Set</h3>
            <p className="text-sm text-gray-600 mb-4">
              You need to set up your MPIN first before you can use this feature.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onCancel();
                  if (onGoToSettings) {
                    onGoToSettings();
                  }
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-6">{message}</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={mpin}
                onChange={(e) => setMpin(e.target.value)}
                onKeyPress={handleKeyPress}
                maxLength={4}
                className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••"
                autoFocus
                disabled={isVerifying}
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                disabled={isVerifying}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isVerifying || mpin.length !== 4}
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MPINVerification; 