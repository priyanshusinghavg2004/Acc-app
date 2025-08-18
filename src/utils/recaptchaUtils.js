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
    const loginWithCaptchaFunction = httpsCallable(functions, 'auth_loginWithCaptcha');
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

// Signup with reCAPTCHA verification
export const signupWithCaptcha = async (email, password, companyName, phone, captchaToken) => {
  try {
    const signupWithCaptchaFunction = httpsCallable(functions, 'auth_signupWithCaptcha');
    const result = await signupWithCaptchaFunction({ 
      email, 
      password, 
      companyName, 
      phone, 
      captchaToken 
    });
    return result.data;
  } catch (error) {
    console.error('Signup with captcha error:', error);
    throw new Error(error.message || 'Signup failed');
  }
};

// Send email verification
export const sendEmailVerification = async (email) => {
  try {
    const sendEmailVerificationFunction = httpsCallable(functions, 'auth_sendEmailVerification');
    const result = await sendEmailVerificationFunction({ email });
    return result.data;
  } catch (error) {
    console.error('Send email verification error:', error);
    throw new Error(error.message || 'Failed to send verification email');
  }
};

// Check email verification status
export const checkEmailVerification = async () => {
  try {
    const checkEmailVerificationFunction = httpsCallable(functions, 'auth_checkEmailVerification');
    const result = await checkEmailVerificationFunction({});
    return result.data;
  } catch (error) {
    console.error('Check email verification error:', error);
    throw new Error(error.message || 'Failed to check verification status');
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