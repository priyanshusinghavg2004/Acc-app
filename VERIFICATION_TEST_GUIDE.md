# Verification System Test Guide

## 🧪 Testing the Complete Verification Flow

### **Test Scenario 1: New User Registration**

1. **Register a new user:**
   - Go to the app and click "New user? Register"
   - Fill in all required fields:
     - Company Name: `Test Company`
     - Email: `test@example.com` (use a real email you can access)
     - Contact Number: `9876543210`
     - Password: `Test123` (must have uppercase, lowercase, number)
   - Click "Register"

2. **Expected Behavior:**
   - ✅ Registration successful message
   - ✅ Email verification modal appears
   - ✅ Verification email sent to your email
   - ✅ "Skip for now" button available for testing

3. **Test Email Verification:**
   - Check your email for verification link
   - Click the verification link
   - Should redirect to verification page and then back to app
   - Or use "Check Verification Status" button in modal

### **Test Scenario 2: Phone Verification**

1. **After email verification (or skip):**
   - Phone verification modal should appear
   - Click "Send Code" button
   - Demo code will be displayed in the UI (for testing)

2. **Test Phone Code:**
   - Enter the displayed demo code
   - Click "Verify Phone Number"
   - Should show success and close modal

### **Test Scenario 3: Password Reset**

1. **Test Forgot Password:**
   - Go to login page
   - Click "Forgot Password?"
   - Enter your email address
   - Click "Send Reset Email"

2. **Reset Password:**
   - Check email for reset link
   - Click reset link
   - Enter new password
   - Should be able to login with new password

### **Test Scenario 4: Security Features**

1. **Test Account Lockout:**
   - Try to login with wrong password 5 times
   - Account should be locked for 15 minutes
   - Try correct password after lockout period

2. **Test Rate Limiting:**
   - Try to resend verification email multiple times
   - Should see countdown timer (60 seconds)

## 🔧 Testing Features

### **Email Verification:**
- ✅ Automatic email sending on registration
- ✅ Verification link works
- ✅ Resend functionality with timer
- ✅ Check verification status button
- ✅ Skip option for testing

### **Phone Verification:**
- ✅ Demo code generation
- ✅ Code validation
- ✅ Send code button with timer
- ✅ Skip option for testing

### **Password Reset:**
- ✅ Forgot password flow
- ✅ Reset email sending
- ✅ Password reset functionality

### **Security:**
- ✅ Account lockout after 5 failed attempts
- ✅ Rate limiting on verification requests
- ✅ Input validation
- ✅ Session management

## 📧 Email Testing

### **For Real Testing:**
1. Use a real email address you can access
2. Check spam folder if email doesn't arrive
3. Click verification links in email
4. Test password reset emails

### **For Development:**
1. Use "Skip for now" buttons to bypass verification
2. Demo codes are displayed in UI for phone verification
3. All verification functions work without actual SMS/email

## 🚀 Production Deployment

### **Before Going Live:**
1. Remove "Skip for now" buttons
2. Integrate real SMS service (Twilio/AWS SNS)
3. Configure custom email templates
4. Set up domain verification
5. Test with real users

### **SMS Integration:**
- Replace demo SMS with Twilio or AWS SNS
- Update `handleSendPhoneVerification` function
- Test with real phone numbers

### **Email Configuration:**
- Customize Firebase Auth email templates
- Verify sending domain
- Test email delivery

## 🐛 Troubleshooting

### **Common Issues:**
1. **Email not received:** Check spam folder, verify email config
2. **Verification link expired:** Use resend functionality
3. **Phone code invalid:** Request new code, check expiry
4. **Account locked:** Wait for lockout period to expire

### **Debug Information:**
- Check browser console for errors
- Verify Firebase configuration
- Check Firestore security rules
- Monitor authentication state

## ✅ Test Checklist

- [ ] New user registration
- [ ] Email verification flow
- [ ] Phone verification flow
- [ ] Password reset flow
- [ ] Account lockout protection
- [ ] Rate limiting
- [ ] Input validation
- [ ] Error handling
- [ ] Skip functionality (for testing)

## 🎯 Expected Results

After completing all tests:
- ✅ Users can register successfully
- ✅ Email verification works
- ✅ Phone verification works
- ✅ Password reset works
- ✅ Security features protect against abuse
- ✅ All verification flows are smooth and user-friendly

The verification system is now fully enabled and ready for testing with real users! 🚀 