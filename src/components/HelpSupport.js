import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const HelpSupport = ({ isVisible, onClose, onStartTour }) => {
  const [activeTab, setActiveTab] = useState('help');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContent, setFilteredContent] = useState([]);
  const location = useLocation();

  const helpContent = {
    dashboard: {
      title: 'Dashboard',
      content: [
        {
          question: 'How do I view my business metrics?',
          answer: 'The dashboard automatically displays your key business metrics including total sales, purchases, payments, and recent transactions. Use the date filters to view data for specific periods.'
        },
        {
          question: 'What are Quick Actions?',
          answer: 'Quick Actions provide instant access to your most used features. Click on Sales, Purchases, Payments, or Parties to quickly navigate to those sections.'
        },
        {
          question: 'How do I interpret the charts?',
          answer: 'The charts show your business trends over time. Bar charts display monthly comparisons, pie charts show payment status distribution, and area charts track cumulative performance.'
        }
      ]
    },
    sales: {
      title: 'Sales Management',
      content: [
        {
          question: 'How do I create a new sale?',
          answer: 'Click the "Add Sale" button, fill in the customer details, add items with quantities and prices, and save. You can also generate invoices and receipts.'
        },
        {
          question: 'Can I edit a sale after creating it?',
          answer: 'Yes, you can edit sales by clicking the edit icon in the sales list. However, once an invoice is generated, some fields may be restricted.'
        },
        {
          question: 'How do I generate invoices?',
          answer: 'After creating a sale, click the "Generate Invoice" button. You can customize the invoice template and download it as PDF.'
        }
      ]
    },
    purchases: {
      title: 'Purchase Management',
      content: [
        {
          question: 'How do I record a purchase?',
          answer: 'Click "Add Purchase", enter supplier details, add items with costs, and save. This helps track your expenses and inventory.'
        },
        {
          question: 'What\'s the difference between Purchase Order and Purchase Bill?',
          answer: 'Purchase Order is created before receiving goods, while Purchase Bill is created after receiving goods. This helps track the complete purchase cycle.'
        },
        {
          question: 'How do I manage suppliers?',
          answer: 'Go to Parties section and add suppliers with their contact details. You can track all transactions with each supplier.'
        }
      ]
    },
    payments: {
      title: 'Payment Management',
      content: [
        {
          question: 'How do I record payments?',
          answer: 'Navigate to Payments section, click "Add Payment", select the party, choose payment type, enter amount and date, then save.'
        },
        {
          question: 'What payment types are supported?',
          answer: 'We support Cash, Bank Transfer, Cheque, UPI, and other digital payment methods. You can add custom payment types as needed.'
        },
        {
          question: 'How do I track outstanding payments?',
          answer: 'The dashboard shows outstanding amounts. You can also filter payments by status (Paid, Pending, Overdue) in the Payments section.'
        }
      ]
    },
    parties: {
      title: 'Party Management',
      content: [
        {
          question: 'How do I add a new customer or supplier?',
          answer: 'Go to Parties section, click "Add Party", fill in the details including name, contact, address, and type (Customer/Supplier), then save.'
        },
        {
          question: 'Can I categorize parties?',
          answer: 'Yes, you can categorize parties as Customers, Suppliers, or Both. You can also add custom categories for better organization.'
        },
        {
          question: 'How do I view party history?',
          answer: 'Click on any party in the list to view their complete transaction history, outstanding amounts, and contact details.'
        }
      ]
    },
    offline: {
      title: 'Offline Functionality',
      content: [
        {
          question: 'How does offline mode work?',
          answer: 'The app automatically works offline. Your data is stored locally and syncs with the server when you\'re back online.'
        },
        {
          question: 'What happens to my data when offline?',
          answer: 'All your actions are saved locally first. When you reconnect, the app automatically syncs all changes with the server.'
        },
        {
          question: 'How do I know if I\'m offline?',
          answer: 'Look for the offline indicator at the top of the screen. It shows your connection status and pending sync actions.'
        }
      ]
    },
    mobile: {
      title: 'Mobile Usage',
      content: [
        {
          question: 'How do I navigate on mobile?',
          answer: 'Use the bottom navigation bar for quick access to main sections. The sidebar menu is also available for additional options.'
        },
        {
          question: 'Can I use touch gestures?',
          answer: 'Yes! Swipe left on tables for more actions, long press to zoom charts, and pull down to refresh data.'
        },
        {
          question: 'How do I optimize for mobile?',
          answer: 'The app automatically adapts to your screen size. For best experience, use the latest version of your mobile browser.'
        }
      ]
    }
  };

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          question: 'Is my data secure?',
          answer: 'Yes, we use industry-standard encryption and secure cloud storage. Your data is backed up regularly and accessible only to you.'
        },
        {
          question: 'Can I export my data?',
          answer: 'Yes, you can export reports as PDF or Excel files. Go to Reports section and use the export options.'
        },
        {
          question: 'How do I backup my data?',
          answer: 'Your data is automatically backed up to the cloud. You can also export important reports for local backup.'
        }
      ]
    },
    {
      category: 'Technical',
      questions: [
        {
          question: 'What browsers are supported?',
          answer: 'We support Chrome, Firefox, Safari, and Edge. For mobile, use the latest version of your browser.'
        },
        {
          question: 'How do I clear my cache?',
          answer: 'Go to your browser settings and clear browsing data. This can help resolve loading issues.'
        },
        {
          question: 'What if the app is slow?',
          answer: 'Try refreshing the page, clearing browser cache, or checking your internet connection. Offline mode can help with slow connections.'
        }
      ]
    }
  ];

  

  useEffect(() => {
    // Filter content based on current page and search query
    const currentPage = location.pathname.split('/')[1] || 'dashboard';
    const pageContent = helpContent[currentPage] || helpContent.dashboard;
    
    if (searchQuery.trim()) {
      const filtered = pageContent.content.filter(item =>
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContent(filtered);
    } else {
      setFilteredContent(pageContent.content);
    }
  }, [searchQuery, location.pathname]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const renderHelpContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={handleSearch}
          className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Current Page Help */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Help for {helpContent[location.pathname.split('/')[1] || 'dashboard']?.title || 'Dashboard'}
        </h3>
        <div className="space-y-4">
          {filteredContent.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">{item.question}</h4>
              <p className="text-gray-700 text-sm leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All Help Topics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Help Topics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(helpContent).map(([key, section]) => (
            <div key={key} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="font-medium text-gray-900 mb-2">{section.title}</h4>
              <p className="text-gray-600 text-sm">
                {section.content.length} help articles available
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTourLibrary = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Tour Library</h3>
      <p className="text-sm text-gray-600">Choose a guided tour for any module.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { id: 'dashboard', title: 'Dashboard Tour', desc: 'Overview, quick actions, outstanding.' },
          { id: 'parties', title: 'Parties Tour', desc: 'Add/edit parties, list and filters.' },
          { id: 'items', title: 'Items Tour', desc: 'Create items, rates, tax, HSN.' },
          { id: 'sales', title: 'Sales Tour', desc: 'Invoices, challans, quotations.' },
          { id: 'purchases', title: 'Purchases Tour', desc: 'Bills and orders workflow.' },
          { id: 'payments', title: 'Payments Tour', desc: 'Receipts, payments, advances.' },
          { id: 'expenses', title: 'Expenses Tour', desc: 'Fixed, variable, salaries.' },
          { id: 'reports', title: 'Reports Tour', desc: 'Report list and parameters.' },
          { id: 'taxes', title: 'Taxes Tour', desc: 'GST summary and HSN views.' },
          { id: 'full', title: 'Full Product Tour', desc: 'Back-to-back tours starting at Dashboard.' }
        ].map(card => (
          <div key={card.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{card.title}</div>
              <div className="text-gray-600 text-sm">{card.desc}</div>
            </div>
            <button
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => onStartTour && onStartTour(card.id)}
            >
              Start
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFAQs = () => (
    <div className="space-y-6">
      {faqs.map((category, categoryIndex) => (
        <div key={categoryIndex}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{category.category}</h3>
          <div className="space-y-4">
            {category.questions.map((item, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{item.question}</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderContact = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Need More Help?</h3>
        <p className="text-blue-800 text-sm mb-4">
          Our support team is here to help you get the most out of ACCTOO.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">📧</span>
            <h4 className="font-medium text-gray-900">Email Support</h4>
          </div>
          <p className="text-gray-600 text-sm mb-3">
            Send us an email and we'll get back to you within 24 hours.
          </p>
                      <a href="mailto:support@acctoo.com" className="text-blue-600 text-sm font-medium hover:text-blue-700">
              support@acctoo.com
          </a>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">💬</span>
            <h4 className="font-medium text-gray-900">Live Chat</h4>
          </div>
          <p className="text-gray-600 text-sm mb-3">
            Chat with our support team during business hours.
          </p>
          <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
            Start Chat
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">📞</span>
            <h4 className="font-medium text-gray-900">Phone Support</h4>
          </div>
          <p className="text-gray-600 text-sm mb-3">
            Call us for immediate assistance.
          </p>
          <a href="tel:+1234567890" className="text-blue-600 text-sm font-medium hover:text-blue-700">
            +1 (234) 567-890
          </a>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">📚</span>
            <h4 className="font-medium text-gray-900">Documentation</h4>
          </div>
          <p className="text-gray-600 text-sm mb-3">
            Access our comprehensive user guide and API documentation.
          </p>
          <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
            View Docs
          </button>
        </div>
      </div>
    </div>
  );

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">❓</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Help & Support</h2>
                <p className="text-sm text-gray-500">Get help with using ACCTOO</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100">
          <div className="flex space-x-8 px-6">
            {[
              { id: 'help', label: 'Help', icon: '❓' },
              { id: 'faqs', label: 'FAQs', icon: '❔' },
              { id: 'tours', label: 'Tour Library', icon: '🧭' },
              { id: 'contact', label: 'Contact', icon: '📞' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'help' && renderHelpContent()}
          {activeTab === 'faqs' && renderFAQs()}
          {activeTab === 'tours' && renderTourLibrary()}
          {activeTab === 'contact' && renderContact()}
        </div>
      </div>
    </div>
  );
};

export default HelpSupport; 