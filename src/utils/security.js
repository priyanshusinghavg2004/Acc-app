// Security Utilities for Manufacturing App

// Input Validation
export const validateInput = (input, type = 'string') => {
  if (!input) return false;
  
  switch (type) {
    case 'string':
      return typeof input === 'string' && input.trim().length > 0;
    case 'number':
      return !isNaN(input) && input > 0;
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(input);
    case 'phone':
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return phoneRegex.test(input.replace(/\s/g, ''));
    default:
      return true;
  }
};

// XSS Prevention
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Rate Limiting (Client-side)
class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
}

export const apiRateLimiter = new RateLimiter(20, 60000); // 20 requests per minute

// Data Encryption (for sensitive data)
export const encryptData = (data) => {
  // Simple base64 encoding for demonstration
  // In production, use proper encryption libraries
  return btoa(JSON.stringify(data));
};

export const decryptData = (encryptedData) => {
  try {
    return JSON.parse(atob(encryptedData));
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return null;
  }
};

// Session Management
export const validateSession = () => {
  const token = localStorage.getItem('authToken');
  const expiry = localStorage.getItem('tokenExpiry');
  
  if (!token || !expiry) {
    return false;
  }
  
  if (Date.now() > parseInt(expiry)) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiry');
    return false;
  }
  
  return true;
};

// CSRF Protection
export const generateCSRFToken = () => {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessionStorage.setItem('csrfToken', token);
  return token;
};

export const validateCSRFToken = (token) => {
  const storedToken = sessionStorage.getItem('csrfToken');
  return token === storedToken;
};

// Audit Logging
export const logSecurityEvent = (event, details) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  console.log('Security Event:', logEntry);
  
  // In production, send to your logging service
  // Example: sendToLoggingService(logEntry);
};

// Input Sanitization for Manufacturing Data
export const sanitizeManufacturingData = (data) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'number') {
      sanitized[key] = validateInput(value, 'number') ? value : 0;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeManufacturingData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Export all security utilities
export default {
  validateInput,
  sanitizeInput,
  apiRateLimiter,
  encryptData,
  decryptData,
  validateSession,
  generateCSRFToken,
  validateCSRFToken,
  logSecurityEvent,
  sanitizeManufacturingData
}; 