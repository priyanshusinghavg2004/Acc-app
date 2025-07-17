
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import all module components
import Dashboard from './components/Dashboard';
import Parties from './components/Parties';
import Items from './components/Items';
import Purchases from './components/Purchases';
import Reports from './components/Reports';
import CompanyDetails from './components/CompanyDetails';
import Taxes from './components/Taxes';
import Manufacturing from './components/Manufacturing';
import BillTemplates from './components/BillTemplates';
import Sales from './components/Sales';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};
const appId = firebaseConfig.appId;

// Main App component
const App = () => {
    // State to manage the currently active module/page
    const [activeModule, setActiveModule] = useState('dashboard');
    // State to store Firebase instances
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null); // User ID for Firestore operations
    const [isAuthReady, setIsAuthReady] = useState(false); // To ensure Firebase is ready before operations

    // Firebase Initialization and Authentication
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                // Initialize Firebase app
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                // Sign in with custom token if available, otherwise anonymously
                // For local development, you might just use signInAnonymously(firebaseAuth)
                await signInAnonymously(firebaseAuth);

                // Listen for auth state changes to get the user ID
                onAuthStateChanged(firebaseAuth, (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        setUserId(null);
                    }
                    setIsAuthReady(true); // Set auth ready once the state is determined
                });

            } catch (error) {
                console.error("Error initializing Firebase:", error);
            }
        };

        initializeFirebase();
    }, []); // Empty dependency array ensures this runs once on mount

    // Function to render the active module component
    const renderModule = () => {
        // Pass Firebase instances and user ID to components that need them
        const moduleProps = { db, userId, isAuthReady, appId };

        switch (activeModule) {
            case 'dashboard':
                return <Dashboard {...moduleProps} />;
            case 'parties':
                return <Parties {...moduleProps} />;
            case 'items':
                return <Items {...moduleProps} />;
            case 'purchases':
                return <Purchases {...moduleProps} />;
            case 'reports':
                return <Reports {...moduleProps} />;
            case 'manufacturing':
                return <Manufacturing />;
            case 'billTemplates':
                return <BillTemplates />;
            case 'companyDetails':
                return <CompanyDetails {...moduleProps} setActiveModule={setActiveModule} />;
            case 'taxes':
                return <Taxes />;
            case 'sales':
                return <Sales />;
            default:
                return <Dashboard {...moduleProps} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg">
                <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                    <h1 className="text-3xl font-extrabold mb-2 sm:mb-0">BizFlow Accounting</h1>
                    <nav className="flex flex-wrap gap-2 sm:gap-4">
                        <button
                            onClick={() => setActiveModule('dashboard')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'dashboard' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => setActiveModule('parties')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'parties' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Parties
                        </button>
                        <button
                            onClick={() => setActiveModule('items')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'items' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Items
                        </button>
                        <button
                            onClick={() => setActiveModule('sales')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'sales' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Sales
                        </button>
                        <button
                            onClick={() => setActiveModule('purchases')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'purchases' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Purchases
                        </button>
                        <button
                            onClick={() => setActiveModule('reports')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'reports' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Reports
                        </button>
                        <button
                            onClick={() => setActiveModule('manufacturing')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'manufacturing' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Manufacturing
                        </button>
                        <button
                            onClick={() => setActiveModule('billTemplates')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'billTemplates' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Bill Templates
                        </button>
                        <button
                            onClick={() => setActiveModule('companyDetails')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'companyDetails' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Company Details
                        </button>
                        <button
                            onClick={() => setActiveModule('taxes')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                activeModule === 'taxes' ? 'bg-white text-blue-700 shadow-md' : 'hover:bg-blue-500'
                            }`}
                        >
                            Taxes
                        </button>
                    </nav>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-grow container mx-auto p-4 sm:p-6 mt-4">
                {renderModule()}
            </main>

            {/* Footer */}
            <footer className="bg-gray-800 text-white p-4 text-center mt-8">
                {userId && (
                    <p className="text-sm">Your User ID: <span className="font-mono bg-gray-700 p-1 rounded">{userId}</span></p>
                )}
                <p>&copy; 2025 BizFlow Accounting. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;
