import React, { useState } from 'react';
import ReCAPTCHA from "react-google-recaptcha";

const ReCaptchaComponent = ({ onCaptchaChange, onCaptchaExpired }) => {
  const [captchaValue, setCaptchaValue] = useState(null);

  const handleCaptchaChange = (value) => {
    setCaptchaValue(value);
    if (onCaptchaChange) {
      onCaptchaChange(value);
    }
  };

  const handleCaptchaExpired = () => {
    setCaptchaValue(null);
    if (onCaptchaExpired) {
      onCaptchaExpired();
    }
  };

  return (
    <div className="recaptcha-container">
      <ReCAPTCHA
        sitekey="6LeDvZcrAAAAAEeRXfF76iFIIxnSQ513Eb-doA_K"
        onChange={handleCaptchaChange}
        onExpired={handleCaptchaExpired}
        theme="light"
        size="normal"
      />
      {captchaValue && (
        <div className="mt-2 text-sm text-green-600">
          ✓ reCAPTCHA verified successfully
        </div>
      )}
    </div>
  );
};

export default ReCaptchaComponent; 