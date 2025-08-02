import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';

const AdvancedSearch = ({ db, userId, appId, isVisible, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModule, setSelectedModule] = useState('all');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    status: 'all',
    type: 'all'
  });
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const modules = [
    { id: 'all', label: 'All Modules', icon: '🔍', color: 'bg-gray-500' },
    { id: 'sales', label: 'Sales', icon: '💰', color: 'bg-green-500' },
    { id: 'purchases', label: 'Purchases', icon: '🛒', color: 'bg-blue-500' },
    { id: 'payments', label: 'Payments', icon: '💳', color: 'bg-purple-500' },
    { id: 'parties', label: 'Parties', icon: '👥', color: 'bg-orange-500' },
    { id: 'items', label: 'Items', icon: '📦', color: 'bg-teal-500' },
    { id: 'expenses', label: 'Expenses', icon: '💸', color: 'bg-red-500' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partial' }
  ];

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'receipt', label: 'Receipt' },
    { value: 'bill', label: 'Bill' },
    { value: 'payment', label: 'Payment' }
  ];

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`searchHistory_${userId}`);
    if (saved) {
      const history = JSON.parse(saved);
      setRecentSearches(history.slice(0, 5));
      setSearchHistory(history);
    }
  }, [userId]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isVisible && searchInputRef.current) {
      setTimeout(() => searchInputRef.current.focus(), 100);
    }
  }, [isVisible]);

  // Save search to history
  const saveToHistory = (query, module) => {
    const newSearch = {
      query,
      module,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString()
    };
    
    const updatedHistory = [newSearch, ...searchHistory.filter(s => s.query !== query)].slice(0, 20);
    setSearchHistory(updatedHistory);
    setRecentSearches(updatedHistory.slice(0, 5));
    localStorage.setItem(`searchHistory_${userId}`, JSON.stringify(updatedHistory));
  };

  // Perform search with debouncing
  const performSearch = async (query, module = selectedModule, searchFilters) => {

    
    // Use filters state if no searchFilters provided
    const filtersToUse = searchFilters || filters || {
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      status: 'all',
      type: 'all'
    };
    
    // Check if all required parameters are available
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    if (!db) {
      console.error('❌ Database not initialized');
      setSearchResults([]);
      return;
    }
    
    if (!userId) {
      console.error('❌ User not authenticated');
      setSearchResults([]);
      return;
    }
    
    if (!appId) {
      console.error('❌ App ID not available');
      setSearchResults([]);
      return;
    }
    


    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = [];
      const searchTerm = query.toLowerCase();

      // Search in selected modules
      const modulesToSearch = module === 'all' ? modules.filter(m => m.id !== 'all') : [modules.find(m => m.id === module)];

      for (const moduleConfig of modulesToSearch) {
        const moduleResults = await searchInModule(moduleConfig.id, searchTerm, filtersToUse);
        results.push(...moduleResults);
      }

      // Sort results by relevance and date
      const sortedResults = results.sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.title.toLowerCase().includes(searchTerm) || a.content.toLowerCase().includes(searchTerm);
        const bExact = b.title.toLowerCase().includes(searchTerm) || b.content.toLowerCase().includes(searchTerm);
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then by date (newest first)
        return new Date(b.date) - new Date(a.date);
      });


      setSearchResults(sortedResults);
      saveToHistory(query, module);
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Search in specific module
  const searchInModule = async (moduleName, searchTerm, filtersToUse) => {
    
    const results = [];
    
    try {
      let collectionRef;
      let searchFields = [];

      switch (moduleName) {
        case 'sales':
          collectionRef = collection(db, `artifacts/${appId}/users/${userId}/sales`);
          searchFields = ['invoiceNumber', 'customerName', 'customerGstin', 'items'];
          break;
        case 'purchases':
          collectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchases`);
          searchFields = ['billNumber', 'supplierName', 'supplierGstin', 'items'];
          break;
        case 'payments':
          collectionRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
          searchFields = ['receiptNumber', 'partyName', 'paymentMode', 'remarks'];
          break;
        case 'parties':
          collectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
          searchFields = ['name', 'gstin', 'contactNumber', 'email', 'address'];
          break;
        case 'items':
          collectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
          searchFields = ['name', 'description', 'hsnCode', 'category'];
          break;
        case 'expenses':
          collectionRef = collection(db, `artifacts/${appId}/users/${userId}/expenses`);
          searchFields = ['description', 'category', 'paymentMode', 'remarks'];
          break;
        default:
          return results;
      }
      


      // Build query with filters
      let q = query(collectionRef, orderBy('date', 'desc'), limit(50));
      
      // Apply date filters if specified
      if (filtersToUse.dateFrom || filtersToUse.dateTo) {
        const conditions = [];
        if (filtersToUse.dateFrom) {
          conditions.push(where('date', '>=', new Date(filtersToUse.dateFrom)));
        }
        if (filtersToUse.dateTo) {
          conditions.push(where('date', '<=', new Date(filtersToUse.dateTo)));
        }
        q = query(collectionRef, ...conditions, orderBy('date', 'desc'), limit(50));
      }

             const querySnapshot = await getDocs(q);

       
       querySnapshot.forEach((doc) => {
        const data = doc.data();
        let matches = false;
        let content = '';

        // Check if any search field contains the search term
        for (const field of searchFields) {
          if (data[field]) {
            const fieldValue = Array.isArray(data[field]) 
              ? data[field].map(item => item.name || item.description || '').join(' ')
              : String(data[field]);
            
            if (fieldValue.toLowerCase().includes(searchTerm)) {
              matches = true;
              content += fieldValue + ' ';
            }
          }
        }

        // Apply amount filters
        if (filtersToUse.amountMin && data.amount < parseFloat(filtersToUse.amountMin)) {
          matches = false;
        }
        if (filtersToUse.amountMax && data.amount > parseFloat(filtersToUse.amountMax)) {
          matches = false;
        }

        // Apply status filter
        if (filtersToUse.status !== 'all' && data.status !== filtersToUse.status) {
          matches = false;
        }

        if (matches) {
          results.push({
            id: doc.id,
            module: moduleName,
            title: getResultTitle(data, moduleName),
            content: content.trim(),
            date: data.date?.toDate?.() || data.date || new Date(),
            amount: data.amount || data.totalAmount || 0,
            status: data.status || 'unknown',
            data: data
          });
        }
      });
         } catch (error) {
       console.error(`❌ Error searching in ${moduleName}:`, error);
     }


     return results;
  };

  // Get result title based on module and data
  const getResultTitle = (data, moduleName) => {
    switch (moduleName) {
      case 'sales':
        return `${data.invoiceNumber || 'Invoice'} - ${data.customerName || 'Customer'}`;
      case 'purchases':
        return `${data.billNumber || 'Bill'} - ${data.supplierName || 'Supplier'}`;
      case 'payments':
        return `${data.receiptNumber || 'Receipt'} - ${data.partyName || 'Party'}`;
      case 'parties':
        return `${data.name || 'Party'} - ${data.gstin || 'No GSTIN'}`;
      case 'items':
        return `${data.name || 'Item'} - ${data.hsnCode || 'No HSN'}`;
      case 'expenses':
        return `${data.description || 'Expense'} - ${data.category || 'Category'}`;
      default:
        return 'Result';
    }
  };

  // Handle search input change with debouncing
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setSearchResults([]);
    }
  };

  // Handle search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  // Handle result click
  const handleResultClick = (result) => {
    navigate(`/${result.module}`, { 
      state: { 
        searchResult: result,
        highlightId: result.id 
      } 
    });
    onClose();
  };

  // Clear search history
  const clearSearchHistory = () => {
    setSearchHistory([]);
    setRecentSearches([]);
    localStorage.removeItem(`searchHistory_${userId}`);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format amount
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Check if component should render
  if (!isVisible) return null;
  
  // Check if required props are available
  if (!db || !userId || !appId) {
    console.error('AdvancedSearch: Missing required props', { db: !!db, userId: !!userId, appId: !!appId });
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔍</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Advanced Search</h2>
              <p className="text-sm text-gray-600">Search across all modules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🔍</span>
            <span>Search</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📚</span>
            <span>History</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'search' ? (
            <div className="space-y-6">
              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search invoices, bills, parties, items..."
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Module Selection */}
                <div className="flex flex-wrap gap-2">
                  {modules.map((module) => (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => setSelectedModule(module.id)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedModule === module.id
                          ? `${module.color} text-white`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{module.icon}</span>
                      <span>{module.label}</span>
                    </button>
                  ))}
                </div>

                {/* Filters Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                  </svg>
                  <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                </button>

                {/* Filters */}
                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={filters.amountMin}
                        onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                      <input
                        type="number"
                        placeholder="∞"
                        value={filters.amountMax}
                        onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {typeOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </form>

              {/* Search Results */}
              <div className="space-y-4">
                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Searching...</span>
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    </h3>
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <div
                          key={`${result.module}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                                  {result.status}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {modules.find(m => m.id === result.module)?.icon} {modules.find(m => m.id === result.module)?.label}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900 mb-1">{result.title}</h4>
                              <p className="text-sm text-gray-600 mb-2">{result.content}</p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>{result.date.toLocaleDateString()}</span>
                                {result.amount > 0 && (
                                  <span className="font-medium">{formatAmount(result.amount)}</span>
                                )}
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isSearching && searchQuery && searchResults.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-600">Try adjusting your search terms or filters</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Search History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Searches</h3>
                {searchHistory.length > 0 && (
                  <button
                    onClick={clearSearchHistory}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {searchHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No search history</h3>
                  <p className="text-gray-600">Your recent searches will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchHistory.map((search, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setSearchQuery(search.query);
                        setSelectedModule(search.module);
                        setActiveTab('search');
                        performSearch(search.query, search.module);
                      }}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">
                          {modules.find(m => m.id === search.module)?.icon || '🔍'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{search.query}</p>
                          <p className="text-sm text-gray-500">
                            {modules.find(m => m.id === search.module)?.label} • {search.date}
                          </p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {searchResults.length > 0 && `Found ${searchResults.length} results`}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearch; 