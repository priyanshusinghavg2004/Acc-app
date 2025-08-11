# ACCTOO - Detailed Flowcharts & Data Flow

## 🔄 **Complete Data Flow Architecture**

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser/PWA]
        B[Mobile App - Android]
        C[Mobile App - iOS]
        D[Desktop App - Electron]
    end
    
    subgraph "Frontend Layer"
        E[React Components]
        F[State Management]
        G[Routing System]
        H[UI Components]
    end
    
    subgraph "Authentication Layer"
        I[Firebase Auth]
        J[Email Verification]
        K[Phone Verification]
        L[MPIN System]
    end
    
    subgraph "Backend Services"
        M[Firebase Firestore]
        N[Firebase Storage]
        O[Firebase Functions]
        P[Firebase Hosting]
    end
    
    subgraph "Security Layer"
        Q[Firebase Security Rules]
        R[Input Validation]
        S[Rate Limiting]
        T[Audit Logging]
    end
    
    subgraph "External Integrations"
        U[Payment Gateways]
        V[Email Services]
        W[SMS Services]
        X[Analytics]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    F --> G
    G --> H
    
    H --> I
    I --> J
    I --> K
    I --> L
    
    I --> M
    J --> M
    K --> M
    L --> M
    
    M --> N
    M --> O
    O --> P
    
    M --> Q
    Q --> R
    R --> S
    S --> T
    
    O --> U
    O --> V
    O --> W
    O --> X
```

---

## 📊 **Database Schema & Relationships**

```mermaid
erDiagram
    USERS {
        string uid PK
        string email
        string displayName
        boolean emailVerified
        string companyId FK
        string status
        timestamp createdAt
        timestamp lastLogin
    }
    
    COMPANIES {
        string companyId PK
        string companyName
        string gstin
        string address
        string contactNumber
        string adminUserId FK
        timestamp createdAt
    }
    
    PARTIES {
        string partyId PK
        string userId FK
        string partyName
        string partyType
        string gstin
        string contactNumber
        string address
        string email
        timestamp createdAt
    }
    
    ITEMS {
        string itemId PK
        string userId FK
        string itemName
        string itemCode
        string category
        string unit
        number rate
        number stockLevel
        number reorderPoint
        timestamp createdAt
    }
    
    SALES {
        string saleId PK
        string userId FK
        string partyId FK
        string invoiceNumber
        string documentType
        date invoiceDate
        number totalAmount
        number gstAmount
        string status
        timestamp createdAt
    }
    
    SALE_ITEMS {
        string saleItemId PK
        string saleId FK
        string itemId FK
        number quantity
        number rate
        number amount
        number gstPercent
    }
    
    PURCHASES {
        string purchaseId PK
        string userId FK
        string partyId FK
        string billNumber
        string documentType
        date billDate
        number totalAmount
        number gstAmount
        string status
        timestamp createdAt
    }
    
    PAYMENTS {
        string paymentId PK
        string userId FK
        string partyId FK
        string referenceId FK
        string paymentType
        number amount
        string paymentMode
        date paymentDate
        timestamp createdAt
    }
    
    EMPLOYEES {
        string employeeId PK
        string userId FK
        string name
        string designation
        number basicSalary
        string contactNumber
        string aadhaar
        string pan
        timestamp createdAt
    }
    
    EXPENSES {
        string expenseId PK
        string userId FK
        string employeeId FK
        string expenseHead
        number amount
        date expenseDate
        string description
        timestamp createdAt
    }
    
    MANUFACTURING {
        string manufacturingId PK
        string userId FK
        string orderNumber
        string productId FK
        string processId FK
        number quantity
        string status
        date expectedDate
        timestamp createdAt
    }
    
    USERS ||--o{ COMPANIES : "belongs_to"
    USERS ||--o{ PARTIES : "creates"
    USERS ||--o{ ITEMS : "manages"
    USERS ||--o{ SALES : "creates"
    USERS ||--o{ PURCHASES : "creates"
    USERS ||--o{ PAYMENTS : "processes"
    USERS ||--o{ EMPLOYEES : "manages"
    USERS ||--o{ EXPENSES : "records"
    USERS ||--o{ MANUFACTURING : "manages"
    
    SALES ||--o{ SALE_ITEMS : "contains"
    ITEMS ||--o{ SALE_ITEMS : "included_in"
    PARTIES ||--o{ SALES : "involved_in"
    PARTIES ||--o{ PURCHASES : "involved_in"
    PARTIES ||--o{ PAYMENTS : "involved_in"
    EMPLOYEES ||--o{ EXPENSES : "related_to"
    ITEMS ||--o{ MANUFACTURING : "produced_in"
```

---

## 🔐 **Authentication & Security Flow**

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant FA as Firebase Auth
    participant F as Firestore
    participant S as Security Rules
    
    U->>A: Access Application
    A->>FA: Check Authentication Status
    FA->>A: Return Auth State
    
    alt User Not Authenticated
        A->>U: Show Login Form
        U->>A: Enter Credentials
        A->>FA: Sign In
        FA->>A: Return User Token
        A->>F: Request User Data
        F->>S: Validate Access
        S->>F: Grant/Deny Access
        F->>A: Return User Data
        A->>U: Show Dashboard
    else User Authenticated
        A->>F: Request User Data
        F->>S: Validate Access
        S->>F: Grant Access
        F->>A: Return User Data
        A->>U: Show Dashboard
    end
    
    U->>A: Perform Action
    A->>F: Request Data Modification
    F->>S: Validate Request
    S->>F: Grant/Deny Permission
    F->>A: Return Result
    A->>U: Show Updated Data
```

---

## 💼 **Business Process Flow**

```mermaid
flowchart TD
    subgraph "Sales Process"
        A1[Customer Inquiry] --> A2[Create Quotation]
        A2 --> A3[Customer Approval]
        A3 --> A4[Create Sales Order]
        A4 --> A5[Generate Invoice]
        A5 --> A6[Process Payment]
        A6 --> A7[Update Inventory]
    end
    
    subgraph "Purchase Process"
        B1[Identify Need] --> B2[Create Purchase Order]
        B2 --> B3[Supplier Confirmation]
        B3 --> B4[Receive Goods]
        B4 --> B5[Create Purchase Bill]
        B5 --> B6[Process Payment]
        B6 --> B7[Update Inventory]
    end
    
    subgraph "Manufacturing Process"
        C1[Customer Order] --> C2[Create Production Order]
        C2 --> C3[Plan Materials]
        C3 --> C4[Start Production]
        C4 --> C5[Quality Check]
        C5 --> C6[Complete Production]
        C6 --> C7[Update Stock]
    end
    
    subgraph "Payment Process"
        D1[Generate Bill] --> D2[Send to Customer]
        D2 --> D3[Customer Review]
        D3 --> D4[Payment Receipt]
        D4 --> D5[Bank Reconciliation]
        D5 --> D6[Update Outstanding]
    end
    
    A7 --> E[Inventory Management]
    B7 --> E
    C7 --> E
    D6 --> F[Financial Reports]
    E --> F
```

---

## 📱 **User Journey Flow**

```mermaid
journey
    title ACCTOO User Journey
    section Onboarding
      New User Registration: 5: User
      Email Verification: 4: User
      Company Setup: 5: User
      Dashboard Introduction: 4: User
    section Daily Operations
      Login to System: 5: User
      Check Dashboard: 4: User
      Create Sales Invoice: 5: User
      Process Payments: 4: User
      Update Inventory: 3: User
      Generate Reports: 4: User
    section Monthly Activities
      GST Filing: 5: User
      Financial Reports: 4: User
      Employee Payroll: 4: User
      Inventory Audit: 3: User
    section Advanced Features
      Manufacturing Orders: 3: User
      Multi-branch Management: 2: User
      Data Export: 3: User
      System Settings: 2: User
```

---

## 🔄 **Real-time Data Synchronization**

```mermaid
graph LR
    subgraph "Client Devices"
        A[Web Browser]
        B[Android App]
        C[iOS App]
        D[Desktop App]
    end
    
    subgraph "Firebase Services"
        E[Firestore Database]
        F[Firebase Auth]
        G[Firebase Storage]
        H[Firebase Functions]
    end
    
    subgraph "Real-time Updates"
        I[WebSocket Connections]
        J[Data Listeners]
        K[Offline Sync]
        L[Conflict Resolution]
    end
    
    A --> I
    B --> I
    C --> I
    D --> I
    
    I --> J
    J --> E
    J --> F
    J --> G
    J --> H
    
    E --> K
    K --> L
    L --> I
```

---

## 📊 **Reporting & Analytics Flow**

```mermaid
flowchart TD
    A[User Request Report] --> B{Report Type}
    
    B -->|Financial| C[Financial Reports]
    B -->|GST| D[GST Reports]
    B -->|Inventory| E[Inventory Reports]
    B -->|Sales| F[Sales Reports]
    B -->|Purchase| G[Purchase Reports]
    B -->|Employee| H[HR Reports]
    
    C --> I[Collect Financial Data]
    D --> J[Collect GST Data]
    E --> K[Collect Inventory Data]
    F --> L[Collect Sales Data]
    G --> M[Collect Purchase Data]
    H --> N[Collect HR Data]
    
    I --> O[Process Data]
    J --> O
    K --> O
    L --> O
    M --> O
    N --> O
    
    O --> P{Export Format}
    P -->|PDF| Q[Generate PDF]
    P -->|Excel| R[Generate Excel]
    P -->|CSV| S[Generate CSV]
    
    Q --> T[Download/Email]
    R --> T
    S --> T
```

---

## 🔧 **Component Interaction Flow**

```mermaid
graph TB
    subgraph "Core Components"
        A[App.js - Main Container]
        B[Dashboard.js - Overview]
        C[Sales.js - Sales Management]
        D[Purchases.js - Purchase Management]
        E[Items.js - Inventory]
        F[Payments.js - Payment Processing]
        G[Reports.js - Reporting]
        H[Settings.js - Configuration]
    end
    
    subgraph "Utility Components"
        I[Modal.js - Popup Management]
        J[ActionButtons.js - Common Actions]
        K[ImageManager.js - File Handling]
        L[OfflineIndicator.js - Network Status]
        M[MobileBottomNav.js - Mobile Navigation]
    end
    
    subgraph "Template Components"
        N[BillTemplates.js - Document Templates]
        O[InvoiceTemplate.js - Invoice Layout]
        P[ReceiptTemplate.js - Receipt Layout]
        Q[ChallanTemplate.js - Challan Layout]
    end
    
    subgraph "Security Components"
        R[MPINVerification.js - Security]
        S[EmailVerification.js - Email Verification]
        T[ReCaptchaComponent.js - Bot Protection]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    A --> H
    
    C --> I
    D --> I
    E --> I
    F --> I
    G --> I
    
    C --> J
    D --> J
    E --> J
    F --> J
    
    C --> K
    D --> K
    E --> K
    F --> K
    
    A --> L
    A --> M
    
    C --> N
    D --> N
    F --> N
    
    N --> O
    N --> P
    N --> Q
    
    A --> R
    A --> S
    A --> T
```

---

## 📈 **Performance & Scalability Flow**

```mermaid
graph TD
    A[User Request] --> B{Request Type}
    
    B -->|Read| C[Cache Check]
    B -->|Write| D[Validation]
    B -->|Delete| E[Permission Check]
    
    C --> F{Cache Hit?}
    F -->|Yes| G[Return Cached Data]
    F -->|No| H[Database Query]
    
    D --> I[Input Sanitization]
    I --> J[Business Logic]
    J --> K[Database Write]
    
    E --> L[Security Validation]
    L --> M[Soft Delete]
    
    H --> N[Update Cache]
    K --> N
    M --> N
    
    N --> O[Response to User]
    G --> O
    
    subgraph "Performance Optimizations"
        P[Lazy Loading]
        Q[Code Splitting]
        R[Image Compression]
        S[Database Indexing]
        T[CDN Distribution]
    end
    
    O --> P
    O --> Q
    O --> R
    O --> S
    O --> T
```

---

## 🔄 **Error Handling & Recovery Flow**

```mermaid
flowchart TD
    A[Operation Request] --> B{Network Available?}
    
    B -->|Yes| C[Process Request]
    B -->|No| D[Offline Mode]
    
    C --> E{Operation Success?}
    E -->|Yes| F[Update UI]
    E -->|No| G[Error Handling]
    
    D --> H[Queue Operation]
    H --> I[Local Storage]
    I --> J[Sync When Online]
    
    G --> K{Error Type}
    K -->|Validation| L[Show Validation Error]
    K -->|Authentication| M[Redirect to Login]
    K -->|Permission| N[Show Access Denied]
    K -->|Network| O[Show Network Error]
    K -->|Server| P[Show Server Error]
    
    L --> Q[User Correction]
    M --> R[Re-authenticate]
    N --> S[Contact Admin]
    O --> T[Retry Operation]
    P --> U[Contact Support]
    
    Q --> A
    R --> A
    T --> A
    J --> A
```

---

## 📊 **Data Migration & Backup Flow**

```mermaid
flowchart TD
    A[Data Export Request] --> B{Export Type}
    
    B -->|Full Backup| C[Export All Data]
    B -->|Selective| D[Choose Collections]
    B -->|Incremental| E[Export Changes Only]
    
    C --> F[Generate Backup File]
    D --> F
    E --> F
    
    F --> G{Format}
    G -->|JSON| H[JSON Export]
    G -->|CSV| I[CSV Export]
    G -->|Excel| J[Excel Export]
    
    H --> K[Compress File]
    I --> K
    J --> K
    
    K --> L[Upload to Cloud]
    L --> M[Generate Download Link]
    M --> N[Send to User]
    
    subgraph "Migration Process"
        O[Validate Source Data]
        P[Transform Data]
        Q[Validate Target Schema]
        R[Import Data]
        S[Verify Import]
    end
    
    N --> O
    O --> P
    P --> Q
    Q --> R
    R --> S
```

---

## 🔐 **Security Audit Flow**

```mermaid
flowchart TD
    A[Security Event] --> B{Event Type}
    
    B -->|Login Attempt| C[Track Login]
    B -->|Data Access| D[Log Access]
    B -->|Data Modification| E[Log Changes]
    B -->|Permission Change| F[Log Permissions]
    
    C --> G{Successful?}
    G -->|Yes| H[Update Last Login]
    G -->|No| I[Increment Failed Attempts]
    
    D --> J[Record Access Details]
    E --> K[Record Change Details]
    F --> L[Record Permission Details]
    
    I --> M{Max Attempts?}
    M -->|Yes| N[Lock Account]
    M -->|No| O[Continue Monitoring]
    
    H --> P[Update User Session]
    J --> Q[Audit Log]
    K --> Q
    L --> Q
    N --> Q
    P --> Q
    
    Q --> R[Security Dashboard]
    R --> S[Alert Admin if Suspicious]
```

---

This comprehensive flowchart documentation provides a complete understanding of how data flows through the ACCTOO system, how components interact, and how the application handles various scenarios including security, performance, and error recovery.