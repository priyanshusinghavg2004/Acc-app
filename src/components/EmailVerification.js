import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../firebase.config';

const EmailVerification = () => {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(location.search);
        const mode = urlParams.get('mode');
        const actionCode = urlParams.get('oobCode');
        const continueUrl = urlParams.get('continueUrl');
        const lang = urlParams.get('lang') || 'en';

        console.log('Email verification parameters:', { mode, actionCode, continueUrl, lang });
        console.log('Current URL:', window.location.href);

        // Handle the action based on the 'mode'
        if (mode === 'verifyEmail' && actionCode) {
          console.log('Applying action code:', actionCode);
          const resp = await applyActionCode(auth, actionCode);
          
          // Email address has been verified!
          setStatus('success');
          setMessage('✅ Email Verified Successfully! Your email address has been verified. You can now access all features of ACCTOO.');
          console.log("Email verified successfully!", resp);

          // Auto-redirect after 3 seconds
          setTimeout(() => {
            if (continueUrl) {
              window.location.href = continueUrl;
            } else {
              navigate('/');
            }
          }, 3000);

        } else {
          setStatus('error');
          setError('This verification link is not valid or has expired.');
          console.error("Invalid verification parameters:", { mode, actionCode });
        }
      } catch (error) {
        console.error("Error verifying email:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        setStatus('error');
        let errorMessage = 'The verification link may have expired or is invalid.';
        
        // Provide more specific error messages
        if (error.code === 'auth/invalid-action-code') {
          errorMessage = 'The verification link is invalid or has already been used.';
        } else if (error.code === 'auth/expired-action-code') {
          errorMessage = 'The verification link has expired. Please request a new verification email.';
        } else if (error.code === 'auth/user-disabled') {
          errorMessage = 'This account has been disabled. Please contact support.';
        } else if (error.code === 'auth/user-not-found') {
          errorMessage = 'No account found with this email address.';
        }
        
        setError(`${errorMessage} Error: ${error.message}`);
      }
    };

    handleVerification();
  }, [location, navigate]);

  const handleContinue = () => {
    navigate('/');
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">LEKHA<span className="text-orange-500">JOKHA</span></h1>
          <h2 className="text-xl font-semibold text-gray-700">Email Verification</h2>
        </div>

        {status === 'loading' && (
          <div className="mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="mb-6">
            <div className="text-green-500 text-4xl mb-4">✅</div>
            <p className="text-green-700 font-medium">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-6">
            <div className="text-red-500 text-4xl mb-4">❌</div>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleContinue}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Continue to App
          </button>
          <button
            onClick={handleClose}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification; 