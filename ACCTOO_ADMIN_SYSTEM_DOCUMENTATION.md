# 🏢 ACCTOO Admin/Backoffice System - Complete Documentation

**Version:** 1.0  
**Date:** January 2024  
**Project:** ACCTOO Accounting Software Admin Panel  
**Author:** AI Assistant  

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Employee Management](#employee-management)
4. [Authentication & Security](#authentication--security)
5. [Core Features](#core-features)
6. [Data Structure](#data-structure)
7. [Implementation Guide](#implementation-guide)
8. [API Reference](#api-reference)
9. [Security Considerations](#security-considerations)
10. [Future Roadmap](#future-roadmap)

---

## 🎯 Project Overview

### **Objective**
Build a comprehensive admin/owner functionality for ACCTOO accounting software that provides:
- Complete user overview and control
- Subscription and payment monitoring
- Notifications and support tools
- System logs and audit trails
- Multi-user/sub-user support architecture

### **Target Users**
1. **ACCTOO Owner (Super Admin)** - Software owner with full control
2. **ACCTOO Employees** - Staff managing users on behalf of owner
3. **Company Owners** - End users managing their accounting
4. **Company Employees** - Staff working for end-user companies

### **Business Value**
- Centralized user management
- Automated subscription monitoring
- Scalable multi-tenant architecture
- Revenue optimization through analytics
- Enhanced customer support capabilities

---

## 🏗️ System Architecture

### **High-Level Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│                    ACCTOO Software                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Super Admin   │    │        End Users                │ │
│  │   (ACCTOO)      │    │     (Companies)                 │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│           │                           │                      │
│           ▼                           ▼                      │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Owner Employees │    │    Company Owners               │ │
│  │ (ACCTOO Staff)  │    │   (Business Users)             │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│           │                           │                      │
│           ▼                           ▼                      │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   User Mgmt     │    │   Company Employees            │ │
│  │   Analytics     │    │   (Staff)                      │ │
│  │   Support       │    └─────────────────────────────────┘ │
│  └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### **Technology Stack**
- **Frontend:** React.js with Tailwind CSS
- **Backend:** Firebase (Firestore, Functions, Auth)
- **Database:** Firestore NoSQL
- **Authentication:** Firebase Auth with custom roles
- **Hosting:** Firebase Hosting
- **Functions:** Firebase Cloud Functions (Node.js)

---

## 👥 Employee Management

### **Employee Types**

#### **1. Owner's Employees (ACCTOO Staff)**
- **Purpose:** Manage users on behalf of ACCTOO owner
- **Path:** `artifacts/acc-app-e5316/backoffice/employees/{employeeId}`
- **ID Format:** `acctoo_${timestamp}_${randomString}`
- **Created By:** ACCTOO Owner (Super Admin)
- **Permissions:** User management, subscription control, support, analytics

#### **2. Company Employees (User's Staff)**
- **Purpose:** Manage company's accounting work
- **Path:** `artifacts/acc-app-e5316/users/{userId}/employees/{employeeId}`
- **ID Format:** `${userId}_${timestamp}_${randomString}`
- **Created By:** Company Owner (User)
- **Permissions:** Create invoices, manage payments, view reports, multi-store access

### **Permission Hierarchy**
```javascript
const permissionLevels = {
  SUPER_ADMIN: {
    level: 1,
    permissions: ['*'], // Everything
    description: 'ACCTOO Owner - Full system access'
  },
  OWNER_EMPLOYEE: {
    level: 2,
    permissions: [
      'manage_users',
      'view_analytics',
      'send_notifications',
      'manage_subscriptions',
      'view_logs'
    ],
    description: 'ACCTOO Staff - Assigned permissions'
  },
  COMPANY_OWNER: {
    level: 3,
    permissions: [
      'manage_company',
      'manage_employees',
      'manage_stores',
      'manage_subscription',
      'view_company_analytics'
    ],
    description: 'Company Owner - Full company control'
  },
  COMPANY_EMPLOYEE: {
    level: 4,
    permissions: [
      'create_invoice',
      'view_reports',
      'manage_payments',
      'view_assigned_stores'
    ],
    description: 'Company Staff - Role-based access'
  }
};
```

---

## 🔐 Authentication & Security

### **Login Systems**

#### **Separate Login Portals**
- **ACCTOO Staff:** `https://acctoo.com/backoffice/login`
- **Company Employees:** `https://acctoo.com/company/login`
- **Benefits:** Clear separation, better security, easier management

#### **Authentication Flow**
```javascript
// 1. User enters credentials
const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Check user type and permissions
    const userType = await determineUserType(user.uid);
    
    // 3. Redirect based on user type
    if (userType === 'owner_employee') {
      navigate('/backoffice');
    } else if (userType === 'company_employee') {
      navigate('/company/dashboard');
    }
    
    return user;
  } catch (error) {
    throw new Error('Login failed: ' + error.message);
  }
};
```

### **Security Features**

#### **Password Management**
- Secure password reset system
- Password history tracking
- Admin-initiated password resets
- Token-based reset with expiration (2 hours)
- Password strength requirements

#### **Session Management**
- Login history tracking
- IP address monitoring
- Device information logging
- Automatic session timeout
- Multi-device login support

#### **Access Control**
- Role-based permissions
- IP whitelisting (optional)
- Two-factor authentication (future)
- Suspicious activity detection
- Automated security alerts

---

## ⚡ Core Features

### **1. Dashboard (Admin Home)**
```javascript
const DashboardMetrics = {
  totalUsers: {
    active: 0,
    trial: 0,
    expired: 0
  },
  subscriptions: {
    active: 0,
    expiring: 0,
    expired: 0
  },
  revenue: {
    monthly: 0,
    yearly: 0,
    growth: 0
  },
  alerts: [
    '5 subscriptions expiring this week',
    '3 failed payments detected',
    '2 inactive users for 30+ days'
  ]
};
```

### **2. User Management**
- **User List Table:**
  - Name, Email, Phone, Company Name
  - Plan Type (Trial/Basic/Premium)
  - Subscription Expiry
  - Last Login
  - Account Status

- **Actions per User:**
  - View Profile
  - Impersonate User (login as)
  - Extend/Cancel/Upgrade subscription
  - Reset password
  - Enable/Disable account

### **3. Subscription Management**
- **Subscription List:**
  - All active and expired subscriptions
  - Filters: By plan, expiry date, payment status
  - Payment history tracking
  - Failed payment alerts

- **Admin Controls:**
  - Manual subscription extension
  - Plan upgrade/downgrade
  - Payment gateway integration
  - Automated reminder triggers

### **4. Reports & Analytics**
- **Revenue Analytics:**
  - Revenue by plan type
  - Monthly/yearly growth trends
  - Payment success rates
  - Churn analysis

- **User Analytics:**
  - User growth trends
  - Active vs inactive usage
  - Top companies by invoices
  - Feature usage statistics

### **5. Notifications & Communication**
- **Broadcast Notifications:**
  - New feature announcements
  - System maintenance alerts
  - General updates

- **Individual Reminders:**
  - Subscription expiry warnings
  - Payment due reminders
  - Account activation prompts

- **Templates:**
  - Email templates
  - SMS templates
  - In-app push notifications

### **6. Logs & Monitoring**
- **System Logs:**
  - Function errors
  - Hosting logs
  - Performance metrics

- **User Activity Logs:**
  - Invoice created
  - Payment recorded
  - Report generated
  - Login/logout events

- **Admin Actions Log:**
  - Subscription modifications
  - User management actions
  - System configuration changes

### **7. Settings Management**
- **Pricing Plans:**
  - Trial period configuration
  - Plan names and features
  - Pricing tiers
  - Feature restrictions

- **Role Management:**
  - Permission definitions
  - Role assignments
  - Access control policies

- **Integration Settings:**
  - Payment gateway configuration
  - SMS/Email provider settings
  - Third-party integrations

---

## 🗄️ Data Structure

### **Firestore Collections Structure**

#### **Backoffice Collections**
```
artifacts/acc-app-e5316/
├── backoffice/
│   ├── {adminId}/                    # Super Admin Profile
│   │   ├── name: "ACCTOO Owner"
│   │   ├── email: "owner@acctoo.com"
│   │   ├── role: "superAdmin"
│   │   ├── createdAt: "timestamp"
│   │   └── lastLogin: "timestamp"
│   ├── employees/                    # ACCTOO Staff
│   │   ├── {employeeId}/
│   │   │   ├── personal_info/
│   │   │   ├── login_credentials/
│   │   │   ├── permissions/
│   │   │   ├── activity_logs/
│   │   │   ├── login_history/
│   │   │   └── password_history/
│   ├── settings/                     # Global Settings
│   │   ├── subscription_plans/
│   │   ├── payment_gateways/
│   │   ├── sms_providers/
│   │   └── email_providers/
│   ├── plans/                        # Subscription Plans
│   │   ├── {planId}/
│   │   │   ├── name: "Premium"
│   │   │   ├── price: 999
│   │   │   ├── features: []
│   │   │   └── trial_days: 14
│   ├── coupons/                      # Discount Codes
│   │   ├── {couponId}/
│   │   │   ├── code: "WELCOME50"
│   │   │   ├── discount: 50
│   │   │   ├── valid_until: "timestamp"
│   │   │   └── usage_limit: 100
│   ├── marketing/                    # Marketing Tools
│   │   ├── sms_templates/
│   │   ├── email_templates/
│   │   └── campaign_settings/
│   ├── payment_gateways/             # Payment Providers
│   │   ├── razorpay/
│   │   ├── stripe/
│   │   └── paypal/
│   └── website_content/              # Dynamic Content
│       ├── homepage_offers/
│       ├── blog_posts/
│       ├── plan_features/
│       └── promotional_content/
├── backoffice_logs/                  # Admin Action Logs
│   ├── {logId}/
│   │   ├── timestamp: "timestamp"
│   │   ├── action: "user_subscription_extended"
│   │   ├── module: "subscriptions"
│   │   ├── adminUid: "admin_uid"
│   │   ├── userId: "target_user_uid"
│   │   └── details: {}
├── backoffice_subscriptions/         # All User Subscriptions
│   ├── {userId}/
│   │   ├── planType: "premium"
│   │   ├── startDate: "timestamp"
│   │   ├── endDate: "timestamp"
│   │   ├── status: "active"
│   │   └── paymentHistory: []
└── backoffice_users/                 # All User Management
    ├── {userId}/
    │   ├── basic_info/
    │   ├── subscription_status/
    │   ├── last_activity/
    │   └── admin_notes/
```

#### **User Collections**
```
artifacts/acc-app-e5316/users/{userId}/
├── companyDetails/                    # Company Information
│   ├── companyName: "SITMAY Electronics"
│   ├── ownerName: "Rajesh Kumar"
│   ├── email: "rajesh@sitmay.com"
│   ├── phone: "+91-9876543210"
│   ├── address: {}
│   ├── gstNumber: "GST123456789"
│   └── businessType: "Electronics Retail"
├── employees/                         # Company Employees
│   ├── {employeeId}/
│   │   ├── personal_info/
│   │   │   ├── name: "Priya Sharma"
│   │   │   ├── email: "priya@sitmay.com"
│   │   │   ├── phone: "+91-9876543211"
│   │   │   ├── designation: "Accountant"
│   │   │   └── department: "Finance"
│   │   ├── login_credentials/
│   │   │   ├── email: "priya@sitmay.com"
│   │   │   ├── password_hash: "hashed_password"
│   │   │   ├── last_login: "timestamp"
│   │   │   └── is_active: true
│   │   ├── permissions/
│   │   │   ├── can_create_invoice: true
│   │   │   ├── can_view_reports: true
│   │   │   ├── can_manage_payments: false
│   │   │   └── can_manage_employees: false
│   │   ├── store_access: ["store1", "store2"]
│   │   ├── activity_logs/
│   │   ├── login_history/
│   │   ├── password_history/
│   │   └── created_by: "company_owner_uid"
├── stores/                            # Multi-store Support
│   ├── {storeId}/
│   │   ├── name: "SITMAY Store 1"
│   │   ├── address: {}
│   │   ├── contact: {}
│   │   ├── settings: {}
│   │   ├── employees: []
│   │   └── created_by: "company_owner_uid"
├── subscriptions/                     # User's Subscription
│   ├── planType: "premium"
│   ├── startDate: "timestamp"
│   ├── endDate: "timestamp"
│   ├── status: "active"
│   ├── paymentHistory: []
│   └── features: []
├── custom_settings/                   # User's Custom Settings
│   ├── sms_sender: "SITMAY"
│   ├── company_logo: "logo_url"
│   ├── brand_colors: {primary: "#FF6B6B"}
│   ├── custom_templates: {}
│   └── payment_preferences: {}
└── logs/                              # User Activity Logs
    ├── {logId}/
    │   ├── timestamp: "timestamp"
    │   ├── action: "invoice_created"
    │   ├── module: "invoices"
    │   ├── userId: "user_uid"
    │   ├── details: {}
    │   └── ip_address: "192.168.1.100"
```

---

## 🛠️ Implementation Guide

### **Phase 1: Foundation (Week 1-2)**
1. **Basic Backoffice Structure**
   - Create Backoffice component
   - Implement routing (`/backoffice`)
   - Set up basic layout with sidebar

2. **Permission System**
   - Implement `usePermissions` hook
   - Create `SystemAdminOnly` wrapper
   - Set up role-based access control

3. **Firebase Functions Setup**
   - Deploy basic admin functions
   - Set up CORS and authentication
   - Implement `backoffice_bootstrapAdmin`

### **Phase 2: Core Features (Week 3-4)**
1. **Dashboard Implementation**
   - User statistics
   - Subscription overview
   - Revenue analytics
   - Alert system

2. **User Management**
   - User list table
   - Basic CRUD operations
   - Subscription management
   - User impersonation

3. **Subscription Management**
   - Subscription list
   - Plan modification
   - Payment tracking
   - Expiry alerts

### **Phase 3: Advanced Features (Week 5-6)**
1. **Employee Management**
   - Owner employee system
   - Company employee system
   - Permission management
   - Role assignment

2. **Logging & Monitoring**
   - Activity logging
   - Real-time monitoring
   - Log search and filtering
   - Security alerts

3. **Analytics & Reports**
   - Revenue reports
   - User analytics
   - Usage statistics
   - Custom report builder

### **Phase 4: Integration & Polish (Week 7-8)**
1. **Service Provider Integration**
   - Payment gateway setup
   - SMS/Email provider configuration
   - API key management
   - Service allocation

2. **Website Content Management**
   - Dynamic homepage
   - Blog management
   - Offer management
   - Content scheduling

3. **Testing & Optimization**
   - Security testing
   - Performance optimization
   - User acceptance testing
   - Documentation completion

---

## 🔌 API Reference

### **Firebase Functions**

#### **Admin Functions**
```javascript
// User Management
admin_listUsers()           // List all users
admin_impersonateUser()     // Login as another user
admin_updateUser()          // Update user details
admin_disableUser()         // Disable user account

// Subscription Management
admin_listSubscriptions()   // List all subscriptions
admin_updateSubscription()  // Modify subscription
admin_extendSubscription()  // Extend subscription
admin_addPayment()          // Add payment record

// Analytics & Reports
admin_stats()               // Get system statistics
admin_analytics()           // Get detailed analytics
admin_generateReport()      // Generate custom reports

// Notifications
admin_sendNotification()    // Send notifications
admin_broadcastMessage()    // Broadcast to all users

// System Management
admin_getSettings()         // Get system settings
admin_updateSettings()      // Update system settings
admin_listLogs()            // Get system logs
```

#### **Employee Management Functions**
```javascript
// Owner Employee Management
admin_createOwnerEmployee()     // Create ACCTOO staff
admin_updateOwnerEmployee()     // Update staff details
admin_deleteOwnerEmployee()     // Remove staff member
admin_assignPermissions()       // Assign permissions

// Company Employee Management
admin_createCompanyEmployee()   // Create company staff
admin_updateCompanyEmployee()   // Update staff details
admin_deleteCompanyEmployee()   // Remove staff member
admin_manageCompanyRoles()      // Manage company roles
```

### **Frontend Components**

#### **Core Components**
```javascript
// Main Components
<Backoffice />                 // Main admin panel
<Dashboard />                  // Admin dashboard
<UserManagement />             // User management
<SubscriptionManagement />     // Subscription control
<EmployeeManagement />         // Employee management
<Analytics />                  // Analytics dashboard
<Logs />                       // System logs
<Settings />                   // System settings

// Utility Components
<SystemAdminOnly />            // Access control wrapper
<PermissionGate />             // Permission-based access
<DataTable />                  // Reusable data table
<Modal />                      // Reusable modal
<NotificationBanner />         // Status notifications
```

#### **Hooks**
```javascript
// Custom Hooks
usePermissions()               // Permission management
useAdminData()                 // Admin data fetching
useEmployeeManagement()        // Employee operations
useSubscriptionControl()       // Subscription operations
useLogging()                   // Logging operations
useAnalytics()                 // Analytics data
```

---

## 🛡️ Security Considerations

### **Authentication Security**
- **Multi-factor Authentication:** Future implementation
- **Session Management:** Secure session handling
- **Password Policies:** Strong password requirements
- **Account Lockout:** Brute force protection

### **Data Security**
- **Data Encryption:** At rest and in transit
- **Access Control:** Role-based permissions
- **Audit Logging:** Complete action tracking
- **Data Backup:** Regular backup procedures

### **API Security**
- **Rate Limiting:** Prevent abuse
- **Input Validation:** Sanitize all inputs
- **CORS Configuration:** Proper origin control
- **Function Security:** Admin-only access

### **Privacy Compliance**
- **GDPR Compliance:** Data protection
- **Data Retention:** Clear retention policies
- **User Consent:** Explicit permission handling
- **Data Portability:** Export capabilities

---

## 🚀 Future Roadmap

### **Short Term (3-6 months)**
1. **Advanced Analytics**
   - Machine learning insights
   - Predictive analytics
   - Custom dashboard builder
   - Advanced reporting

2. **Enhanced Security**
   - Two-factor authentication
   - Advanced threat detection
   - Security audit tools
   - Compliance reporting

3. **Mobile Admin App**
   - iOS/Android admin app
   - Push notifications
   - Mobile-optimized interface
   - Offline capabilities

### **Medium Term (6-12 months)**
1. **AI-Powered Features**
   - Automated customer support
   - Smart subscription recommendations
   - Fraud detection
   - Predictive maintenance

2. **Advanced Integrations**
   - CRM integration
   - Accounting software sync
   - E-commerce platforms
   - Banking APIs

3. **Multi-language Support**
   - Internationalization
   - Localized content
   - Regional compliance
   - Currency support

### **Long Term (1-2 years)**
1. **Enterprise Features**
   - Advanced user management
   - Custom workflows
   - Advanced reporting
   - Enterprise security

2. **Platform Expansion**
   - Multiple software products
   - White-label solutions
   - Partner integrations
   - Marketplace ecosystem

3. **Global Expansion**
   - Multi-region deployment
   - Local compliance
   - Regional partnerships
   - Global support

---

## 📚 Additional Resources

### **Documentation**
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://reactjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### **Security Guidelines**
- [OWASP Security Guidelines](https://owasp.org/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Authentication Best Practices](https://firebase.google.com/docs/auth)

### **Development Tools**
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Emulator](https://firebase.google.com/docs/emulator-suite)
- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools)

---

## 📞 Support & Contact

### **Technical Support**
- **Email:** support@acctoo.com
- **Documentation:** docs.acctoo.com
- **Community:** community.acctoo.com

### **Development Team**
- **Lead Developer:** [Your Name]
- **Project Manager:** [PM Name]
- **QA Engineer:** [QA Name]

### **Project Information**
- **Repository:** [GitHub Link]
- **Issue Tracker:** [Jira/Linear Link]
- **Deployment:** [Deployment URL]

---

**Document Version:** 1.0  
**Last Updated:** January 2024  
**Next Review:** February 2024  

---

*This document is maintained by the ACCTOO development team and should be updated as the system evolves.*
