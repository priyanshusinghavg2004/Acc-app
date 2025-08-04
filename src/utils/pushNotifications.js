import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

class PushNotificationManager {
  constructor() {
    this.messaging = null;
    this.isSupported = false;
    this.permission = 'default';
    this.token = null;
    this.listeners = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Check if Firebase Messaging is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return false;
      }

      // Initialize Firebase Messaging
      this.messaging = getMessaging();
      this.isSupported = true;

      // Check permission
      this.permission = await this.checkPermission();
      
      if (this.permission === 'granted') {
        await this.getToken();
        this.setupMessageListener();
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }

  async checkPermission() {
    if (!this.isSupported) return 'denied';

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return 'denied';
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === 'granted') {
        await this.getToken();
        this.setupMessageListener();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async getToken() {
    if (!this.messaging) {
      console.warn('Messaging not initialized');
      return null;
    }

    try {
      // Check if VAPID key is available
      const vapidKey = process.env.REACT_APP_FCM_VAPID_KEY;
      if (!vapidKey) {
        console.warn('FCM VAPID key not configured. Push notifications may not work properly.');
        // Try to get token without VAPID key (may work in some cases)
        const token = await getToken(this.messaging);
        this.token = token;
        console.log('FCM Token (without VAPID):', token);
        return token;
      }

      const token = await getToken(this.messaging, {
        vapidKey: vapidKey
      });

      this.token = token;
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      
      // Handle specific error cases
      if (error.code === 'messaging/failed-service-worker-registration') {
        console.warn('Service worker registration failed. This is normal in development or when HTTPS is not available.');
      } else if (error.code === 'installations/request-failed') {
        console.warn('Firebase installation request failed. This may be due to network issues or configuration problems.');
      }
      
      return null;
    }
  }

  setupMessageListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Message received:', payload);
      this.showNotification(payload);
    });
  }

  showNotification(payload) {
    const { notification, data } = payload;
    
    if (!notification) return;

    const options = {
      body: notification.body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: data?.tag || 'default',
      data: data || {},
      requireInteraction: data?.requireInteraction === 'true',
      actions: data?.actions ? JSON.parse(data.actions) : undefined,
      silent: data?.silent === 'true'
    };

    // Show browser notification
    if (this.permission === 'granted') {
      const browserNotification = new Notification(notification.title, options);
      
      browserNotification.onclick = (event) => {
        event.preventDefault();
        this.handleNotificationClick(data);
        browserNotification.close();
      };

      // Auto close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          browserNotification.close();
        }, 5000);
      }
    }

    // Also show in-app notification
    this.showInAppNotification(notification, data);
  }

  showInAppNotification(notification, data) {
    // Create custom in-app notification
    const notificationElement = document.createElement('div');
    notificationElement.className = 'fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border-l-4 border-blue-500 p-4 max-w-sm transform transition-all duration-300 translate-x-full';
    notificationElement.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-medium text-gray-900">${notification.title}</h4>
          <p class="text-sm text-gray-600 mt-1">${notification.body}</p>
        </div>
        <button class="flex-shrink-0 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notificationElement);

    // Animate in
    setTimeout(() => {
      notificationElement.classList.remove('translate-x-full');
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notificationElement.classList.add('translate-x-full');
      setTimeout(() => {
        if (notificationElement.parentElement) {
          notificationElement.remove();
        }
      }, 300);
    }, 5000);
  }

  handleNotificationClick(data) {
    // Handle notification click based on data
    if (data?.route) {
      // Navigate to specific route
      window.location.hash = data.route;
    }

    if (data?.action) {
      // Trigger specific action
      this.triggerAction(data.action, data);
    }

    // Focus the window
    window.focus();
  }

  triggerAction(action, data) {
    // Trigger custom actions based on notification data
    switch (action) {
      case 'refresh':
        window.location.reload();
        break;
      case 'open_modal':
        // Trigger custom event for opening modals
        window.dispatchEvent(new CustomEvent('openModal', { detail: data }));
        break;
      case 'sync_data':
        // Trigger data sync
        window.dispatchEvent(new CustomEvent('syncData', { detail: data }));
        break;
      default:
        console.log('Unknown action:', action);
    }
  }

  async saveTokenToFirebase(userId, appId) {
    if (!this.token || !userId) return;

    try {
      const userDoc = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'notifications');
      await setDoc(userDoc, {
        fcmToken: this.token,
        enabled: true,
        lastUpdated: new Date(),
        permissions: {
          sales: true,
          purchases: true,
          payments: true,
          reports: true,
          system: true
        }
      });
      console.log('FCM token saved to Firebase');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  async updateNotificationSettings(userId, appId, settings) {
    try {
      const userDoc = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'notifications');
      await updateDoc(userDoc, {
        ...settings,
        lastUpdated: new Date()
      });
      console.log('Notification settings updated');
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  async getNotificationSettings(userId, appId) {
    try {
      const userDoc = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'notifications');
      const docSnap = await getDoc(userDoc);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      // Return default settings
      return {
        enabled: true,
        permissions: {
          sales: true,
          purchases: true,
          payments: true,
          reports: true,
          system: true
        }
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }

  // Test notification
  async sendTestNotification() {
    if (this.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const testNotification = {
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from ACCTOO'
      },
      data: {
        tag: 'test',
        route: '/dashboard'
      }
    };

    this.showNotification(testNotification);
  }

  // Subscribe to specific topics
  async subscribeToTopic(topic) {
    // This would typically be done on the server side
    // For now, we'll just log the subscription
    console.log(`Subscribing to topic: ${topic}`);
  }

  // Unsubscribe from specific topics
  async unsubscribeFromTopic(topic) {
    // This would typically be done on the server side
    // For now, we'll just log the unsubscription
    console.log(`Unsubscribing from topic: ${topic}`);
  }

  // Get current status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isInitialized: this.isInitialized,
      permission: this.permission,
      hasToken: !!this.token,
      token: this.token
    };
  }

  // Cleanup
  destroy() {
    this.listeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener();
      }
    });
    this.listeners = [];
  }
}

// Create singleton instance
const pushNotificationManager = new PushNotificationManager();

export default pushNotificationManager; 