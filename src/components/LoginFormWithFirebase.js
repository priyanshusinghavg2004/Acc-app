import React, { useState } from 'react';
import ReCaptchaComponent from './ReCaptchaComponent';
import { loginWithCaptcha } from '../utils/recaptchaUtils';

const LoginFormWithFirebase = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [captchaToken, setCaptchaToken] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
    setMessage('');
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
    setMessage('reCAPTCHA expired. Please verify again.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!captchaToken) {
      setMessage('Please complete the reCAPTCHA verification.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // Call Firebase Function for login with reCAPTCHA verification
      const result = await loginWithCaptcha(
        formData.email, 
        formData.password, 
        captchaToken
      );
      
      setMessage(`Login successful! Captcha Score: ${result.captchaScore}`);
      
      // Here you would typically handle successful login
      // e.g., store user token, redirect, etc.
      console.log('Login result:', result);
      
    } catch (error) {
      setMessage(`Login failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Login with reCAPTCHA & Firebase
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your password"
          />
        </div>

        <div className="flex justify-center">
          <ReCaptchaComponent
            onCaptchaChange={handleCaptchaChange}
            onCaptchaExpired={handleCaptchaExpired}
          />
        </div>

        {message && (
          <div className={`text-sm p-3 rounded-md ${
            message.includes('successful') 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !captchaToken}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            isSubmitting || !captchaToken
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? 'Logging in...' : 'Login with reCAPTCHA'}
        </button>
      </form>

      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>This form uses Google reCAPTCHA v2 for security</p>
        <p>Site Key: 6LeDvZcrAAAAAEeRXfF76iFIIxnSQ513Eb-doA_K</p>
      </div>
    </div>
  );
};

export default LoginFormWithFirebase; 