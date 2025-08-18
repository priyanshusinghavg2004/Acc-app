import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { APP_ID } from '../utils/appArtifacts';

const LandingPage = () => {
  const [site, setSite] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ref = doc(db, 'artifacts', APP_ID, 'backoffice_website', 'content');
        const snap = await getDoc(ref);
        if (snap.exists()) setSite(snap.data());
      } catch (e) {
        // ignore
      }
    };
    load();
  }, []);

  const hero = site?.hero || {
    title: 'Smart Accounting for',
    highlight: ' Modern Business',
    subtitle: "Streamline your business finances with India's most comprehensive accounting software.",
    primaryCtaText: 'Start Free Trial',
    secondaryCtaText: 'Watch Demo'
  };
  const pricing = site?.pricing || { basicPrice: 999, trialText: 'After 3 months free trial' };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img src="/Logoacctoo.png" alt="Acctoo" className="h-10 w-auto" />
              <span className="ml-3 text-2xl font-bold text-gray-900">Acctoo</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Features</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">Pricing</a>
              <Link to="/login" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 font-semibold shadow-md">
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8">
              <img src="/Logoacctoo.png" alt="Acctoo" className="h-20 w-auto mx-auto mb-6" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
              {hero.title}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{hero.highlight}</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-4xl mx-auto leading-relaxed">
              {hero.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link to="/login" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-4 rounded-xl text-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                {hero.primaryCtaText}
              </Link>
              <button className="border-2 border-blue-600 text-blue-600 px-10 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-md hover:shadow-lg">
                {hero.secondaryCtaText}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Everything You Need to Manage Your Business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From invoicing to reporting, Acctoo provides all the tools you need to run your business efficiently.
            </p>
          </div>
          
          {/* Main Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {/* Dashboard */}
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Dashboard</h3>
              <p className="text-gray-600 leading-relaxed mb-4">Real-time overview of your business with sales analytics, outstanding receivables, payables, and task management.</p>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">Sales This Month</span>
                  <span className="text-sm text-blue-600">₹2,45,000</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">Outstanding Receivables</span>
                  <span className="text-sm text-green-600">₹1,20,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-700">Pending Tasks</span>
                  <span className="text-sm text-orange-600">5</span>
                </div>
              </div>
            </div>
            
            {/* Sales & Invoicing */}
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-200">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Sales & Invoicing</h3>
              <p className="text-gray-600 leading-relaxed mb-4">Create professional invoices, quotations, and challans with GST calculation and multiple payment modes.</p>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">Invoice Templates</span>
                  <span className="text-sm text-green-600">Professional</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">GST Calculation</span>
                  <span className="text-sm text-green-600">Auto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700">Payment Modes</span>
                  <span className="text-sm text-green-600">Multiple</span>
                </div>
              </div>
            </div>
            
            {/* Purchase Management */}
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-purple-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Purchase Management</h3>
              <p className="text-gray-600 leading-relaxed mb-4">Manage purchase orders, bills, and vendor relationships with complete purchase history tracking.</p>
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-700">Purchase Orders</span>
                  <span className="text-sm text-purple-600">Create & Track</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-700">Vendor Management</span>
                  <span className="text-sm text-purple-600">Complete</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-700">Bill Tracking</span>
                  <span className="text-sm text-purple-600">Real-time</span>
                </div>
              </div>
            </div>
            
            {/* Payment Tracking */}
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Payment Tracking</h3>
              <p className="text-gray-600 leading-relaxed mb-4">Track all payments, manage receivables and payables with automated reconciliation and receipt generation.</p>
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-700">Payment Modes</span>
                  <span className="text-sm text-orange-600">Cash, UPI, Bank</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-700">Receipt Generation</span>
                  <span className="text-sm text-orange-600">Auto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-700">Outstanding Tracking</span>
                  <span className="text-sm text-orange-600">Real-time</span>
                </div>
              </div>
            </div>
            
            {/* Advanced Reports */}
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-indigo-200">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Advanced Reports</h3>
              <p className="text-gray-600 leading-relaxed mb-4">Generate comprehensive reports including GST, profit & loss, balance sheet, and custom analytics.</p>
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-indigo-700">GST Reports</span>
                  <span className="text-sm text-indigo-600">GSTR-1, GSTR-3B</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-indigo-700">Financial Reports</span>
                  <span className="text-sm text-indigo-600">P&L, Balance Sheet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-700">Custom Analytics</span>
                  <span className="text-sm text-indigo-600">Advanced</span>
                </div>
              </div>
            </div>
            
            {/* Party Management */}
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-red-200">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Party Management</h3>
              <p className="text-gray-600 leading-relaxed mb-4">Manage customers and suppliers with complete contact and transaction history, outstanding tracking.</p>
              <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-700">Customer Management</span>
                  <span className="text-sm text-red-600">Complete</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-700">Supplier Tracking</span>
                  <span className="text-sm text-red-600">Real-time</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">Transaction History</span>
                  <span className="text-sm text-red-600">Detailed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Features Section */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-12 mb-16">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Powerful Features for Every Business Need
              </h3>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Discover how Acctoo streamlines your entire business workflow
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left Column - Core Features */}
              <div>
                <h4 className="text-2xl font-bold text-gray-900 mb-8">Core Business Features</h4>
                
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Professional Invoicing</h5>
                      <p className="text-gray-600">Create beautiful, branded invoices with automatic GST calculation, multiple payment terms, and professional templates.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Purchase Management</h5>
                      <p className="text-gray-600">Track purchase orders, manage vendor relationships, and maintain complete purchase history with automated bill tracking.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Payment Tracking</h5>
                      <p className="text-gray-600">Automated payment tracking with multiple payment modes, receipt generation, and real-time outstanding calculations.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Party Management</h5>
                      <p className="text-gray-600">Complete customer and supplier database with contact details, transaction history, and outstanding balance tracking.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Advanced Features */}
              <div>
                <h4 className="text-2xl font-bold text-gray-900 mb-8">Advanced Features</h4>
                
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">GST Compliance</h5>
                      <p className="text-gray-600">Automatic GST calculation, GSTR-1 and GSTR-3B report generation, and complete tax compliance management.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Financial Reports</h5>
                      <p className="text-gray-600">Generate profit & loss statements, balance sheets, cash flow reports, and custom analytics for better decision making.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Mobile App</h5>
                      <p className="text-gray-600">Access your business data on the go with our mobile app for iOS and Android devices.</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-2">Data Security</h5>
                      <p className="text-gray-600">Bank-level security with encrypted data storage, regular backups, and secure cloud infrastructure.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-4 font-semibold text-gray-900">Feature</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-900">Basic</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-900">Pro</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-900">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">Transactions per month</td>
                    <td className="py-4 px-4 text-center text-gray-600">500</td>
                    <td className="py-4 px-4 text-center text-gray-400">Unlimited</td>
                    <td className="py-4 px-4 text-center text-gray-400">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">Invoice Management</td>
                    <td className="py-4 px-4 text-center text-green-600">✓</td>
                    <td className="py-4 px-4 text-center text-gray-400">✓</td>
                    <td className="py-4 px-4 text-center text-gray-400">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">GST Reports</td>
                    <td className="py-4 px-4 text-center text-green-600">✓</td>
                    <td className="py-4 px-4 text-center text-gray-400">✓</td>
                    <td className="py-4 px-4 text-center text-gray-400">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">Advanced Reports</td>
                    <td className="py-4 px-4 text-center text-gray-600">Basic</td>
                    <td className="py-4 px-4 text-center text-gray-400">Advanced</td>
                    <td className="py-4 px-4 text-center text-gray-400">Advanced</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">Multi-user Access</td>
                    <td className="py-4 px-4 text-center text-gray-600">1 User</td>
                    <td className="py-4 px-4 text-center text-gray-400">Up to 5</td>
                    <td className="py-4 px-4 text-center text-gray-400">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">API Integration</td>
                    <td className="py-4 px-4 text-center text-gray-600">✗</td>
                    <td className="py-4 px-4 text-center text-gray-400">✓</td>
                    <td className="py-4 px-4 text-center text-gray-400">✓</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-gray-900">Priority Support</td>
                    <td className="py-4 px-4 text-center text-gray-600">Email</td>
                    <td className="py-4 px-4 text-center text-gray-400">Priority</td>
                    <td className="py-4 px-4 text-center text-gray-400">Dedicated</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start with our free trial and upgrade when you're ready
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Acctoo Basic - Current Plan */}
            <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-green-500 hover:shadow-2xl transition-all duration-300 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                  Current
                </span>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Acctoo Basic</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-4xl font-bold text-gray-900">₹{pricing.basicPrice}</span>
                    <span className="text-gray-600 ml-2">/year</span>
                  </div>
                  <p className="text-lg text-gray-600">{pricing.trialText}</p>
                </div>
                <p className="text-gray-600">Perfect for small businesses</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Up to 500 transactions/month</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Basic invoice management</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">GST compliance</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Basic reports</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">Email support</span>
                </li>
              </ul>
              
              <div className="text-center">
                <Link to="/login" className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 inline-block">
                  Start 3-Month Free Trial
                </Link>
                <p className="text-sm text-gray-500 mt-4">* Terms and conditions apply</p>
              </div>
            </div>
            
            {/* Acctoo Pro - Coming Soon */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200 hover:shadow-xl transition-all duration-300 relative opacity-75">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                  Coming Soon
                </span>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Acctoo Pro</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-4xl font-bold text-gray-400">₹1,999</span>
                    <span className="text-gray-400 ml-2">/year</span>
                  </div>
                  <p className="text-lg text-gray-400">After 3 months free trial</p>
                </div>
                <p className="text-gray-400">Ideal for growing businesses</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Unlimited transactions</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Advanced features</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Multi-user access</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Priority support</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">API integration</span>
                </li>
              </ul>
              
              <div className="text-center">
                <button className="w-full bg-gray-300 text-gray-500 px-6 py-3 rounded-xl font-semibold cursor-not-allowed">
                  Coming Soon
                </button>
                <p className="text-sm text-gray-400 mt-4">Notify me when available</p>
              </div>
            </div>
            
            {/* Acctoo Enterprise - Coming Soon */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200 hover:shadow-xl transition-all duration-300 relative opacity-75">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                  Coming Soon
                </span>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Acctoo Enterprise</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-4xl font-bold text-gray-400">Custom</span>
                  </div>
                  <p className="text-lg text-gray-400">Contact for pricing</p>
                </div>
                <p className="text-gray-400">For large organizations</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Everything in Pro</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Unlimited users</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Dedicated support</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">Custom integrations</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-400">White-label solution</span>
                </li>
              </ul>
              
              <div className="text-center">
                <button className="w-full bg-gray-300 text-gray-500 px-6 py-3 rounded-xl font-semibold cursor-not-allowed">
                  Coming Soon
                </button>
                <p className="text-sm text-gray-400 mt-4">Contact sales for details</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Free Trial Benefits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">What You Get:</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">3 months completely free</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Full feature access</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">No credit card required</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Cancel anytime</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Perfect For:</h4>
                  <ul className="space-y-3">
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Small businesses</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Startups</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Freelancers</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">Solo entrepreneurs</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing FAQ Section */}
          <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">How does the free trial work?</h4>
                  <p className="text-gray-600">Start your 3-month free trial immediately with full access to all features. No credit card required. You can cancel anytime during the trial period.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">What happens after the trial ends?</h4>
                  <p className="text-gray-600">After 3 months, you'll be automatically charged ₹999/year for Acctoo Basic. You can upgrade to Pro or Enterprise plans when they become available.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Can I cancel my subscription?</h4>
                  <p className="text-gray-600">Yes, you can cancel your subscription at any time. Your data will be preserved for 30 days after cancellation.</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Is my data secure?</h4>
                  <p className="text-gray-600">Absolutely! We use bank-level encryption and secure cloud infrastructure. Your data is backed up regularly and protected with industry-standard security measures.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Do you offer support?</h4>
                  <p className="text-gray-600">Yes! Basic plan includes email support. Pro and Enterprise plans will include priority and dedicated support respectively.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Can I export my data?</h4>
                  <p className="text-gray-600">Yes, you can export your data in various formats including PDF, Excel, and CSV at any time.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Testimonials */}
          <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">What Our Customers Say</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold">RK</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Rajesh Kumar</h4>
                    <p className="text-sm text-gray-600">Kumar Traders</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">"Acctoo has transformed our accounting process. The GST reports are accurate and save us hours every month."</p>
                <div className="flex items-center mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-green-600 font-semibold">PS</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Priya Sharma</h4>
                    <p className="text-sm text-gray-600">Sharma Enterprises</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">"The mobile app is fantastic! I can manage my business finances from anywhere. Highly recommended!"</p>
                <div className="flex items-center mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-purple-600 font-semibold">AP</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Amit Patel</h4>
                    <p className="text-sm text-gray-600">Patel Manufacturing</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">"Best accounting software for Indian businesses. The manufacturing module is exactly what we needed."</p>
                <div className="flex items-center mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">30-Day Money Back Guarantee</h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Not satisfied with Acctoo? Get a full refund within 30 days of your first paid subscription. 
                No questions asked. We're confident you'll love our platform.
              </p>
              <div className="flex items-center justify-center space-x-8 text-sm text-gray-600">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Full refund</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>No questions asked</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>30 days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
            Join thousands of businesses that trust Acctoo for their accounting needs. 
            Start your free trial today and see the difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/login" className="bg-white text-blue-600 px-10 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              Start Free Trial
            </Link>
            <button className="border-2 border-white text-white px-10 py-4 rounded-xl text-lg font-semibold hover:bg-white hover:text-blue-600 transition-all duration-300 shadow-lg hover:shadow-xl">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <img src="/Logoacctoo.png" alt="Acctoo" className="h-10 w-auto" />
                <span className="ml-3 text-2xl font-bold">Acctoo</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Smart accounting software designed for Indian businesses. Streamline your finances and grow with confidence.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Acctoo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 