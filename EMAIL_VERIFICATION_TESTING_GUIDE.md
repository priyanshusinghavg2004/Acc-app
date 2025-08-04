# Email Verification Testing Guide

## 🧪 **Testing Steps**

### 1. **Test Registration and Email Sending**

1. **Register a new account**:
   - Go to `http://localhost:3000`
   - Click "Register" or "Sign Up"
   - Fill in the registration form with a valid email
   - Click "Register"

2. **Check console logs**:
   ```
   Sending verification email with settings: {url: 'http://localhost:3000/complete-verification'}
   Verification email sent successfully
   ```

3. **Check email**:
   - Look in your email inbox
   - Check spam/junk folder
   - Email should be from: `noreply@acc-app-e5316.firebaseapp.com`

### 2. **Test Email Verification Link**

1. **Click the verification link** in the email
2. **Should redirect to**: `http://localhost:3000/#/complete-verification?mode=verifyEmail&oobCode=...`
3. **Check console logs**:
   ```
   Email verification parameters: { mode: 'verifyEmail', actionCode: '...', continueUrl: null, lang: 'en' }
   Applying action code: ...
   Email verified successfully!
   ```

### 3. **Test Manual Verification Check**

1. **In the email verification modal**:
   - Click "Check Verification Status"
   - Should show success message
   - Modal should close automatically

2. **Check console logs**:
   ```
   Checking email verification status...
   Checking email verification for user: your-email@example.com
   Current emailVerified status: false
   After reload - emailVerified status: true
   Email verification result: true
   Email is verified, updating user status...
   Email verification completed successfully
   ```

### 4. **Test Resend Email**

1. **In the email verification modal**:
   - Click "Resend Verification Email"
   - Should show countdown timer
   - New email should be sent

2. **Check console logs**:
   ```
   Resending verification email...
   Sending verification email with settings: {url: 'http://localhost:3000/complete-verification'}
   Verification email sent successfully
   ```

### 5. **Test Skip for Development**

1. **In the email verification modal**:
   - Click "Skip for now (Testing only)"
   - Should bypass verification and close modal

2. **Check console logs**:
   ```
   Skipping email verification for testing...
   Email verification skipped successfully
   ```

## 🔧 **Troubleshooting**

### **Issue: Email not received**

**Solutions:**
1. Check spam folder
2. Wait 5-10 minutes
3. Check Firebase Console > Authentication > Users
4. Verify email address is correct

### **Issue: Verification link not working**

**Solutions:**
1. Check URL format: should be `http://localhost:3000/#/complete-verification?mode=verifyEmail&oobCode=...`
2. Ensure no `.html` extension in URL
3. Check browser console for errors
4. Try different browser

### **Issue: "Invalid Action Code" error**

**Solutions:**
1. Link can only be used once
2. Request new verification email
3. Check if link is expired (24 hours)

### **Issue: Console errors**

**Check for:**
1. Firebase SDK version mismatch
2. Network connectivity issues
3. Firebase project configuration

## 📋 **Test Checklist**

- [ ] Registration sends verification email
- [ ] Email contains valid verification link
- [ ] Verification link redirects correctly
- [ ] Email verification completes successfully
- [ ] User status updates in database
- [ ] Modal closes after verification
- [ ] Resend email works
- [ ] Skip option works for testing
- [ ] Error handling works properly
- [ ] Console logs are informative

## 🚀 **Production Testing**

### **Before deploying:**

1. **Update Firebase Console**:
   - Go to Authentication > Settings > Authorized domains
   - Add your production domain
   - Update email templates with production URLs

2. **Test with production domain**:
   - Deploy to production
   - Test complete verification flow
   - Verify emails are delivered
   - Check verification links work

3. **Monitor logs**:
   - Check Firebase Console logs
   - Monitor email delivery rates
   - Watch for verification errors

## 🔍 **Debug Commands**

### **Browser Console Commands:**

```javascript
// Test email verification flow
testEmailVerification()

// Test verification link parsing
testVerificationLink('your-verification-url')

// Test Firebase configuration
testFirebaseConfig()

// Check current user status
console.log('User:', auth.currentUser)
console.log('Email verified:', auth.currentUser?.emailVerified)

// Force reload user data
await auth.currentUser.reload()
console.log('Email verified after reload:', auth.currentUser.emailVerified)
```

### **Network Tab Monitoring:**

1. Open Developer Tools > Network
2. Filter by "Fetch/XHR"
3. Look for Firebase API calls
4. Check for authentication requests
5. Monitor verification API calls

## 📞 **Support**

If issues persist:

1. **Check Firebase Console**: Authentication > Users
2. **Review console logs**: Look for specific error codes
3. **Test with different email**: Try Gmail, Outlook, etc.
4. **Check network**: Ensure stable internet connection
5. **Contact support**: Provide error details and steps to reproduce 