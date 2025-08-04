# Settings & MPIN Feature Guide

## 🔐 MPIN Security System

### What is MPIN?
MPIN (Mobile Personal Identification Number) is a 4-digit security code that provides an additional layer of protection for sensitive operations in your accounting app.

### Features:
- **4-digit numeric code** (0-9 only)
- **Secure storage** in Firestore database
- **Required for sensitive operations** like data export
- **Easy to set up** through the Settings menu

### How to Set Up MPIN:

1. **Access Settings:**
   - Click on your company avatar/logo in the top-right corner
   - Select "⚙️ Settings" from the dropdown menu

2. **Set MPIN:**
   - Go to the "🔐 MPIN Settings" tab
   - Enter a 4-digit number (e.g., 1234)
   - Confirm the same number
   - Click "Set MPIN"

3. **Verification:**
   - You'll see a success message
   - The MPIN is now stored securely

### How MPIN Verification Works:

When you perform sensitive operations (like data export), the system will:
1. Check if MPIN is set
2. If not set: Prompt you to set it up first
3. If set: Ask for your 4-digit MPIN
4. Verify the code and proceed with the operation

## 📝 Personal To-Do List

### Features:
- **Private reminders** - Only visible to you
- **Priority levels** - High, Medium, Low
- **Status tracking** - Pending/Completed
- **Persistent storage** - Saved in your user profile
- **Easy management** - Add, edit, delete, mark complete

### How to Use To-Do List:

1. **Access Settings:**
   - Click on your company avatar/logo
   - Select "⚙️ Settings"

2. **Manage To-Dos:**
   - Go to the "📝 To-Do List" tab
   - Add new tasks using the input field
   - Set priority levels (High/Medium/Low)
   - Mark tasks as complete with checkboxes
   - Delete tasks with the trash icon

3. **Organize Tasks:**
   - Tasks are automatically separated into "Pending" and "Completed"
   - Use priority colors to identify urgent tasks
   - All changes are saved automatically

## 🎯 Use Cases

### MPIN Protection for:
- **Data Export** - Protect sensitive business data
- **Financial Reports** - Secure access to financial information
- **User Management** - Admin operations
- **System Settings** - Critical configuration changes

### To-Do List for:
- **Business Reminders** - Follow up with customers
- **Task Management** - Track daily business activities
- **Deadline Tracking** - Important dates and deadlines
- **Personal Notes** - Quick reminders and notes

## 🔧 Technical Implementation

### Security Features:
- MPIN is encoded before storage (base64)
- Verification happens server-side
- Failed attempts are logged
- Session-based verification

### Data Storage:
- MPIN stored in user document in Firestore
- To-dos stored as array in user profile
- Real-time synchronization
- Offline support with sync

### Integration:
- Settings component integrated into main app
- MPIN verification modal for sensitive operations
- Responsive design for mobile and desktop
- Accessible from both desktop and mobile menus

## 🚀 Getting Started

1. **Set up your MPIN first** - This is required for sensitive operations
2. **Add some to-dos** - Start with important business reminders
3. **Test the features** - Try exporting data to see MPIN verification in action
4. **Customize priorities** - Use priority levels to organize your tasks

## 📱 Mobile Support

Both MPIN and To-Do features work seamlessly on:
- **Desktop browsers**
- **Mobile browsers**
- **Tablet devices**
- **Responsive design** adapts to all screen sizes

## 🔒 Security Best Practices

1. **Choose a strong MPIN** - Avoid obvious numbers like 1234
2. **Don't share your MPIN** - Keep it private
3. **Use different MPINs** - Don't reuse MPINs from other services
4. **Regular updates** - Consider changing your MPIN periodically

## 🆘 Troubleshooting

### MPIN Issues:
- **Forgot MPIN**: Contact support to reset
- **Not working**: Ensure you're entering exactly 4 digits
- **Not set**: Go to Settings to set up your MPIN

### To-Do Issues:
- **Not saving**: Check your internet connection
- **Not syncing**: Refresh the page and try again
- **Missing data**: Check if you're logged in with the correct account

## 📞 Support

If you encounter any issues with the Settings or MPIN features:
1. Check this guide first
2. Try refreshing the page
3. Contact support with specific error messages
4. Include your browser and device information

---

**Note**: This is a demo implementation. In production, use proper cryptographic hashing for MPIN storage and implement additional security measures. 