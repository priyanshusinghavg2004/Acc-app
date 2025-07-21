
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import BillTemplates from './components/BillTemplates';
import Dashboard from './components/Dashboard';
import Items from './components/Items';
import Parties from './components/Parties';
import Sales from './components/Sales';
import Purchases from './components/Purchases';
import Manufacturing from './components/Manufacturing';
import Reports from './components/Reports';
import Taxes from './components/Taxes';
import CompanyDetails from './components/CompanyDetails';
import { auth, db } from './firebase.config';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const appId = 'acc-app-e5316'; // Use the Firebase project ID

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Navigation */}
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-gray-800">Acc-App</span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link to="/" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Dashboard
                  </Link>
                  <Link to="/items" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Items
                  </Link>
                  <Link to="/parties" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Parties
                  </Link>
                  <Link to="/sales" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Sales
                  </Link>
                  <Link to="/purchases" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Purchases
                  </Link>
                  <Link to="/manufacturing" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Manufacturing
                  </Link>
                  <Link to="/reports" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Reports
                  </Link>
                  <Link to="/taxes" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Taxes
                  </Link>
                  <Link to="/bill-templates" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Bill Templates
                  </Link>
                  <Link to="/company" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300">
                    Company
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/items" element={
              <Items 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/parties" element={
              <Parties 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/sales" element={
              <Sales 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/purchases" element={
              <Purchases 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/manufacturing" element={
              <Manufacturing 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/reports" element={
              <Reports 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/taxes" element={
              <Taxes 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/bill-templates" element={
              <BillTemplates 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
            <Route path="/company" element={
              <CompanyDetails 
                db={db}
                userId={user?.uid}
                isAuthReady={isAuthReady}
                appId={appId}
              />
            } />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
