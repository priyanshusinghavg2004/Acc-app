import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase.config';

const QuickSearch = ({ onAdvancedSearch, placeholder = "Quick search...", appId, userId }) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const timeoutRef = useRef(null);

  // Quick search suggestions based on common patterns
  const quickSuggestions = [
    { type: 'invoice', label: 'Search invoices', icon: '💰', action: () => navigate('/sales') },
    { type: 'bill', label: 'Search bills', icon: '🛒', action: () => navigate('/purchases') },
    { type: 'party', label: 'Search parties', icon: '👥', action: () => navigate('/parties') },
    { type: 'payment', label: 'Search payments', icon: '💳', action: () => navigate('/payments') },
    { type: 'item', label: 'Search items', icon: '📦', action: () => navigate('/items') },
    { type: 'expense', label: 'Search expenses', icon: '💸', action: () => navigate('/expenses') }
  ];

  // Database search function
  const searchDatabase = async (searchQuery) => {
    if (!appId || !userId || !searchQuery.trim()) return [];
    
    const results = [];
    const searchTerm = searchQuery.toLowerCase();
    
    try {
      // Search in invoices
      const invoicesRef = collection(db, `artifacts/${appId}/users/${userId}/invoices`);
      const invoicesQuery = query(
        invoicesRef,
        where('invoiceNumber', '>=', searchTerm),
        where('invoiceNumber', '<=', searchTerm + '\uf8ff'),
        orderBy('invoiceNumber'),
        limit(5)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      invoicesSnapshot.forEach(doc => {
        results.push({
          type: 'invoice',
          id: doc.id,
          data: doc.data(),
          label: `Invoice: ${doc.data().invoiceNumber}`,
          icon: '💰'
        });
      });

      // Search in parties
      const partiesRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
      const partiesQuery = query(
        partiesRef,
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        orderBy('name'),
        limit(5)
      );
      const partiesSnapshot = await getDocs(partiesQuery);
      partiesSnapshot.forEach(doc => {
        results.push({
          type: 'party',
          id: doc.id,
          data: doc.data(),
          label: `Party: ${doc.data().name}`,
          icon: '👥'
        });
      });

      // Search in items
      const itemsRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
      const itemsQuery = query(
        itemsRef,
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        orderBy('name'),
        limit(5)
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      itemsSnapshot.forEach(doc => {
        results.push({
          type: 'item',
          id: doc.id,
          data: doc.data(),
          label: `Item: ${doc.data().name}`,
          icon: '📦'
        });
      });

    } catch (error) {
      console.error('Search error:', error);
    }
    
    return results;
  };

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value.trim()) {
      // Show suggestions after a short delay
      timeoutRef.current = setTimeout(async () => {
        // Get quick suggestions
        const filteredQuick = quickSuggestions.filter(suggestion =>
          suggestion.label.toLowerCase().includes(value.toLowerCase())
        );
        
        // Get database results
        const dbResults = await searchDatabase(value);
        
        // Combine results
        const allSuggestions = [...filteredQuick, ...dbResults];
        setSuggestions(allSuggestions);
        setShowSuggestions(true);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle key navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSuggestionClick(suggestions[selectedIndex]);
      } else if (query.trim()) {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (suggestion.action) {
      suggestion.action();
    }
    setQuery('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      onAdvancedSearch(query);
      setQuery('');
      setShowSuggestions(false);
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (query.trim()) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 150);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex-1 max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
        />
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.type}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                index === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <span className="text-lg">{suggestion.icon}</span>
              <span className="text-sm text-gray-900">{suggestion.label}</span>
            </button>
          ))}
          
          {/* Advanced Search Option */}
          <div className="border-t border-gray-200">
            <button
              onClick={handleSearch}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-lg">🔍</span>
              <span className="text-sm text-gray-900">
                Advanced search for "{query}"
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickSearch; 