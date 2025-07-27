
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
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
import Payments from './components/Payments';
import Expenses from './components/Expenses';
import { auth, db } from './firebase.config';
import { onAuthStateChanged } from 'firebase/auth';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { MenuIcon, XIcon } from '@heroicons/react/outline';

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
  // Dropdown state for desktop/mobile
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownFocusIdx, setDropdownFocusIdx] = useState(-1);
  const [dropdownOpenedByClick, setDropdownOpenedByClick] = useState(false);
  const dropdownRefs = useRef([]);
  const navBarRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenGroup, setMobileOpenGroup] = useState(null);
  const mobileMenuRef = useRef(null);
  // Remove manualUserId and useManualUserId state
  // const manualUserId = "tVzTkH95LXYZbPcQeEsMUnByZ3R2"; // Set your manual UID here
  // const [useManualUserId, setUseMan
  // Remove effectiveUserId logic
  // const effectiveUserId = useManualUserId ? manualUserId : user?.uid;
  const [companyDetails, setCompanyDetails] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (openDropdown !== null) {
      setDropdownFocusIdx(0);
    } else {
      setDropdownFocusIdx(-1);
      setDropdownOpenedByClick(false);
    }
  }, [openDropdown]);

  useEffect(() => {
    if (openDropdown !== null && dropdownFocusIdx >= 0 && dropdownRefs.current[dropdownFocusIdx]) {
      dropdownRefs.current[dropdownFocusIdx].focus();
    }
  }, [dropdownFocusIdx, openDropdown]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!dropdownOpenedByClick) return;
    function handleClickOutside(event) {
      if (
        navBarRef.current &&
        !navBarRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpenedByClick]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClickOutside(event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
        setMobileOpenGroup(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Fetch company details for logo/avatar
  useEffect(() => {
    if (!db || !user?.uid || !isAuthReady) return;
    const docRef = doc(db, `artifacts/${appId}/users/${user.uid}/companyDetails`, 'myCompany');
    getDoc(docRef).then(docSnap => {
      if (docSnap.exists()) setCompanyDetails(docSnap.data());
    });
  }, [db, user, isAuthReady, appId]);

  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarRef = useRef(null);
  // Close avatar dropdown on outside click
  useEffect(() => {
    if (!avatarDropdownOpen) return;
    function handleClickOutside(event) {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setAvatarDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarDropdownOpen]);

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

  // Navigation groups for dropdowns
  const navGroups = [
    {
      label: 'Dashboard',
      links: [
        { to: '/', label: 'Dashboard' },
      ],
    },
    {
      label: 'Sales & Purchases',
      links: [
        { to: '/sales', label: 'Sales' },
        { to: '/purchases', label: 'Purchases' },
        { to: '/payments', label: 'Payments' },
        { to: '/parties', label: 'Parties' },
      ],
    },
    {
      label: 'Inventory & Manufacturing',
      links: [
        { to: '/items', label: 'Items' },
        { to: '/manufacturing', label: 'Manufacturing' },
      ],
    },
    {
      label: 'Reports & Analysis',
      links: [
        { to: '/reports', label: 'Reports' },
        { to: '/taxes', label: 'Taxes' },
      ],
    },
    {
      label: 'Company & Settings',
      links: [
        { to: '/company', label: 'Company Details' },
        { to: '/bill-templates', label: 'Bill Templates' },
      ],
    },
  ];

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 w-full z-50 bg-white shadow">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center flex-1 min-w-0">
                <div className="flex-shrink-0 flex items-center mr-4">
                  <span className="text-xl font-bold text-gray-800">Acc-App</span>
                </div>
                {/* Desktop menu */}
                <div className="hidden lg:flex lg:space-x-6 items-center flex-1">
                  {navGroups.map((group, idx) => (
                    group.links.length === 1 ? (
                      <Link
                        key={group.label}
                        to={group.links[0].to}
                        className="text-gray-900 inline-flex items-center px-2 py-1 border-b-2 border-transparent hover:border-gray-300 text-sm whitespace-nowrap"
                      >
                        {group.links[0].label}
                      </Link>
                    ) : (
                      <div
                        key={group.label}
                        className="relative"
                        onMouseEnter={() => {
                          if (!dropdownOpenedByClick) setOpenDropdown(idx);
                        }}
                        onMouseLeave={() => {
                          if (!dropdownOpenedByClick) setOpenDropdown(null);
                        }}
                      >
                        <button
                          className="text-gray-900 inline-flex items-center px-2 py-1 border-b-2 border-transparent hover:border-gray-300 text-sm whitespace-nowrap focus:outline-none"
                          onClick={e => {
                            e.stopPropagation();
                            if (openDropdown === idx && dropdownOpenedByClick) {
                              setOpenDropdown(null);
                              setDropdownOpenedByClick(false);
                            } else {
                              setOpenDropdown(idx);
                              setDropdownOpenedByClick(true);
                            }
                          }}
                          aria-haspopup="true"
                          aria-expanded={openDropdown === idx}
                          type="button"
                          style={{ background: 'transparent', border: 'none' }}
                          onKeyDown={e => {
                            if (openDropdown === idx) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setDropdownFocusIdx(i => (i + 1) % group.links.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setDropdownFocusIdx(i => (i - 1 + group.links.length) % group.links.length);
                              } else if (e.key === 'Escape') {
                                setOpenDropdown(null);
                                setDropdownOpenedByClick(false);
                              }
                            } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                              setOpenDropdown(idx);
                              setDropdownOpenedByClick(true);
                            }
                          }}
                        >
                          {group.label}
                        </button>
                        {openDropdown === idx && (
                          <div className="absolute left-0 mt-2 min-w-[180px] bg-gray-900 border border-gray-400 rounded shadow-lg z-50">
                            {group.links.map((link, linkIdx) => (
                              <Link
                                key={link.to}
                                to={link.to}
                                className="block px-4 py-2 text-white hover:bg-gray-700 text-sm whitespace-nowrap"
                                tabIndex={0}
                                ref={el => dropdownRefs.current[linkIdx] = el}
                                onClick={() => {
                                  setOpenDropdown(null);
                                  setDropdownOpenedByClick(false);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setDropdownFocusIdx(i => (i + 1) % group.links.length);
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setDropdownFocusIdx(i => (i - 1 + group.links.length) % group.links.length);
                                  } else if (e.key === 'Escape') {
                                    setOpenDropdown(null);
                                    setDropdownOpenedByClick(false);
                                  } else if (e.key === 'Enter' || e.key === ' ') {
                                    e.currentTarget.click();
                                  }
                                }}
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  ))}
                  {/* Expenses as a single link */}
                  <Link
                    to="/expenses"
                    className="text-gray-900 inline-flex items-center px-2 py-1 border-b-2 border-transparent hover:border-gray-300 text-sm whitespace-nowrap"
                  >
                    Expenses
                  </Link>
                </div>
              </div>
              {/* Desktop: User avatar/profile dropdown */}
              <div className="hidden lg:flex items-center ml-4 relative" ref={avatarRef}>
                <button
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 border-2 border-white shadow focus:outline-none z-50"
                  onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
                  aria-label="User menu"
                  style={{ position: 'relative', top: '0.5rem' }}
                >
                  {companyDetails.logoUrl ? (
                    <img src={companyDetails.logoUrl} alt="Company Logo" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gray-700">{companyDetails.firmName ? companyDetails.firmName[0] : 'U'}</span>
                  )}
                </button>
                {avatarDropdownOpen && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 mt-0 pt-8 w-64 bg-white border border-gray-200 rounded shadow-lg z-40 flex flex-col items-center" style={{ minWidth: '16rem', top: '2.5rem' }}>
                    {/* Overlapping avatar on top of card */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow z-50">
                      {companyDetails.logoUrl ? (
                        <img src={companyDetails.logoUrl} alt="Company Logo" className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-gray-700">{companyDetails.firmName ? companyDetails.firmName[0] : 'U'}</span>
                      )}
                    </div>
                    <div className="pt-10 pb-2 px-4 w-full text-center">
                      <div className="font-bold text-base text-gray-900">{companyDetails.firmName || 'Company Name'}</div>
                      {companyDetails.email && <div className="text-xs text-gray-600">{companyDetails.email}</div>}
                    </div>
                    <div className="text-xs text-gray-700 space-y-1 mb-3 px-4 w-full text-left">
                      {companyDetails.gstin && <div><span className="font-semibold">GSTIN:</span> {companyDetails.gstin}</div>}
                      {companyDetails.address && <div><span className="font-semibold">Address:</span> {companyDetails.address}</div>}
                      {companyDetails.city && <div><span className="font-semibold">City:</span> {companyDetails.city}</div>}
                      {companyDetails.state && <div><span className="font-semibold">State:</span> {companyDetails.state}</div>}
                      {companyDetails.pincode && <div><span className="font-semibold">Pincode:</span> {companyDetails.pincode}</div>}
                      {companyDetails.contactNumber && <div><span className="font-semibold">Contact:</span> {companyDetails.contactNumber}</div>}
                    </div>
                    <div className="border-t border-gray-200 my-2 w-full"></div>
                    <button
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 text-sm"
                      onClick={() => signOut(auth)}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
              {/* Hamburger button for mobile - floating on very small screens */}
              <div>
                <button
                  className="p-2 rounded-full bg-white shadow-lg border border-gray-200 block lg:hidden fixed top-4 right-4 z-[100] sm:static sm:shadow sm:border-none sm:top-auto sm:right-auto"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Open menu"
                >
                  {mobileMenuOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="12" fill="white" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8M8 16h8M8 8h8" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </nav>
        {/* Add top padding to main content so it's not hidden behind navbar */}
        <div className="pt-24 md:pt-20 max-w-6xl mx-auto px-4">
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
            <Route path="/payments" element={
              <Payments 
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
            <Route path="/expenses" element={
              <Expenses 
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
