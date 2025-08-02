import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const DataExport = ({ db, userId, appId, isVisible, onClose }) => {
  const [selectedModule, setSelectedModule] = useState('sales');
  const [exportFormat, setExportFormat] = useState('excel');
  const [dateRange, setDateRange] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    amountMin: '',
    amountMax: '',
    party: 'all'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('export');
  const [recentExports, setRecentExports] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const exportFormats = [
    { id: 'excel', label: 'Excel (.xlsx)', icon: '📊', description: 'Best for data analysis' },
    { id: 'csv', label: 'CSV (.csv)', icon: '📄', description: 'Universal format' },
    { id: 'pdf', label: 'PDF (.pdf)', icon: '📋', description: 'For printing and sharing' },
    { id: 'json', label: 'JSON (.json)', icon: '🔧', description: 'For developers' }
  ];

  const modules = [
    { id: 'sales', label: 'Sales', icon: '💰', color: 'bg-green-500' },
    { id: 'purchases', label: 'Purchases', icon: '🛒', color: 'bg-blue-500' },
    { id: 'payments', label: 'Payments', icon: '💳', color: 'bg-purple-500' },
    { id: 'parties', label: 'Parties', icon: '👥', color: 'bg-orange-500' },
    { id: 'items', label: 'Items', icon: '📦', color: 'bg-teal-500' },
    { id: 'expenses', label: 'Expenses', icon: '💸', color: 'bg-red-500' }
  ];

  const dateRanges = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'thisWeek', label: 'This Week' },
    { id: 'lastWeek', label: 'Last Week' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'lastYear', label: 'Last Year' },
    { id: 'custom', label: 'Custom Range' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partial' }
  ];

  // Load recent exports from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`exportHistory_${userId}`);
    if (saved) {
      const history = JSON.parse(saved);
      setRecentExports(history.slice(0, 10));
    }
  }, [userId]);

  // Save export to history
  const saveToHistory = (module, format, dateRange, recordCount) => {
    const newExport = {
      module,
      format,
      dateRange,
      recordCount,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString()
    };
    
    const saved = localStorage.getItem(`exportHistory_${userId}`);
    const history = saved ? JSON.parse(saved) : [];
    const updatedHistory = [newExport, ...history].slice(0, 20);
    
    setRecentExports(updatedHistory.slice(0, 10));
    localStorage.setItem(`exportHistory_${userId}`, JSON.stringify(updatedHistory));
  };

  // Get date range for export
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { from: yesterday, to: today };
      case 'thisWeek':
        const startOfWeek = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        return { from: startOfWeek, to: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) };
      case 'lastWeek':
        const lastWeekStart = new Date(today.getTime() - (today.getDay() + 7) * 24 * 60 * 60 * 1000);
        return { from: lastWeekStart, to: new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000) };
      case 'thisMonth':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: startOfMonth, to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      case 'lastMonth':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { from: lastMonthStart, to: new Date(now.getFullYear(), now.getMonth(), 0) };
      case 'thisYear':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { from: startOfYear, to: new Date(now.getFullYear(), 11, 31) };
      case 'lastYear':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        return { from: lastYearStart, to: new Date(now.getFullYear() - 1, 11, 31) };
      case 'custom':
        return { 
          from: customDateFrom ? new Date(customDateFrom) : null, 
          to: customDateTo ? new Date(customDateTo) : null 
        };
      default:
        return { from: null, to: null };
    }
  };

  // Fetch data for export
  const fetchDataForExport = async () => {
    const dateRangeObj = getDateRange();
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${selectedModule}`);
    
    let q = query(collectionRef, orderBy('date', 'desc'));
    
    // Apply date filters
    if (dateRangeObj.from) {
      q = query(q, where('date', '>=', dateRangeObj.from));
    }
    if (dateRangeObj.to) {
      q = query(q, where('date', '<=', dateRangeObj.to));
    }
    
    const querySnapshot = await getDocs(q);
    const data = [];
    
    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      
      // Apply additional filters
      if (filters.status !== 'all' && docData.status !== filters.status) {
        return;
      }
      if (filters.amountMin && docData.amount < parseFloat(filters.amountMin)) {
        return;
      }
      if (filters.amountMax && docData.amount > parseFloat(filters.amountMax)) {
        return;
      }
      
      data.push({
        id: doc.id,
        ...docData,
        date: docData.date?.toDate?.() || docData.date
      });
    });
    
    return data;
  };

  // Transform data for export
  const transformDataForExport = (data) => {
    switch (selectedModule) {
      case 'sales':
        return data.map(item => ({
          'Invoice Number': item.invoiceNumber || '',
          'Customer Name': item.customerName || '',
          'Customer GSTIN': item.customerGstin || '',
          'Date': item.date ? new Date(item.date).toLocaleDateString() : '',
          'Amount': item.amount || 0,
          'Status': item.status || '',
          'Items': item.items ? item.items.map(i => i.name).join(', ') : '',
          'Remarks': item.remarks || ''
        }));
      case 'purchases':
        return data.map(item => ({
          'Bill Number': item.billNumber || '',
          'Supplier Name': item.supplierName || '',
          'Supplier GSTIN': item.supplierGstin || '',
          'Date': item.date ? new Date(item.date).toLocaleDateString() : '',
          'Amount': item.amount || 0,
          'Status': item.status || '',
          'Items': item.items ? item.items.map(i => i.name).join(', ') : '',
          'Remarks': item.remarks || ''
        }));
      case 'payments':
        return data.map(item => ({
          'Receipt Number': item.receiptNumber || '',
          'Party Name': item.partyName || '',
          'Date': item.date ? new Date(item.date).toLocaleDateString() : '',
          'Amount': item.amount || 0,
          'Payment Mode': item.paymentMode || '',
          'Status': item.status || '',
          'Remarks': item.remarks || ''
        }));
      case 'parties':
        return data.map(item => ({
          'Name': item.name || '',
          'GSTIN': item.gstin || '',
          'Contact Number': item.contactNumber || '',
          'Email': item.email || '',
          'Address': item.address || '',
          'City': item.city || '',
          'State': item.state || '',
          'Pincode': item.pincode || '',
          'Type': item.type || ''
        }));
      case 'items':
        return data.map(item => ({
          'Name': item.name || '',
          'Description': item.description || '',
          'HSN Code': item.hsnCode || '',
          'Category': item.category || '',
          'Rate': item.rate || 0,
          'Unit': item.unit || '',
          'GST Rate': item.gstRate || 0
        }));
      case 'expenses':
        return data.map(item => ({
          'Description': item.description || '',
          'Category': item.category || '',
          'Date': item.date ? new Date(item.date).toLocaleDateString() : '',
          'Amount': item.amount || 0,
          'Payment Mode': item.paymentMode || '',
          'Status': item.status || '',
          'Remarks': item.remarks || ''
        }));
      default:
        return data;
    }
  };

  // Export to Excel
  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedModule);
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
    ws['!cols'] = colWidths;
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  };

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
  };

  // Export to PDF (simplified - would need jsPDF for full implementation)
  const exportToPDF = (data, filename) => {
    // For now, we'll create a simple text-based PDF
    const content = data.map(row => 
      Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n')
    ).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    saveAs(blob, `${filename}.txt`);
  };

  // Export to JSON
  const exportToJSON = (data, filename) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    saveAs(blob, `${filename}.json`);
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      setExportProgress(25);
      const data = await fetchDataForExport();
      
      setExportProgress(50);
      const transformedData = transformDataForExport(data);
      
      setExportProgress(75);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${selectedModule}_export_${timestamp}`;
      
      switch (exportFormat) {
        case 'excel':
          exportToExcel(transformedData, filename);
          break;
        case 'csv':
          exportToCSV(transformedData, filename);
          break;
        case 'pdf':
          exportToPDF(transformedData, filename);
          break;
        case 'json':
          exportToJSON(transformedData, filename);
          break;
      }
      
      setExportProgress(100);
      saveToHistory(selectedModule, exportFormat, dateRange, data.length);
      
      // Show success message
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Share via email (placeholder)
  const handleShareViaEmail = () => {
    const subject = `${selectedModule} Export - ${new Date().toLocaleDateString()}`;
    const body = `Please find attached the ${selectedModule} export data.`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // Share via WhatsApp (placeholder)
  const handleShareViaWhatsApp = () => {
    const text = `Check out my ${selectedModule} export data!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  // Clear export history
  const clearExportHistory = () => {
    setRecentExports([]);
    localStorage.removeItem(`exportHistory_${userId}`);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data Export & Sharing</h2>
              <p className="text-sm text-gray-600">Export and share your data</p>
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
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📊</span>
            <span>Export</span>
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'share'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📤</span>
            <span>Share</span>
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
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Module Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Module</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {modules.map((module) => (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModule(module.id)}
                      className={`flex items-center space-x-2 p-4 rounded-lg border-2 transition-all ${
                        selectedModule === module.id
                          ? `${module.color} text-white border-transparent`
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{module.icon}</span>
                      <span className="font-medium">{module.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Format */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exportFormats.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setExportFormat(format.id)}
                      className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all text-left ${
                        exportFormat === format.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{format.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{format.label}</div>
                        <div className="text-sm text-gray-600">{format.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {dateRanges.map((range) => (
                    <button
                      key={range.id}
                      onClick={() => setDateRange(range.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        dateRange === range.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                
                {dateRange === 'custom' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                      <input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                      <input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Filters */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>{showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}</span>
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
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
                  </div>
                )}
              </div>

              {/* Export Progress */}
              {isExporting && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Exporting...</span>
                    <span className="text-sm text-gray-500">{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? 'Exporting...' : `Export ${selectedModule} Data`}
              </button>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Share Your Data</h3>
                <p className="text-gray-600 mb-6">Export your data first, then share it using these options</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleShareViaEmail}
                    className="flex items-center justify-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl">📧</span>
                    <span className="font-medium">Share via Email</span>
                  </button>
                  <button
                    onClick={handleShareViaWhatsApp}
                    className="flex items-center justify-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl">💬</span>
                    <span className="font-medium">Share via WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Exports</h3>
                {recentExports.length > 0 && (
                  <button
                    onClick={clearExportHistory}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {recentExports.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No export history</h3>
                  <p className="text-gray-600">Your recent exports will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentExports.map((exportItem, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">
                          {modules.find(m => m.id === exportItem.module)?.icon || '📊'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {modules.find(m => m.id === exportItem.module)?.label} Export
                          </p>
                          <p className="text-sm text-gray-500">
                            {exportFormats.find(f => f.id === exportItem.format)?.label} • {exportItem.dateRange} • {exportItem.recordCount} records
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{exportItem.date}</span>
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
            {activeTab === 'export' && `Ready to export ${selectedModule} data`}
          </div>
          <div className="flex space-x-3">
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

export default DataExport; 