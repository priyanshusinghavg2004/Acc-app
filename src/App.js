
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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCompany, setRegisterCompany] = useState('');
  const [registerError, setRegisterError] = useState('');
  const appId = 'acc-app-e5316'; // Use the Firebase project ID
  // Remove manualUserId and useManualUserId state
  // const manualUserId = "tVzTkH95LXYZbPcQeEsMUnByZ3R2"; // Set your manual UID here
  // const [useManualUserId, setUseMan
  // Remove effectiveUserId logic
  // const effectiveUserId = useManualUserId ? manualUserId : user?.uid;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');
    if (!registerCompany.trim()) {
      setRegisterError('Company name is required.');
      return;
    }
    if (!db || !appId) {
      setRegisterError('Database not initialized.');
      console.error('Database or appId is undefined!');
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const newUser = userCredential.user;
      console.log('New user created:', newUser.uid);
      // Create default company details document
      const docRef = doc(db, `artifacts/${appId}/users/${newUser.uid}/companyDetails`, 'myCompany');
      console.log('Creating company details at:', docRef.path);
      await setDoc(docRef, {
        firmName: registerCompany,
        email: registerEmail,
        createdAt: new Date().toISOString(),
      });
      console.log('Company details document created successfully.');
    } catch (err) {
      setRegisterError(err.message);
      console.error('Registration or Firestore error:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
          {showRegister ? (
            <form onSubmit={handleRegister}>
              <h2 className="text-2xl font-bold mb-4 text-center">Register</h2>
              {registerError && <div className="mb-2 text-red-600 text-sm">{registerError}</div>}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input type="text" value={registerCompany} onChange={e => setRegisterCompany(e.target.value)} required className="w-full border rounded p-2" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} required className="w-full border rounded p-2" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} required className="w-full border rounded p-2" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">Register</button>
              <div className="mt-4 text-center">
                <button type="button" className="text-blue-600 underline" onClick={() => setShowRegister(false)}>Already have an account? Login</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
              {loginError && <div className="mb-2 text-red-600 text-sm">{loginError}</div>}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full border rounded p-2" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full border rounded p-2" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">Login</button>
              <div className="mt-4 text-center">
                <button type="button" className="text-blue-600 underline" onClick={() => setShowRegister(true)}>New user? Register</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Navigation links for the navbar
  const navLinks = [
    { to: "/", label: "Dashboard" },
    { to: "/items", label: "Items" },
    { to: "/parties", label: "Parties" },
    { to: "/sales", label: "Sales" },
    { to: "/purchases", label: "Purchases" },
    { to: "/manufacturing", label: "Manufacturing" },
    { to: "/reports", label: "Reports" },
    { to: "/taxes", label: "Taxes" },
    { to: "/bill-templates", label: "Bill Templates" },
    { to: "/company", label: "Company" },
  ];

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Navigation */}
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-gray-800">Acc-App</span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8 items-center">
                  {navLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
              <button
                onClick={() => signOut(auth)}
                className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700"
              >
                Logout
              </button>
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
