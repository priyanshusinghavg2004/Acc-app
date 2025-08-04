# Email Verification Troubleshooting Guide

## Common Issues and Solutions

### 1. Email Not Received

**Symptoms:**
- User clicks "Send Verification Email" but doesn't receive the email
- No email in inbox or spam folder

**Solutions:**
1. **Check Spam/Junk Folder**: Firebase verification emails often go to spam
2. **Wait 5-10 Minutes**: Email delivery can be delayed
3. **Check Email Address**: Ensure the email address is correct
4. **Resend Email**: Click "Resend Verification Email" button
5. **Check Firebase Console**: Verify email sending is enabled

### 2. Verification Link Not Working

**Symptoms:**
- Clicking the verification link shows "Invalid Action" or "Verification Failed"
- Link appears to be broken or expired

**Solutions:**
1. **Use Fresh Link**: Request a new verification email
2. **Check Browser**: Try opening the link in a different browser
3. **Clear Browser Cache**: Clear cookies and cache
4. **Check URL**: Ensure the link is complete and not truncated
5. **Network Issues**: Check internet connection

### 3. "Invalid Action Code" Error

**Symptoms:**
- Error message: "The verification link is invalid or has already been used"
- Link was already clicked once

**Solutions:**
1. **Request New Email**: The link can only be used once
2. **Check Email**: Ensure you're using the most recent verification email
3. **Wait for New Email**: Allow time for the new email to arrive

### 4. "Expired Action Code" Error

**Symptoms:**
- Error message: "The verification link has expired"
- Link was sent more than 24 hours ago

**Solutions:**
1. **Request New Email**: Verification links expire after 24 hours
2. **Check Email Timestamp**: Verify when the email was sent
3. **Use Recent Link**: Always use the most recent verification email

### 5. User Account Issues

**Symptoms:**
- "No account found with this email address"
- "This account has been disabled"

**Solutions:**
1. **Check Registration**: Ensure the account was created successfully
2. **Contact Support**: If account is disabled, contact support
3. **Re-register**: If account doesn't exist, create a new account

## Technical Debugging

### Console Logs to Check

1. **Registration Process:**
   ```
   console.log('Sending verification email with settings:', actionCodeSettings);
   ```

2. **Verification Page:**
   ```
   console.log('Email verification parameters:', { mode, actionCode, continueUrl, lang });
   console.log('Current URL:', window.location.href);
   ```

3. **Verification Check:**
   ```
   console.log('Checking email verification for user:', user.email);
   console.log('Current emailVerified status:', user.emailVerified);
   ```

### Firebase Configuration Issues

1. **Auth Domain**: Ensure `authDomain` is correctly set to `acc-app-e5316.firebaseapp.com`
2. **Email Templates**: Check Firebase Console > Authentication > Templates
3. **Action Code Settings**: Verify `handleCodeInApp` is not causing conflicts

### Common Error Codes

- `auth/invalid-action-code`: Link already used or invalid
- `auth/expired-action-code`: Link expired (24+ hours old)
- `auth/user-disabled`: Account disabled by admin
- `auth/user-not-found`: No account with this email
- `auth/network-request-failed`: Network connectivity issues

## Prevention Tips

### For Users:
1. **Use Valid Email**: Ensure email address is correct and accessible
2. **Check Spam Folder**: Always check spam/junk folder
3. **Use Link Quickly**: Click verification link within 24 hours
4. **Don't Share Links**: Verification links are single-use and personal

### For Developers:
1. **Test Email Flow**: Regularly test the complete verification flow
2. **Monitor Logs**: Check console logs for errors
3. **Update Firebase SDK**: Keep Firebase SDK versions consistent
4. **Handle Edge Cases**: Implement proper error handling for all scenarios

## Testing the Verification Flow

### Manual Testing Steps:
1. Register a new account with a valid email
2. Check email inbox and spam folder
3. Click the verification link
4. Verify the user status updates correctly
5. Test the "Check Verification" button
6. Test the "Resend Email" functionality

### Automated Testing:
```javascript
// Test email verification flow
const testEmailVerification = async () => {
  // 1. Create test user
  const testUser = await createUserWithEmailAndPassword(auth, 'test@example.com', 'password123');
  
  // 2. Send verification email
  const emailResult = await sendVerificationEmail(testUser.user);
  console.log('Email sent:', emailResult);
  
  // 3. Check verification status
  const isVerified = await checkEmailVerification(testUser.user);
  console.log('Verification status:', isVerified);
  
  // 4. Clean up
  await deleteUser(testUser.user);
};
```

## Support Contact

If you continue to experience issues:

1. **Check Console Logs**: Open browser developer tools and check for errors
2. **Screenshot Error**: Take a screenshot of any error messages
3. **Contact Support**: Provide error details and steps to reproduce
4. **Check Network**: Ensure stable internet connection

## Recent Fixes Applied

1. **Removed `handleCodeInApp`**: This setting was causing verification issues
2. **Updated Firebase SDK**: Synchronized SDK versions across files
3. **Improved Error Handling**: Added specific error messages for different scenarios
4. **Enhanced Logging**: Added comprehensive console logging for debugging
5. **Better User Feedback**: Improved error messages and user guidance 