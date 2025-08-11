/**
 * Browser support utility functions
 * Checks for various browser capabilities and provides fallbacks
 */

export const browserSupport = {
  /**
   * Check if the browser supports Service Workers
   */
  hasServiceWorker: () => {
    return 'serviceWorker' in navigator;
  },

  /**
   * Check if the browser supports Push API
   */
  hasPushAPI: () => {
    return 'PushManager' in window;
  },

  /**
   * Check if the browser supports Notifications API
   */
  hasNotifications: () => {
    return 'Notification' in window;
  },

  /**
   * Check if the browser supports Firebase Messaging
   */
  hasFirebaseMessaging: () => {
    return browserSupport.hasServiceWorker() && 
           browserSupport.hasPushAPI() && 
           browserSupport.hasNotifications();
  },

  /**
   * Check if the browser supports IndexedDB
   */
  hasIndexedDB: () => {
    return 'indexedDB' in window;
  },

  /**
   * Check if the browser supports Local Storage
   */
  hasLocalStorage: () => {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Check if the browser supports Web Workers
   */
  hasWebWorkers: () => {
    return typeof Worker !== 'undefined';
  },

  /**
   * Get a comprehensive browser support report
   */
  getSupportReport: () => {
    return {
      serviceWorker: browserSupport.hasServiceWorker(),
      pushAPI: browserSupport.hasPushAPI(),
      notifications: browserSupport.hasNotifications(),
      firebaseMessaging: browserSupport.hasFirebaseMessaging(),
      indexedDB: browserSupport.hasIndexedDB(),
      localStorage: browserSupport.hasLocalStorage(),
      webWorkers: browserSupport.hasWebWorkers(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    };
  },

  /**
   * Log browser support information to console
   */
  logSupportInfo: () => {
    const report = browserSupport.getSupportReport();
    console.log('Browser Support Report:', report);
    
    if (!report.firebaseMessaging) {
      console.warn('Firebase Messaging not supported. Missing:', {
        serviceWorker: !report.serviceWorker,
        pushAPI: !report.pushAPI,
        notifications: !report.notifications
      });
    }
  }
};

export default browserSupport; 