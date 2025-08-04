# Firebase Email Verification Setup Guide

## Firebase Console Configuration

### 1. Authentication Settings

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select Your Project**: `acc-app-e5316`
3. **Navigate to Authentication**: Left sidebar > Authentication
4. **Go to Settings**: Click the gear icon (⚙️) next to "Authentication"

### 2. Authorized Domains

1. **Check Authorized Domains**: In Settings > Authorized domains
2. **Add Your Domains**:
   - `localhost` (for development)
   - `acc-app-e5316.firebaseapp.com` (Firebase hosting)
   - Your custom domain (if any)

### 3. Email Templates

1. **Go to Templates**: Authentication > Templates
2. **Email Verification Template**:
   - Click "Email verification"
   - **Subject**: Customize the email subject
   - **Message**: Customize the email content
   - **Action URL**: Should be `https://acc-app-e5316.firebaseapp.com/complete-verification.html`

### 4. Email Sending Configuration

1. **Sender Email**: 
   - Default: `noreply@acc-app-e5316.firebaseapp.com`
   - Custom: You can set up a custom sender email

2. **Email Verification Settings**:
   - **Enable Email Verification**: Should be ON
   - **Email Link Expiration**: Default is 24 hours
   - **Action URL**: Set to your verification page

### 5. Security Rules

Ensure your Firestore security rules allow email verification:

```javascript
// In firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to update their own verification status
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow verification code operations
    match /verificationCodes/{codeId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Testing Email Verification

### 1. Test User Registration

```javascript
// In browser console
const testEmailVerification = async () => {
  try {
    // Create test user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      'test@example.com', 
      'password123'
    );
    
    console.log('User created:', userCredential.user);
    
    // Send verification email
    const result = await sendVerificationEmail(userCredential.user);
    console.log('Verification email result:', result);
    
    return userCredential.user;
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2. Check Email Delivery

1. **Check Inbox**: Look for email from `noreply@acc-app-e5316.firebaseapp.com`
2. **Check Spam**: Firebase emails often go to spam folder
3. **Email Content**: Should contain verification link

### 3. Test Verification Link

1. **Click Link**: Open the verification link in browser
2. **Check Console**: Look for verification logs
3. **Verify Status**: Check if user.emailVerified becomes true

## Common Configuration Issues

### 1. Domain Not Authorized

**Error**: "Unauthorized domain"
**Solution**: Add domain to Firebase Console > Authentication > Settings > Authorized domains

### 2. Email Templates Not Configured

**Error**: Generic email content
**Solution**: Customize email templates in Firebase Console > Authentication > Templates

### 3. Action URL Mismatch

**Error**: Verification link doesn't work
**Solution**: Ensure action URL in email template matches your verification page URL

### 4. Firebase SDK Version Mismatch

**Error**: Verification page errors
**Solution**: Use consistent Firebase SDK versions across all files

## Monitoring and Debugging

### 1. Firebase Console Logs

1. **Go to Functions**: Firebase Console > Functions > Logs
2. **Check Authentication Logs**: Look for email sending events
3. **Monitor Errors**: Check for failed email deliveries

### 2. Browser Console Logs

```javascript
// Enable detailed logging
localStorage.setItem('debug', 'firebase:*');

// Check verification status
auth.currentUser.reload().then(() => {
  console.log('Email verified:', auth.currentUser.emailVerified);
});
```

### 3. Network Tab

1. **Open Developer Tools**: F12
2. **Go to Network Tab**: Monitor network requests
3. **Check Firebase Requests**: Look for authentication API calls

## Production Considerations

### 1. Custom Domain

1. **Set up Custom Domain**: In Firebase Console > Hosting
2. **Update Authorized Domains**: Add your custom domain
3. **Update Email Templates**: Use your custom domain in action URLs

### 2. Email Service Provider

1. **Custom SMTP**: Configure custom email service
2. **Email Deliverability**: Monitor email delivery rates
3. **Spam Prevention**: Ensure emails don't go to spam

### 3. Security

1. **Rate Limiting**: Implement rate limiting for email sending
2. **CAPTCHA**: Add CAPTCHA for registration
3. **IP Whitelisting**: Whitelist trusted IP addresses

## Troubleshooting Checklist

- [ ] Firebase project is active
- [ ] Authentication is enabled
- [ ] Email verification is enabled
- [ ] Authorized domains are configured
- [ ] Email templates are set up
- [ ] Action URL is correct
- [ ] Firebase SDK versions are consistent
- [ ] Security rules allow verification
- [ ] Network connectivity is stable
- [ ] Browser console shows no errors

## Support Resources

- **Firebase Documentation**: https://firebase.google.com/docs/auth
- **Firebase Console**: https://console.firebase.google.com/
- **Firebase Support**: https://firebase.google.com/support
- **Stack Overflow**: Search for Firebase email verification issues 