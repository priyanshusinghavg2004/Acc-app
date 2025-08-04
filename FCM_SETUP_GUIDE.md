# Firebase Cloud Messaging (FCM) Setup Guide

## Issues Fixed

### 1. jsPDF AutoTable Issue
- **Problem**: `jspdf-autotable not available, using fallback PDF generation`
- **Solution**: Updated CDN links to compatible versions and improved jsPDF initialization

### 2. Service Worker Cache Issue
- **Problem**: `Failed to execute 'put' on 'Cache': Request scheme 'chrome-extension' is unsupported`
- **Solution**: Added check to skip caching chrome-extension URLs

### 3. Firebase FCM Issues
- **Problem**: Missing VAPID key and service worker registration failures
- **Solution**: Added proper error handling and VAPID key configuration

## Setup Instructions

### 1. Get Firebase VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`acc-app-e5316`)
3. Go to **Project Settings** (gear icon)
4. Click on **Cloud Messaging** tab
5. Scroll down to **Web Push certificates**
6. Click **Generate Key Pair** if you don't have one
7. Copy the **Key pair** (this is your VAPID key)

### 2. Configure Environment Variables

Create a `.env` file in your project root with:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=AIzaSyDrx0Sxs0yoJHUahGB59ojOEulPfNd57_Y
REACT_APP_FIREBASE_AUTH_DOMAIN=acc-app-e5316.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=acc-app-e5316
REACT_APP_FIREBASE_STORAGE_BUCKET=acc-app-e5316.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=447193481869
REACT_APP_FIREBASE_APP_ID=acc-app-e5316

# Firebase Cloud Messaging (FCM) Configuration
REACT_APP_FCM_VAPID_KEY=YOUR_VAPID_KEY_HERE

# App Configuration
REACT_APP_ENVIRONMENT=development
REACT_APP_API_URL=https://asia-south1-acc-app-e5316.cloudfunctions.net/api

# Security Configuration
REACT_APP_ENABLE_RATE_LIMITING=true
REACT_APP_MAX_REQUESTS_PER_MINUTE=60
REACT_APP_ENABLE_AUDIT_LOGGING=true

# Feature Flags
REACT_APP_ENABLE_MANUFACTURING=true
REACT_APP_ENABLE_PAYMENTS=true
REACT_APP_ENABLE_REPORTS=true
```

### 3. Test FCM Setup

1. **Development**: FCM may not work in development due to HTTPS requirements
2. **Production**: Deploy to HTTPS and test push notifications
3. **Local Testing**: Use Firebase emulators for testing

### 4. Verify Service Worker Registration

Check browser console for:
- ✅ `SW registered: ServiceWorkerRegistration`
- ✅ `[firebase-messaging-sw.js] Service Worker installed`
- ✅ `[firebase-messaging-sw.js] Service Worker activated`

### 5. Test PDF Generation

1. Go to Reports or Payments section
2. Try exporting to PDF
3. Check console for: `AutoTable plugin status: function`

## Troubleshooting

### FCM Token Issues

If you see `Error getting FCM token`:

1. **Check VAPID Key**: Ensure `REACT_APP_FCM_VAPID_KEY` is set correctly
2. **HTTPS Required**: FCM requires HTTPS in production
3. **Service Worker**: Ensure `firebase-messaging-sw.js` is accessible at root
4. **Browser Support**: Check if browser supports service workers

### PDF Generation Issues

If PDF export fails:

1. **Check jsPDF**: Ensure jsPDF is loaded from CDN
2. **AutoTable Plugin**: Verify autoTable plugin is attached
3. **Fallback**: The app will use fallback PDF generation if autoTable fails

### Service Worker Issues

If service worker fails:

1. **Clear Cache**: Clear browser cache and reload
2. **Check Registration**: Verify service worker is registered
3. **HTTPS**: Service workers require HTTPS (except localhost)

## Development vs Production

### Development
- FCM may not work due to HTTPS requirements
- Use Firebase emulators for testing
- Service workers work on localhost

### Production
- Deploy to HTTPS domain
- Configure VAPID key
- Test push notifications thoroughly

## Files Modified

1. `public/index.html` - Updated jsPDF CDN links
2. `src/components/Reports.js` - Improved jsPDF initialization
3. `src/components/Payments.js` - Fixed autoTable loading
4. `public/sw.js` - Added chrome-extension URL filtering
5. `src/utils/pushNotifications.js` - Added VAPID key handling
6. `public/firebase-messaging-sw.js` - Updated Firebase version
7. `env.example` - Added FCM configuration example

## Next Steps

1. Add your VAPID key to `.env` file
2. Test in production environment
3. Implement push notification features
4. Monitor FCM token generation
5. Set up notification topics if needed 