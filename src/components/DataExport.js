import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


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
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restorePreview, setRestorePreview] = useState(null);
  const [overwriteOnRestore, setOverwriteOnRestore] = useState(true);

  
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

  const KNOWN_COLLECTIONS = ['parties', 'items', 'salesBills', 'purchaseBills', 'payments', 'expenses', 'advances'];

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
    
    // Map module names to actual collection names
    const collectionMap = {
      'sales': 'salesBills',
      'purchases': 'purchaseBills', 
      'payments': 'payments',
      'parties': 'parties',
      'items': 'items',
      'expenses': 'expenses'
    };
    
    const collectionName = collectionMap[selectedModule];
    if (!collectionName) {
      throw new Error(`Unknown module: ${selectedModule}`);
    }
    
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
    
    let q = query(collectionRef);
    
    // Apply date filters based on the actual date field names
    const dateField = selectedModule === 'sales' ? 'invoiceDate' : 
                     selectedModule === 'purchases' ? 'billDate' : 
                     selectedModule === 'payments' ? 'paymentDate' : 
                     selectedModule === 'expenses' ? 'date' : 'createdAt';
    
    // Since dates are stored as strings in YYYY-MM-DD format, we can filter them directly
    if (dateRangeObj.from && dateRangeObj.to) {
      const fromDate = dateRangeObj.from.toISOString().split('T')[0];
      const toDate = dateRangeObj.to.toISOString().split('T')[0];
      q = query(q, where(dateField, '>=', fromDate), where(dateField, '<=', toDate));
    } else if (dateRangeObj.from) {
      const fromDate = dateRangeObj.from.toISOString().split('T')[0];
      q = query(q, where(dateField, '>=', fromDate));
    } else if (dateRangeObj.to) {
      const toDate = dateRangeObj.to.toISOString().split('T')[0];
      q = query(q, where(dateField, '<=', toDate));
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
        ...docData
      });
    });
    
    return data;
  };

  // Helper: load party id -> name map for better labels in exports
  const loadPartyMap = async () => {
    try {
      const coll = collection(db, `artifacts/${appId}/users/${userId}/parties`);
      const snap = await getDocs(coll);
      const map = {};
      snap.forEach(d => {
        const v = d.data();
        map[d.id] = v.firmName || v.partyName || v.name || '';
      });
      return map;
    } catch {
      return {};
    }
  };

  // Transform data for export
  const transformDataForExport = (data, partyMap = {}) => {
    switch (selectedModule) {
      case 'sales':
        return data.map(item => ({
          'Invoice Number': item.number || '',
          'Date': item.invoiceDate ? new Date(item.invoiceDate).toLocaleDateString() : '',
          'Party': item.partyName || partyMap[item.partyId || item.party || item.buyerId] || item.party || item.partyId || '',
          'Amount': item.amount || 0,
          'Payment Status': item.paymentStatus || 'Pending',
          'Notes': item.notes || '',
          'Items Count': item.rows ? item.rows.length : 0,
          'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''
        }));
      case 'purchases':
        return data.map(item => ({
          'Bill Number': item.number || '',
          'Date': item.billDate ? new Date(item.billDate).toLocaleDateString() : '',
          'Supplier': item.supplierName || item.partyName ||
                      partyMap[item.supplierId || item.party || item.supplier || item.partyId] ||
                      item.party || item.supplier || item.supplierId || item.partyId || '',
          'Amount': item.amount || 0,
          'Payment Status': item.paymentStatus || 'Pending',
          'Notes': item.notes || '',
          'Items Count': item.rows ? item.rows.length : 0,
          'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''
        }));
      case 'payments':
        return data.map(item => ({
          'Receipt Number': item.receiptNumber || '',
          'Date': item.paymentDate ? new Date(item.paymentDate).toLocaleDateString() : '',
          'Party Name': item.partyName || partyMap[item.partyId || item.party || item.buyerId || item.supplierId] || item.party || '',
          'Amount': item.totalAmount || item.amount || 0,
          'Payment Mode': item.paymentMode || '',
          'Reference': item.reference || '',
          'Notes': item.notes || '',
          'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''
        }));
      case 'parties':
        return data.map(item => ({
          'Firm Name': item.firmName || '',
          'Name': item.name || '',
          'GSTIN': item.gstin || '',
          'Contact Number': item.contactNumber || '',
          'Email': item.email || '',
          'Address': item.address || '',
          'City': item.city || '',
          'State': item.state || '',
          'Pincode': item.pincode || '',
          'Type': item.type || 'Customer',
          'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''
        }));
      case 'items':
        return data.map(item => ({
          'Item Name': item.itemName || '',
          'Description': item.description || '',
          'HSN Code': item.hsnCode || '',
          'Item Type': item.itemType || '',
          'Default Rate': item.defaultRate || 0,
          'GST Percentage': item.gstPercentage || 0,
          'Quantity Measurement': item.quantityMeasurement || '',
          'Current Stock': item.currentStock || 0,
          'Is Active': item.isActive ? 'Yes' : 'No',
          'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''
        }));
      case 'expenses':
        return data.map(item => ({
          'Description': item.description || '',
          'Category': item.category || '',
          'Date': item.date ? new Date(item.date).toLocaleDateString() : '',
          'Amount': item.amount || 0,
          'Payment Mode': item.paymentMode || '',
          'Status': item.status || '',
          'Notes': item.notes || '',
          'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''
        }));
      default:
        return data;
    }
  };

  // Export to Excel
  const exportToExcel = (data, filename) => {
    if (data.length === 0) {
      throw new Error('No data to export');
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const moduleLabel = modules.find(m => m.id === selectedModule)?.label || selectedModule;
    XLSX.utils.book_append_sheet(wb, ws, moduleLabel);
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
    ws['!cols'] = colWidths;
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  };

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      throw new Error('No data to export');
    }
    
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
    if (!data.length) throw new Error('No data to export');
    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = Object.keys(data[0]);
    const rows = data.map(r => headers.map(h => r[h]));
    doc.text(`${filename}`, 14, 12);
    autoTable(doc, { head: [headers], body: rows, startY: 16, styles: { fontSize: 8 } });
    doc.save(`${filename}.pdf`);
  };

  // Build and share CSV via Web Share API if available
  const shareCurrentSelection = async () => {
    try {
      const raw = await fetchDataForExport();
      const partyMap = (selectedModule === 'sales' || selectedModule === 'purchases' || selectedModule === 'payments')
        ? await loadPartyMap() : {};
      const data = transformDataForExport(raw, partyMap);
      if (!data.length) { alert('No data to share.'); return; }
      const headers = Object.keys(data[0]);
      const csvContent = [headers.join(','), ...data.map(row => headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const ts = new Date().toISOString().split('T')[0];
      const moduleLabel = modules.find(m => m.id === selectedModule)?.label || selectedModule;
      const fileName = `${moduleLabel}_export_${ts}.csv`;
      const file = new File([blob], fileName, { type: 'text/csv' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${moduleLabel} Export`, text: `${moduleLabel} data exported from ACCTOO` });
      } else {
        saveAs(blob, fileName);
        alert('Your device does not support direct sharing. The CSV has been downloaded; please attach it in your email/WhatsApp.');
      }
    } catch (err) {
      console.error('Share failed', err);
      alert(`Share failed: ${err.message}`);
    }
  };

  // Export to JSON
  const exportToJSON = (data, filename) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    saveAs(blob, `${filename}.json`);
  };

  // Handle export with MPIN verification
  const handleExport = async () => {
    if (!selectedModule || !exportFormat) {
      alert('Please select a module and export format');
      return;
    }

    // Direct export without MPIN verification
    handleExportWithMpin();
  };

  // Handle export after MPIN verification
  const handleExportWithMpin = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      setExportProgress(25);
      const data = await fetchDataForExport();
      
      if (data.length === 0) {
        alert('No data found for the selected criteria. Please try different filters.');
        setIsExporting(false);
        setExportProgress(0);
        return;
      }
      
      setExportProgress(50);
      const partyMap = (selectedModule === 'sales' || selectedModule === 'purchases' || selectedModule === 'payments')
        ? await loadPartyMap() : {};
      const transformedData = transformDataForExport(data, partyMap);
      
      setExportProgress(75);
      const timestamp = new Date().toISOString().split('T')[0];
      const moduleLabel = modules.find(m => m.id === selectedModule)?.label || selectedModule;
      const filename = `${moduleLabel}_export_${timestamp}`;
      
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
        default:
          throw new Error(`Unsupported export format: ${exportFormat}`);
      }
      
      setExportProgress(100);
      saveToHistory(selectedModule, exportFormat, dateRange, data.length);
      
      // Show success message
      alert(`Successfully exported ${data.length} records to ${filename}.${exportFormat === 'excel' ? 'xlsx' : exportFormat === 'csv' ? 'csv' : exportFormat === 'json' ? 'json' : 'txt'}`);
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
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

  // ---------- Full Backup (All Collections) ----------
  const createFullBackup = async () => {
    if (!db || !userId || !appId) return;
    try {
      setBackupProgress(5);
      const collectionsData = {};
      let processed = 0;
      for (const coll of KNOWN_COLLECTIONS) {
        const collRef = collection(db, `artifacts/${appId}/users/${userId}/${coll}`);
        const snap = await getDocs(collRef);
        collectionsData[coll] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        processed += 1;
        setBackupProgress(Math.min(95, Math.round((processed / (KNOWN_COLLECTIONS.length + 1)) * 100)));
      }
      // Company details (single document)
      const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
      const companySnap = await getDoc(companyDocRef);
      const company = companySnap.exists() ? { id: 'myCompany', data: companySnap.data() } : null;

      const backup = {
        meta: {
          appId,
          userId,
          createdAt: new Date().toISOString(),
          formatVersion: 1,
        },
        companyDetails: company,
        collections: collectionsData,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
      saveAs(blob, `acctoo-backup-${ts}.json`);
      setBackupProgress(100);
      setTimeout(() => setBackupProgress(0), 1200);
    } catch (err) {
      console.error('Backup failed', err);
      alert(`Backup failed: ${err.message}`);
      setBackupProgress(0);
    }
  };

  // ---------- Restore from Backup ----------
  function reviveDatesDeep(input) {
    if (!input || typeof input !== 'object') return input;
    // If Timestamp-like {seconds, nanoseconds}
    if (Object.prototype.hasOwnProperty.call(input, 'seconds') && Object.prototype.hasOwnProperty.call(input, 'nanoseconds')) {
      const secs = Number(input.seconds);
      if (!isNaN(secs)) return new Date(secs * 1000);
    }
    const output = Array.isArray(input) ? [] : {};
    for (const [k, v] of Object.entries(input)) {
      // Common audit fields we want to restore as Date if serialized
      if ((k === 'createdAt' || k === 'updatedAt') && v && typeof v === 'object' && 'seconds' in v) {
        output[k] = new Date(Number(v.seconds) * 1000);
      } else {
        output[k] = reviveDatesDeep(v);
      }
    }
    return output;
  }

  const handleRestoreFile = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const json = JSON.parse(text);
      setRestorePreview({
        meta: json.meta,
        counts: Object.fromEntries(Object.entries(json.collections || {}).map(([k, arr]) => [k, Array.isArray(arr) ? arr.length : 0])),
        raw: json,
      });
    } catch (err) {
      console.error('Restore preview failed', err);
      alert('Invalid backup file.');
      setRestorePreview(null);
    }
  };

  const startRestore = async () => {
    if (!restorePreview?.raw) { alert('Select a valid backup file first.'); return; }
    const proceed = window.confirm('This will restore data from backup. Continue?');
    if (!proceed) return;
    const { raw } = restorePreview;
    try {
      setRestoreProgress(1);
      // Enforce: userId must match backup's userId
      if (raw.meta?.userId && raw.meta.userId !== userId) {
        alert('This backup belongs to a different user. Please login with the same account to restore.');
        setRestoreProgress(0);
        return;
      }
      // Optional: warn if appId mismatch
      if (raw.meta?.appId && raw.meta.appId !== appId) {
        const ok = window.confirm('Backup appId differs from current app. Continue anyway?');
        if (!ok) { setRestoreProgress(0); return; }
      }
      // Restore company details
      if (raw.companyDetails?.id && raw.companyDetails?.data) {
        const ref = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, raw.companyDetails.id);
        await setDoc(ref, reviveDatesDeep(raw.companyDetails.data), { merge: overwriteOnRestore });
      }
      const entries = Object.entries(raw.collections || {});
      let processed = 0;
      for (const [collName, docs] of entries) {
        if (!Array.isArray(docs) || docs.length === 0) { processed++; continue; }
        // Write in batches of 400 to stay under limits
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          const slice = docs.slice(i, i + 400);
          slice.forEach(({ id, data }) => {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/${collName}`, id);
            batch.set(ref, reviveDatesDeep(data), { merge: overwriteOnRestore });
          });
          await batch.commit();
          setRestoreProgress(Math.min(99, Math.round(((processed + i / docs.length) / entries.length) * 100)));
        }
        processed++;
        setRestoreProgress(Math.min(99, Math.round((processed / entries.length) * 100)));
      }
      setRestoreProgress(100);
      alert('Restore completed successfully. You may refresh the app to see updated data.');
      setTimeout(() => setRestoreProgress(0), 1500);
    } catch (err) {
      console.error('Restore failed', err);
      alert(`Restore failed: ${err.message}`);
      setRestoreProgress(0);
    }
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
            onClick={() => setActiveTab('backup')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'backup'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🗄️</span>
            <span>Backup & Restore</span>
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
              <div className="text-center py-6">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Share Your Data</h3>
                <p className="text-gray-600 mb-4">Share the current module data as a CSV file using your device share menu. If sharing is not supported, we’ll download the file so you can attach it manually.</p>

                <div className="mb-4">
                  <button onClick={shareCurrentSelection} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Share file (CSV)</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleShareViaEmail}
                    className="flex items-center justify-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl">📧</span>
                    <span className="font-medium">Open Email (attach file manually)</span>
                  </button>
                  <button
                    onClick={handleShareViaWhatsApp}
                    className="flex items-center justify-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl">💬</span>
                    <span className="font-medium">Open WhatsApp (attach file manually)</span>
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

          {activeTab === 'backup' && (
            <div className="space-y-8">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Backup</h3>
                <p className="text-sm text-gray-600 mb-4">Download a single backup file (.json) containing all your data for this company/user. You can restore it later on the same or another device.</p>
                <button
                  onClick={createFullBackup}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={backupProgress > 0 && backupProgress < 100}
                >
                  {backupProgress > 0 && backupProgress < 100 ? `Preparing… ${backupProgress}%` : 'Download Full Backup (.json)'}
                </button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Restore From Backup</h3>
                <p className="text-sm text-gray-600 mb-4">Select a previously downloaded backup file to restore your data. The same format is used for export and import. Links between records are preserved by restoring the original document IDs.</p>
                <div className="flex items-center gap-3 mb-4">
                  <input type="file" accept="application/json,.json" onChange={handleRestoreFile} />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={overwriteOnRestore} onChange={(e)=>setOverwriteOnRestore(e.target.checked)} />
                    <span>Overwrite existing data (merge if unchecked)</span>
                  </label>
                </div>
                {restorePreview && (
                  <div className="text-sm text-gray-700 mb-3">
                    <div className="mb-1">Backup date: <span className="font-medium">{new Date(restorePreview.meta?.createdAt || Date.now()).toLocaleString()}</span></div>
                    <div className="mb-2">Collections: {Object.entries(restorePreview.counts).map(([k,v]) => `${k}: ${v}`).join(', ')}</div>
                  </div>
                )}
                <button
                  onClick={startRestore}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  disabled={!restorePreview || (restoreProgress > 0 && restoreProgress < 100)}
                >
                  {restoreProgress > 0 && restoreProgress < 100 ? `Restoring… ${restoreProgress}%` : 'Start Restore'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {activeTab === 'export' && (
              <div>
                <div>Ready to export {modules.find(m => m.id === selectedModule)?.label} data</div>
                <div className="text-xs text-gray-500">
                  Format: {exportFormats.find(f => f.id === exportFormat)?.label} • 
                  Date Range: {dateRanges.find(d => d.id === dateRange)?.label}
                </div>
              </div>
            )}
            {activeTab === 'backup' && (
              <div className="text-xs text-gray-500">Backup includes: {KNOWN_COLLECTIONS.join(', ')} and company details.</div>
            )}
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