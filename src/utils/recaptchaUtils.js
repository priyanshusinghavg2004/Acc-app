import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// Initialize Firebase Functions
const functions = getFunctions(getApp(), 'asia-south1');

// reCAPTCHA verification function
export const verifyCaptcha = async (captchaToken) => {
  try {
    const verifyCaptchaFunction = httpsCallable(functions, 'verifyCaptcha');
    const result = await verifyCaptchaFunction({ captchaToken });
    return result.data;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    throw new Error(error.message || 'reCAPTCHA verification failed');
  }
};

// Login with reCAPTCHA verification
export const loginWithCaptcha = async (email, password, captchaToken) => {
  try {
    const loginWithCaptchaFunction = httpsCallable(functions, 'loginWithCaptcha');
    const result = await loginWithCaptchaFunction({ 
      email, 
      password, 
      captchaToken 
    });
    return result.data;
  } catch (error) {
    console.error('Login with captcha error:', error);
    throw new Error(error.message || 'Login failed');
  }
};

// Utility to check if reCAPTCHA is loaded
export const isRecaptchaLoaded = () => {
  return typeof window !== 'undefined' && window.grecaptcha;
};

// Utility to reset reCAPTCHA
export const resetRecaptcha = (widgetId) => {
  if (isRecaptchaLoaded() && widgetId) {
    window.grecaptcha.reset(widgetId);
  }
}; 