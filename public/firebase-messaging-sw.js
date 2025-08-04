// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrx0Sxs0yoJHUahGB59ojOEulPfNd57_Y",
  authDomain: "acc-app-e5316.firebaseapp.com",
  projectId: "acc-app-e5316",
  storageBucket: "acc-app-e5316.firebasestorage.app",
  messagingSenderId: "447193481869",
  appId: "acc-app-e5316",
  measurementId: "G-PLY7P9M3F8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
      const notificationTitle = payload.notification.title || 'ACCTOO';
  const notificationOptions = {
    body: payload.notification.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data || {},
    requireInteraction: payload.data?.requireInteraction === 'true',
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : undefined,
    silent: payload.data?.silent === 'true'
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  // Handle notification click based on data
  const data = event.notification.data;
  
  if (data?.route) {
    // Navigate to specific route
    event.waitUntil(
      clients.openWindow(`${self.location.origin}${data.route}`)
    );
  } else if (data?.action) {
    // Handle specific actions
    switch (data.action) {
      case 'refresh':
        event.waitUntil(
          clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'refresh' }));
          })
        );
        break;
      case 'open_modal':
        event.waitUntil(
          clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ 
              type: 'openModal', 
              data: data 
            }));
          })
        );
        break;
      case 'sync_data':
        event.waitUntil(
          clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ 
              type: 'syncData', 
              data: data 
            }));
          })
        );
        break;
      default:
        // Default: focus existing window or open new one
        event.waitUntil(
          clients.matchAll({ type: 'window' }).then(windowClients => {
            if (windowClients.length > 0) {
              windowClients[0].focus();
            } else {
              clients.openWindow('/');
            }
          })
        );
    }
  } else {
    // Default: focus existing window or open new one
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        if (windowClients.length > 0) {
          windowClients[0].focus();
        } else {
          clients.openWindow('/');
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event.notification.tag);
});

// Handle push event (fallback for older browsers)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);
  
  if (event.data) {
    try {
      const payload = event.data.json();
      const notificationTitle = payload.notification?.title || 'ACCTOO';
      const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: payload.data?.tag || 'default',
        data: payload.data || {},
        requireInteraction: payload.data?.requireInteraction === 'true',
        actions: payload.data?.actions ? JSON.parse(payload.data.actions) : undefined,
        silent: payload.data?.silent === 'true'
      };

      event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
      );
    } catch (error) {
      console.error('[firebase-messaging-sw.js] Error parsing push data:', error);
    }
  }
});

// Handle install event
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installed');
  self.skipWaiting();
});

// Handle activate event
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle message events from main thread
self.addEventListener('message', (event) => {
  console.log('[firebase-messaging-sw.js] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 