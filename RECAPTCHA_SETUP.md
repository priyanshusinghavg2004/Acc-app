# reCAPTCHA Setup Guide

## आपने क्या किया है:

✅ **Google Cloud Console** में reCAPTCHA setup किया है  
✅ **Site Key** मिल गया है: `6LeDvZcrAAAAAEeRXfF76iFIIxnSQ513Eb-doA_K`  
✅ **Project ID**: `acc-app-e5316`  

## अब आपको क्या करना है:

### 1. **Secret Key प्राप्त करें**

Google Cloud Console में जाएं और **Secret Key** copy करें:
- [Google reCAPTCHA Console](https://console.cloud.google.com/security/recaptcha/6LeDvZcrAAAAAEeRXfF76iFIIxnSQ513Eb-doA_K/demo?authuser=0&cloudshell=true&hl=en-US&inv=1&invt=Ab4Yug&project=acc-app-e5316)

### 2. **Environment Variables Setup**

`.env` file में Secret Key add करें:

```env
REACT_APP_RECAPTCHA_SITE_KEY=6LeDvZcrAAAAAEeRXfF76iFIIxnSQ513Eb-doA_K
RECAPTCHA_SECRET_KEY=YOUR_SECRET_KEY_HERE
```

### 3. **Firebase Functions Deploy**

```bash
cd functions
firebase deploy --only functions
```

### 4. **React App में Test करें**

App.js में component import करें:

```javascript
import LoginFormWithFirebase from './components/LoginFormWithFirebase';

// App component में add करें
<LoginFormWithFirebase />
```

## Created Components:

### 📁 `src/components/ReCaptchaComponent.js`
- Basic reCAPTCHA component
- Site key integrated
- Success/expired handlers

### 📁 `src/components/LoginFormWithCaptcha.js`
- Demo login form with reCAPTCHA
- Frontend-only verification

### 📁 `src/components/LoginFormWithFirebase.js`
- Production-ready login form
- Firebase Functions integration
- Backend verification

### 📁 `src/utils/recaptchaUtils.js`
- Firebase Functions utilities
- reCAPTCHA verification functions

### 📁 `functions/index.js`
- Backend verification logic
- reCAPTCHA API integration
- Security middleware

## Testing:

1. **Frontend Test**: `LoginFormWithCaptcha` component
2. **Backend Test**: `LoginFormWithFirebase` component
3. **API Test**: Firebase Functions console

## Security Features:

✅ **reCAPTCHA v2** integration  
✅ **Backend verification** via Firebase Functions  
✅ **Score-based validation** (for v3)  
✅ **Error handling** and logging  
✅ **CORS enabled** for cross-origin requests  

## Next Steps:

1. **Secret Key** add करें
2. **Firebase Functions** deploy करें
3. **Production domain** whitelist करें
4. **Error monitoring** setup करें

## Troubleshooting:

- **reCAPTCHA not loading**: Check site key and domain whitelist
- **Verification failed**: Check secret key and network connectivity
- **CORS errors**: Ensure Firebase Functions CORS is enabled

## Support:

- [Google reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [React reCAPTCHA Library](https://github.com/dozoisch/react-google-recaptcha) 