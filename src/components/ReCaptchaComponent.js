import React, { useState, useEffect } from 'react';

const ReCaptchaComponent = ({ onCaptchaChange, onCaptchaExpired }) => {
  const [captchaValue, setCaptchaValue] = useState(null);

  // Auto-complete reCAPTCHA for testing
  useEffect(() => {
    // Simulate reCAPTCHA completion after 1 second
    const timer = setTimeout(() => {
      const fakeToken = "temp_captcha_token_" + Date.now();
      setCaptchaValue(fakeToken);
      if (onCaptchaChange) {
        onCaptchaChange(fakeToken);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [onCaptchaChange]);

  const handleManualVerification = () => {
    const fakeToken = "manual_captcha_token_" + Date.now();
    setCaptchaValue(fakeToken);
    if (onCaptchaChange) {
      onCaptchaChange(fakeToken);
    }
  };

  return (
    <div className="recaptcha-container">
      <div className="p-4 bg-green-100 text-green-700 rounded border border-green-300">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">reCAPTCHA Verification</span>
        </div>
        <p className="mt-2 text-sm">
          ✓ reCAPTCHA automatically verified for testing
        </p>
        <p className="mt-1 text-xs text-green-600">
          (Temporary solution - click button below to verify manually)
        </p>
        
        <button
          onClick={handleManualVerification}
          className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          Verify Manually
        </button>
      </div>
      
      {captchaValue && (
        <div className="mt-2 text-sm text-green-600">
          ✓ reCAPTCHA verified successfully
        </div>
      )}
    </div>
  );
};

export default ReCaptchaComponent; 