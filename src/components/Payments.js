import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, setDoc, deleteDoc, updateDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import ReceiptTemplate from './BillTemplates/ReceiptTemplate';
import PurchaseReceiptTemplate from './BillTemplates/PurchaseReceiptTemplate';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { useTableSort, SortableHeader } from '../utils/tableSort';
import { useTablePagination } from '../utils/tablePagination';
import PaginationControls from '../utils/PaginationControls';
import { 
  getPartyAdvance as getPartyAdvanceUtil, 
  allocateAdvanceToBill as allocateAdvanceToBillUtil, 
  markAdvanceUsed as markAdvanceUsedUtil, 
  refundAdvance as refundAdvanceUtil, 
  getAdvanceDetails as getAdvanceDetailsUtil 
} from '../utils/advanceUtils';

// Use jsPDF from the global window object
const jsPDF = window.jspdf.jsPDF;
console.log('autoTable on jsPDF:', typeof jsPDF.prototype.autoTable);

// Import jspdf-autotable dynamically
let autoTable = null;
try {
  autoTable = require('jspdf-autotable');
  if (autoTable && autoTable.default) {
    autoTable.default(jsPDF);
  }
} catch (error) {
  console.warn('jspdf-autotable not available, using fallback PDF generation');
}

// Comprehensive Export Functions (from Reports.js)
// Utility: Convert array of objects to CSV string
const arrayToCSV = (arr, columns) => {
  const escape = (str) => `"${String(str).replace(/"/g, '""')}"`;
  const header = columns.map(col => escape(col.label)).join(',');
  const rows = arr.map(row => columns.map(col => escape(row[col.key] ?? '')).join(','));
  return [header, ...rows].join('\r\n');
};

// Utility: Export to Excel
const arrayToExcel = (arr, columns, filename) => {
  const wsData = [columns.map(col => col.label), ...arr.map(row => columns.map(col => row[col.key] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, filename);
};

// Utility: Export to PDF with letterhead
const arrayToPDF = async (arr, columns, filename, title = 'Report', companyDetails = {}) => {
  const doc = new jsPDF();
  let y = 16;
  
  // Draw logo if available
  if (companyDetails.logoUrl) {
    try {
      // Fetch image as base64
      const imgData = await fetch(companyDetails.logoUrl)
        .then(res => res.blob())
        .then(blob => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }));
      doc.addImage(imgData, 'PNG', 14, 10, 24, 24); // x, y, width, height
    } catch (e) {
      console.warn('Could not load logo for PDF:', e);
    }
  }
  
  // Company details (name, address, GSTIN, etc.)
  const leftX = companyDetails.logoUrl ? 40 : 14;
  doc.setFontSize(14);
  doc.text(companyDetails.firmName || '', leftX, 16);
  doc.setFontSize(10);
  let detailsY = 22;
  if (companyDetails.address) {
    doc.text(companyDetails.address, leftX, detailsY);
    detailsY += 6;
  }
  if (companyDetails.city || companyDetails.state || companyDetails.pincode) {
    doc.text(
      [companyDetails.city, companyDetails.state, companyDetails.pincode].filter(Boolean).join(', '),
      leftX, detailsY
    );
    detailsY += 6;
  }
  if (companyDetails.gstin) {
    doc.text('GSTIN: ' + companyDetails.gstin, leftX, detailsY);
    detailsY += 6;
  }
  if (companyDetails.contactNumber) {
    doc.text('Contact: ' + companyDetails.contactNumber, leftX, detailsY);
    detailsY += 6;
  }
  if (companyDetails.email) {
    doc.text('Email: ' + companyDetails.email, leftX, detailsY);
    detailsY += 6;
  }
  
  // Report title
  doc.setFontSize(12);
  doc.text(title, 14, detailsY + 6);
  
  // Prepare table data with styling for total rows
  const tableData = arr.map((row, index) => {
    const isTotalRow = row.billNumber?.includes('TOTAL') || 
                      row.partyName?.includes('TOTAL') || 
                      row.receiptNumber?.includes('TOTAL');
    
    return {
      data: columns.map(col => row[col.key] ?? ''),
      styles: isTotalRow ? { 
        fontStyle: 'bold', 
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0]
      } : {}
    };
  });
  
  // Table
  doc.autoTable({
    head: [columns.map(col => col.label)],
    body: tableData.map(row => row.data),
    startY: detailsY + 12,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    didParseCell: function(data) {
      // Apply custom styling to total rows
      if (data.row.index < arr.length) {
        const row = arr[data.row.index];
        const isTotalRow = row.billNumber?.includes('TOTAL') || 
                          row.partyName?.includes('TOTAL') || 
                          row.receiptNumber?.includes('TOTAL');
        
        if (isTotalRow) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.textColor = [0, 0, 0];
        }
      }
    }
  });
  doc.save(filename);
};

// Multi-table export functions
const multiTablePDF = async (tables, filename, title = 'Report', companyDetails = {}) => {
  const doc = new jsPDF();
  let y = 16;
  
  // Draw logo if available
  if (companyDetails.logoUrl) {
    try {
      const imgData = await fetch(companyDetails.logoUrl)
        .then(res => res.blob())
        .then(blob => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }));
      doc.addImage(imgData, 'PNG', 14, 10, 24, 24);
    } catch (e) {
      console.warn('Could not load logo for PDF:', e);
    }
  }
  
  // Company details
  const leftX = companyDetails.logoUrl ? 40 : 14;
  doc.setFontSize(14);
  doc.text(companyDetails.firmName || '', leftX, 16);
  doc.setFontSize(10);
  let detailsY = 22;
  if (companyDetails.address) {
    doc.text(companyDetails.address, leftX, detailsY);
    detailsY += 6;
  }
  if (companyDetails.gstin) {
    doc.text('GSTIN: ' + companyDetails.gstin, leftX, detailsY);
    detailsY += 6;
  }
  
  // Report title
  doc.setFontSize(16);
  doc.text(title, 14, detailsY + 6);
  detailsY += 12;
  
  // Add each table
  tables.forEach((table, index) => {
    if (index > 0) {
      doc.addPage();
      detailsY = 25;
    }
    
    // Table title
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(table.tableTitle, 14, detailsY);
    detailsY += 8;
    
    // Table
    doc.autoTable({
      head: [table.columns.map(col => col.label)],
      body: table.arr.map(row => table.columns.map(col => row[col.key] ?? '')),
      startY: detailsY,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      didParseCell: function(data) {
        // Apply custom styling to total rows
        if (data.row.index < table.arr.length) {
          const row = table.arr[data.row.index];
          const isTotalRow = row.billNumber?.includes('TOTAL') || 
                            row.partyName?.includes('TOTAL') || 
                            row.receiptNumber?.includes('TOTAL');
          
          if (isTotalRow) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      }
    });
    
    detailsY = doc.lastAutoTable.finalY + 10;
  });
  
  doc.save(filename);
};

const multiTableExcel = (tables, filename) => {
  const wb = XLSX.utils.book_new();
  
  tables.forEach((table, index) => {
    const wsData = [
      table.columns.map(col => col.label),
      ...table.arr.map(row => table.columns.map(col => row[col.key] ?? ''))
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, table.tableTitle || `Sheet${index + 1}`);
  });
  
  XLSX.writeFile(wb, filename);
};

const multiTableCSV = async (tables, filenameBase) => {
  if (tables.length === 1) {
    // Single table - export directly
    const table = tables[0];
    const csvContent = arrayToCSV(table.arr, table.columns);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filenameBase}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Multiple tables - create ZIP file
    const zip = new JSZip();
    
    tables.forEach((table, index) => {
      const csvContent = arrayToCSV(table.arr, table.columns);
      const sheetName = table.tableTitle || `Sheet${index + 1}`;
      zip.file(`${sheetName}.csv`, csvContent);
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(zipBlob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filenameBase}.zip`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Legacy export functions (for backward compatibility)
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToExcel = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join('\t'),
    ...data.map(row => headers.map(header => row[header] || '').join('\t'))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToPDF = (data, filename, title, companyData = {}) => {
  if (!data || data.length === 0) return;
  
  try {
    const doc = new jsPDF();
    const headers = Object.keys(data[0]);
    const tableData = data.map(row => headers.map(header => row[header] || ''));
    
    // Add letterhead with company details
    doc.setFillColor(66, 139, 202);
    doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');
    
    // Company name in header (use actual company name if available)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    const companyName = companyData?.firmName || 'LekhaJokha';
    doc.text(companyName, 14, 15);
    
    // Company details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Build company contact info
    const companyContact = [];
    if (companyData?.address) companyContact.push(companyData.address);
    if (companyData?.city && companyData?.state) companyContact.push(`${companyData.city}, ${companyData.state}`);
    if (companyData?.pincode) companyContact.push(`PIN: ${companyData.pincode}`);
    if (companyData?.contactNumber) companyContact.push(`Phone: ${companyData.contactNumber}`);
    if (companyData?.email) companyContact.push(`Email: ${companyData.email}`);
    if (companyData?.gstin) companyContact.push(`GSTIN: ${companyData.gstin}`);
    
    // Display company info in multiple lines if needed
    if (companyContact.length > 0) {
      const contactLine1 = companyContact.slice(0, 2).join(' | ');
      const contactLine2 = companyContact.slice(2, 4).join(' | ');
      doc.text(contactLine1, 14, 22);
      if (contactLine2) {
        doc.text(contactLine2, 14, 28);
      }
    } else {
      doc.text('www.lekhajokha.com | info@lekhajokha.com', 14, 22);
      doc.text('www.lekhajokha.com | info@lekhajokha.com', 14, 28);
    }
    
    // Reset text color for content
    doc.setTextColor(0, 0, 0);
    
    // Set title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(title, 14, 45);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Add date
    const currentDate = new Date().toLocaleDateString('en-IN');
    doc.text(`Generated on: ${currentDate}`, 14, 52);
    
    // Create a table with grid lines
    let y = 65; // Start table below letterhead
    const colWidth = 40;
    const rowHeight = 8;
    const maxCols = Math.floor((doc.internal.pageSize.width - 28) / colWidth);
    
    // Draw table header with lines
    doc.setFillColor(66, 139, 202);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    
    // Draw header background and borders
    headers.slice(0, maxCols).forEach((header, index) => {
      const x = 14 + (index * colWidth);
      // Header background
      doc.rect(x, y - 5, colWidth, rowHeight, 'F');
      // Header text
      doc.text(header, x + 2, y);
      // Vertical lines for header
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(x, y - 5, x, y + rowHeight - 5);
    });
    
    // Bottom line of header
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(14, y + rowHeight - 5, 14 + (maxCols * colWidth), y + rowHeight - 5);
    
    y += rowHeight + 2;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    // Draw data rows with grid lines
    tableData.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (y > doc.internal.pageSize.height - 20) {
        doc.addPage();
        y = 25;
      }
      
      // Draw row data and vertical lines
      row.slice(0, maxCols).forEach((cell, colIndex) => {
        const x = 14 + (colIndex * colWidth);
        // Cell text
        const displayText = cell.length > 15 ? cell.substring(0, 12) + '...' : cell;
        doc.text(displayText, x + 2, y);
        // Vertical lines for data cells
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.2);
        doc.line(x, y - 5, x, y + rowHeight - 5);
      });
      
      // Horizontal line after each row
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.2);
      doc.line(14, y + rowHeight - 5, 14 + (maxCols * colWidth), y + rowHeight - 5);
      
      y += rowHeight;
      
      // Add some spacing every 5 rows
      if ((rowIndex + 1) % 5 === 0) {
        y += 2;
      }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
      const footerText = companyName + ' - Professional Accounting Software';
      doc.text(footerText, 14, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Error generating PDF. Please try again.');
  }
};

const Payments = ({ db, userId, isAuthReady, appId }) => {
  // URL parameter handling for tab selection
  const location = useLocation();
  
  // Main state
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'invoices' || tabParam === 'invoice') return 'invoice';
    if (tabParam === 'challans' || tabParam === 'challan') return 'challan';
    if (tabParam === 'purchases' || tabParam === 'purchase') return 'purchase';
    return 'invoice';
  });
  const [receiptsSortBy, setReceiptsSortBy] = useState('receiptNumber');
  const [receiptsSortOrder, setReceiptsSortOrder] = useState('asc'); // 'invoice', 'challan', 'purchase'
  const [receiptsSubTab, setReceiptsSubTab] = useState('invoice'); // 'invoice', 'challan', 'purchase' for receipts tab
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'custom', 'financial', 'monthly', 'quarterly'
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedSubFilter, setSelectedSubFilter] = useState(''); // 'month' or 'quarter'

  // Data state
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [challans, setChallans] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [company, setCompany] = useState(null);

  // UI state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentType, setPaymentType] = useState('bill'); // 'bill' or 'khata'
  const [exportFormat, setExportFormat] = useState('csv'); // 'csv', 'excel', 'pdf'

  // Table sorting hook for new tables with default sort by party name
  const { sortConfig: newSortConfig, handleSort: handleNewSort, getSortedData } = useTableSort([], { key: 'partyName', direction: 'asc' });

  // Table sorting hook for bills table with LIFO default
  const { sortConfig: billsSortConfig, handleSort: handleBillsSort, getSortedData: getBillsSortedData } = useTableSort([], { key: 'number', direction: 'desc' });

  // Payment entry state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState('');

  const paymentModes = [
    'Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 
    'Online Payment', 'Demand Draft', 'NEFT', 'RTGS', 'IMPS'
  ];

  // Helper function to convert Firestore timestamp to date string
  const convertTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toISOString().split('T')[0];
    if (typeof timestamp === 'string') return timestamp;
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
    }
    return new Date(timestamp).toISOString().split('T')[0];
  };

  // Helper function to get financial year date range
  const getFinancialYearRange = (financialYear) => {
    const [startYear] = financialYear.split('-');
    // Handle both formats: "2025-26" and "25-26"
    const yearNum = startYear.length === 4 ? parseInt(startYear) : parseInt('20' + startYear);
    const startDate = new Date(yearNum, 3, 1); // April 1st (month 3 = April)
    const endDate = new Date(yearNum + 1, 2, 31); // March 31st (month 2 = March)
    return { startDate, endDate };
  };

  // Helper function to get month date range
  const getMonthRange = (monthYear) => {
    const [month, year] = monthYear.split('-');
    const yearNum = parseInt('20' + year); // Convert 25 to 2025
    const startDate = new Date(yearNum, parseInt(month) - 1, 1);
    const endDate = new Date(yearNum, parseInt(month), 0);
    return { startDate, endDate };
  };

  // Helper function to get quarter date range
  const getQuarterRange = (quarterYear) => {
    const [quarter, year] = quarterYear.split('-');
    const yearNum = parseInt('20' + year); // Convert 25 to 2025
    let startMonth, endMonth;
    
    switch(quarter) {
      case 'Q1': // April to June
        startMonth = 3; // April (0-indexed)
        endMonth = 5; // June (0-indexed)
        break;
      case 'Q2': // July to September
        startMonth = 6; // July (0-indexed)
        endMonth = 8; // September (0-indexed)
        break;
      case 'Q3': // October to December
        startMonth = 9; // October (0-indexed)
        endMonth = 11; // December (0-indexed)
        break;
      case 'Q4': // January to March
        startMonth = 0; // January (0-indexed)
        endMonth = 2; // March (0-indexed)
        break;
      default:
        startMonth = 0;
        endMonth = 11;
    }
    
    const startDate = new Date(yearNum, startMonth, 1);
    const endDate = new Date(yearNum, endMonth + 1, 0);
    return { startDate, endDate };
  };

  // Helper function to get available financial years from bills data
  const getAvailableFinancialYears = () => {
    const years = new Set();
    
    // Collect dates from invoices
    invoices.forEach(bill => {
      const billDate = bill.invoiceDate || bill.billDate || bill.date;
      if (billDate) {
        const year = parseInt(billDate.slice(0, 4));
        if (!isNaN(year)) {
          const month = parseInt(billDate.slice(5, 7));
          // Financial year logic: April-March
          const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
          years.add(fy);
        }
      }
    });
    
    // Collect dates from challans
    challans.forEach(bill => {
      const billDate = bill.invoiceDate || bill.billDate || bill.date;
      if (billDate) {
        const year = parseInt(billDate.slice(0, 4));
        if (!isNaN(year)) {
          const month = parseInt(billDate.slice(5, 7));
          const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
          years.add(fy);
        }
      }
    });
    
    // Collect dates from purchase bills
    purchaseBills.forEach(bill => {
      const billDate = bill.invoiceDate || bill.billDate || bill.date;
      if (billDate) {
        const year = parseInt(billDate.slice(0, 4));
        if (!isNaN(year)) {
          const month = parseInt(billDate.slice(5, 7));
          const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
          years.add(fy);
        }
      }
    });
    
    // Collect dates from payments (receipts)
    payments.forEach(payment => {
      const paymentDate = payment.date;
      if (paymentDate) {
        const year = parseInt(paymentDate.slice(0, 4));
        if (!isNaN(year)) {
          const month = parseInt(paymentDate.slice(5, 7));
          const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
          years.add(fy);
        }
      }
    });
    
    return Array.from(years).sort();
  };

  // Helper function to get current financial year
  const getCurrentFinancialYear = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 0-indexed to 1-indexed
    
    // Financial year logic: April-March
    const fy = currentMonth >= 4 ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}` : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    return fy;
  };

  // Helper function to get quarters for current financial year only
  const getCurrentFinancialYearQuarters = () => {
    const currentFY = getCurrentFinancialYear();
    const [startYear] = currentFY.split('-');
    const yearSuffix = startYear.slice(-2);
    
    return [
      { value: `Q1-${yearSuffix}`, label: `Q1 (Apr-Jun) ${startYear}` },
      { value: `Q2-${yearSuffix}`, label: `Q2 (Jul-Sep) ${startYear}` },
      { value: `Q3-${yearSuffix}`, label: `Q3 (Oct-Dec) ${startYear}` },
      { value: `Q4-${yearSuffix}`, label: `Q4 (Jan-Mar) ${parseInt(startYear) + 1}` }
    ];
  };

  // Generate sequential receipt number
  const generateReceiptNumber = async () => {
    const currentYear = new Date().getFullYear();
    const financialYear = `${currentYear.toString().slice(-2)}-${(currentYear + 1).toString().slice(-2)}`;
    const paymentType = activeTab === 'invoice' ? 'I' : activeTab === 'challan' ? 'C' : 'P';
    
    console.log('Generating receipt number for financial year:', financialYear, 'payment type:', paymentType);
    
    try {
      // Get ALL payments to find the highest sequence number for THIS specific payment type
      const paymentsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/payments`));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      let highestSequence = 0;
      
      // Check all payments for the highest sequence number for THIS payment type only
      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data();
        if (payment.receiptNumber) {
          console.log('Checking receipt number:', payment.receiptNumber);
          
          // Match pattern: PR[I|C|P]25-26/number - but only for THIS payment type
          const regexPattern = new RegExp(`PR${paymentType}${financialYear.replace('-', '\\-')}\\/(\\d+)`);
          const match = payment.receiptNumber.match(regexPattern);
          
          if (match) {
            const sequence = parseInt(match[1]);
            console.log('Found sequence for payment type', paymentType, ':', sequence);
            if (sequence > highestSequence) {
              highestSequence = sequence;
              console.log('New highest sequence for payment type', paymentType, ':', highestSequence);
            }
          }
        }
      });
      
      const nextSequence = highestSequence + 1;
      console.log('Final next sequence for payment type', paymentType, ':', nextSequence);
      
      const receiptNumber = `PR${paymentType}${financialYear}/${nextSequence}`;
      console.log('Generated receipt number:', receiptNumber);
      
      return receiptNumber;
    } catch (error) {
      console.error('Error generating receipt number:', error);
      const fallbackNumber = `PR${paymentType}${financialYear}/1`;
      console.log('Fallback receipt number:', fallbackNumber);
      return fallbackNumber;
    }
  };

  // FIFO Payment Allocation Logic
  const allocatePaymentFIFO = (partyId, paymentAmount, billType) => {
    try {
      // Validate inputs
      if (!partyId || !paymentAmount || !billType) {
        console.error('Invalid inputs to allocatePaymentFIFO:', { partyId, paymentAmount, billType });
        return { allocations: [], remainingAmount: paymentAmount };
      }
      
    const bills = billType === 'invoice' ? invoices : billType === 'challan' ? challans : purchaseBills;
      
      // Validate bills array
      if (!Array.isArray(bills)) {
        console.error('Bills array is not valid:', bills);
        return { allocations: [], remainingAmount: paymentAmount };
      }
      
    const partyBills = bills.filter(bill => (bill.partyId === partyId || bill.party === partyId) && bill.outstanding > 0);
    
    // Sort by date (FIFO - oldest first)
    partyBills.sort((a, b) => new Date(a.date || a.invoiceDate || a.challanDate || a.billDate) - new Date(b.date || b.invoiceDate || b.challanDate || b.billDate));
    
    let remainingAmount = paymentAmount;
    const allocations = [];
    
    for (const bill of partyBills) {
      if (remainingAmount <= 0) break;
      
      const billOutstanding = bill.outstanding || 0;
      const allocatedAmount = Math.min(remainingAmount, billOutstanding);
      
      allocations.push({
        billType: billType,
        billId: bill.id,
        billNumber: bill.number || bill.invoiceNumber || bill.challanNumber || bill.billNumber,
        allocatedAmount: allocatedAmount,
        billOutstanding: billOutstanding,
        isFullPayment: allocatedAmount >= billOutstanding
      });
      
      remainingAmount -= allocatedAmount;
    }
    
      console.log('FIFO result:', { allocations: allocations.length, remainingAmount });
    return { allocations, remainingAmount };
    } catch (error) {
      console.error('Error in allocatePaymentFIFO:', error);
      return { allocations: [], remainingAmount: paymentAmount };
    }
  };

  // Fetch parties
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const path = `artifacts/${appId}/users/${userId}/parties`;
      const partiesCollectionRef = collection(db, path);
      const unsubscribe = onSnapshot(
        partiesCollectionRef,
        (snapshot) => {
          const allParties = [];
          snapshot.forEach((doc) => {
            allParties.push({ id: doc.id, ...doc.data() });
          });
          allParties.sort((a, b) => (a.firmName || '').localeCompare(b.firmName || ''));
          setParties(allParties);
        },
        (error) => {
          console.error('Error fetching parties:', error);
          setParties([]);
        }
      );
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId]);

  // Fetch invoices
  useEffect(() => {
    console.log('Invoices useEffect triggered, payments length:', payments.length);
    if (db && userId && isAuthReady) {
      const path = `artifacts/${appId}/users/${userId}/salesBills`;
      const billsCollectionRef = collection(db, path);
      const unsubscribe = onSnapshot(
        billsCollectionRef,
        (snapshot) => {
          const bills = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const bill = { 
              id: doc.id, 
              ...data,
              invoiceDate: convertTimestamp(data.invoiceDate || data.createdAt),
              date: convertTimestamp(data.date || data.createdAt)
            };
            
            // Debug logging for first few bills
            if (bills.length < 3) {
              console.log('Invoice data:', {
                id: bill.id,
                number: bill.number,
                invoiceDate: bill.invoiceDate,
                date: bill.date,
                originalInvoiceDate: data.invoiceDate,
                originalCreatedAt: data.createdAt
              });
            }
            
            // Calculate outstanding from payments (including advance allocations)
            const billPayments = payments.filter(p => 
              p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
            );
            
            // Calculate direct payments
            const directPayments = billPayments.reduce((sum, payment) => {
              const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
              return sum + (allocation ? allocation.allocatedAmount : 0);
            }, 0);
            
            // Calculate advance allocations for this bill
            // We need to check if any payments have advance allocations that should be applied to this bill
            const advanceAllocations = payments.reduce((sum, payment) => {
              if (payment.advanceAllocations && Array.isArray(payment.advanceAllocations) && payment.advanceAllocations.length > 0) {
                // If this payment has advance allocations and is for the same party, 
                // we need to determine how much of that advance should be applied to this specific bill
                if (payment.partyId === bill.partyId || payment.partyId === bill.party) {
                  // For now, we'll use a simple approach: distribute advance proportionally based on bill amount
                  const totalAdvanceUsed = payment.advanceAllocations.reduce((acc, adv) => acc + adv.amountUsed, 0);
                  const partyBills = getCurrentBills().filter(b => (b.partyId === bill.partyId || b.party === bill.partyId) && b.id !== bill.id);
                  const totalPartyAmount = partyBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0) + (bill.totalAmount || 0);
                  if (totalPartyAmount > 0) {
                    const billProportion = (bill.totalAmount || 0) / totalPartyAmount;
                    return sum + (totalAdvanceUsed * billProportion);
                  }
                }
              }
              return sum;
            }, 0);
            
            const totalPaid = directPayments + advanceAllocations;
            const totalAmount = parseFloat(bill.totalAmount || bill.amount) || 0;
            bill.outstanding = Math.max(0, totalAmount - totalPaid);
            bill.totalPaid = totalPaid;
            bill.totalAmount = totalAmount;
            bill.paymentCount = billPayments.length;
            
            // Debug logging for first few bills
            if (bills.length < 3) {
              console.log('Invoice outstanding calculation:', {
                id: bill.id,
                number: bill.number,
                totalAmount,
                directPayments,
                advanceAllocations,
                totalPaid,
                outstanding: bill.outstanding,
                paymentCount: bill.paymentCount,
                partyId: bill.partyId,
                party: bill.party
              });
            }
            
            bills.push(bill);
          });
                      // LIFO sorting is now handled by the pagination utility
            setInvoices(bills);
        },
        (error) => {
          console.error('Error fetching invoices:', error);
          setInvoices([]);
        }
      );
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId, payments]);

  // Fetch challans
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const path = `artifacts/${appId}/users/${userId}/challans`;
      const billsCollectionRef = collection(db, path);
      const unsubscribe = onSnapshot(
        billsCollectionRef,
        (snapshot) => {
          const bills = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const bill = { 
              id: doc.id, 
              ...data,
              challanDate: convertTimestamp(data.challanDate || data.createdAt),
              date: convertTimestamp(data.date || data.createdAt)
            };
            
            // Calculate outstanding from payments (including advance allocations)
            const billPayments = payments.filter(p => 
              p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'challan')
            );
            
            // Calculate direct payments
            const directPayments = billPayments.reduce((sum, payment) => {
              const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'challan');
              return sum + (allocation ? allocation.allocatedAmount : 0);
            }, 0);
            
            // Calculate advance allocations for this bill
            // For now, we'll skip advance allocation calculation in outstanding
            // as it requires more complex tracking of which bills the advance was allocated to
            const advanceAllocations = 0;
            
            const totalPaid = directPayments + advanceAllocations;
            const totalAmount = parseFloat(bill.totalAmount || bill.amount) || 0;
            bill.outstanding = Math.max(0, totalAmount - totalPaid);
            bill.totalPaid = totalPaid;
            bill.totalAmount = totalAmount;
            bill.paymentCount = billPayments.length;
            bills.push(bill);
          });
          // LIFO sorting is now handled by the pagination utility
          setChallans(bills);
        },
        (error) => {
          console.error('Error fetching challans:', error);
          setChallans([]);
        }
      );
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId, payments]);

  // Fetch purchase bills
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const path = `artifacts/${appId}/users/${userId}/purchaseBills`;
      const billsCollectionRef = collection(db, path);
      const unsubscribe = onSnapshot(
        billsCollectionRef,
        (snapshot) => {
          const bills = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const bill = { 
              id: doc.id, 
              ...data,
              billDate: convertTimestamp(data.billDate || data.createdAt),
              date: convertTimestamp(data.date || data.createdAt)
            };
            
            // Calculate outstanding from payments (including advance allocations)
            const billPayments = payments.filter(p => 
              p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
            );
            
            // Calculate direct payments
            const directPayments = billPayments.reduce((sum, payment) => {
              const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
              return sum + (allocation ? allocation.allocatedAmount : 0);
            }, 0);
            
            // Calculate advance allocations for this bill
            // For now, we'll skip advance allocation calculation in outstanding
            // as it requires more complex tracking of which bills the advance was allocated to
            const advanceAllocations = 0;
            
            const totalPaid = directPayments + advanceAllocations;
            const totalAmount = parseFloat(bill.totalAmount || bill.amount) || 0;
            bill.outstanding = Math.max(0, totalAmount - totalPaid);
            bill.totalPaid = totalPaid;
            bill.totalAmount = totalAmount;
            bill.paymentCount = billPayments.length;
            bills.push(bill);
          });
          // LIFO sorting is now handled by the pagination utility
          setPurchaseBills(bills);
        },
        (error) => {
          console.error('Error fetching purchase bills:', error);
          setPurchaseBills([]);
        }
      );
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId, payments]);

  // Fetch payments (single table)
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const paymentsPath = `artifacts/${appId}/users/${userId}/payments`;
      const paymentsRef = collection(db, paymentsPath);
      
      const unsubscribePayments = onSnapshot(paymentsRef, (snapshot) => {
        const allPayments = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const payment = {
            id: doc.id,
            ...data,
            date: convertTimestamp(data.paymentDate || data.createdAt)
          };
          allPayments.push(payment);
        });
        console.log('Fetched all payments:', allPayments.length, 'payments');
        console.log('First few payments:', allPayments.slice(0, 3).map(p => ({
          id: p.id,
          partyId: p.partyId,
          partyName: p.partyName,
          totalAmount: p.totalAmount,
          allocations: p.allocations?.length || 0,
          advanceAllocations: p.advanceAllocations?.length || 0
        })));
        setPayments(allPayments);
        
        // Check for duplicate receipt numbers after payments are loaded
        if (allPayments.length > 0) {
          checkAndFixDuplicateReceiptNumbers();
        }
      });
      
      return () => unsubscribePayments();
    }
  }, [db, userId, isAuthReady, appId]);

  // Fetch company details
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
      const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setCompany(docSnap.data());
        }
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId]);

  // Set default financial year when data is loaded
  useEffect(() => {
    if (invoices.length > 0 || challans.length > 0 || purchaseBills.length > 0 || payments.length > 0) {
      const availableYears = getAvailableFinancialYears();
      console.log('Available Financial Years:', availableYears);
      console.log('Current Data Counts:', {
        invoices: invoices.length,
        challans: challans.length,
        purchaseBills: purchaseBills.length,
        payments: payments.length
      });
      
      if (availableYears.length > 0 && !selectedFinancialYear) {
        // Set to current financial year if available, otherwise use the first available year
        const currentFY = getCurrentFinancialYear();
        const defaultYear = availableYears.includes(currentFY) ? currentFY : availableYears[0];
        console.log('Setting default financial year:', { currentFY, defaultYear, availableYears });
        setSelectedFinancialYear(defaultYear);
      }
    }
  }, [invoices, challans, purchaseBills, payments, selectedFinancialYear]);

  // Get current bills based on active tab
  const getCurrentBills = () => {
    switch(activeTab) {
      case 'invoice': return invoices;
      case 'challan': return challans;
      case 'purchase': return purchaseBills;
      default: return [];
    }
  };

  // Get bill number field based on active tab
  const getBillNumberField = () => {
    switch(activeTab) {
      case 'invoice': return 'number';
      case 'challan': return 'challanNumber';
      case 'purchase': return 'number';
      default: return 'number';
    }
  };

  // Get bill number display value
  const getBillNumber = (bill) => {
    switch(activeTab) {
      case 'invoice': return bill.number || bill.invoiceNumber;
      case 'challan': return bill.challanNumber || bill.number;
      case 'purchase': return bill.number || bill.billNumber;
      default: return bill.number;
    }
  };

  // Get bill date field based on active tab
  const getBillDateField = () => {
    switch(activeTab) {
      case 'invoice': return 'invoiceDate';
      case 'challan': return 'challanDate';
      case 'purchase': return 'billDate';
      default: return 'date';
    }
  };

  // Get party name by ID
  const getPartyName = (partyId) => {
    if (!partyId) return 'Unknown Party';
    const party = parties.find(p => p.id === partyId);
    return party ? (party.firmName || party.name) : 'Unknown Party';
  };

  // Filter bills based on time and party
  const getFilteredBills = () => {
    let bills = getCurrentBills();
    
    // Filter by party
    if (selectedParty) {
      bills = bills.filter(bill => {
        const billPartyId = bill.partyId || bill.party;
        return billPartyId === selectedParty;
      });
    }
    
    // Filter by time
    if (timeFilter === 'custom' && customDateFrom && customDateTo) {
      bills = bills.filter(bill => {
        const billDate = new Date(bill[getBillDateField()]);
        const fromDate = new Date(customDateFrom);
        const toDate = new Date(customDateTo);
        return billDate >= fromDate && billDate <= toDate;
      });
    } else if (timeFilter === 'financial' && selectedFinancialYear) {
      let startDate, endDate;
      
      // If sub-filter is selected, use that specific range
      if (selectedSubFilter === 'month' && selectedMonth) {
        const monthRange = getMonthRange(selectedMonth);
        startDate = monthRange.startDate;
        endDate = monthRange.endDate;
      } else if (selectedSubFilter === 'quarter' && selectedQuarter) {
        const quarterRange = getQuarterRange(selectedQuarter);
        startDate = quarterRange.startDate;
        endDate = quarterRange.endDate;
      } else {
        // Use full financial year range
        const yearRange = getFinancialYearRange(selectedFinancialYear);
        startDate = yearRange.startDate;
        endDate = yearRange.endDate;
        
        // Debug logging
        console.log('Financial Year Filter Debug:', {
          selectedFinancialYear,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalBillsBeforeFilter: bills.length
        });
      }
      
      bills = bills.filter(bill => {
        const billDateField = getBillDateField();
        const billDateValue = bill[billDateField];
        const billDate = new Date(billDateValue);
        
        // Debug logging for first few bills
        if (bills.length <= 3) {
          console.log('Bill Date Debug:', {
            billId: bill.id,
            billDateField,
            billDateValue,
            billDate: billDate.toISOString(),
            isInRange: billDate >= startDate && billDate <= endDate
          });
        }
        
        return billDate >= startDate && billDate <= endDate;
      });
      
      // Debug logging
      if (selectedSubFilter === '') {
        console.log('Financial Year Filter Result:', {
          totalBillsAfterFilter: bills.length
        });
      }
    }
    
    // Add partyName field for sorting and normalize bill number field
    bills = bills.map(bill => ({
      ...bill,
      partyName: getPartyName(bill.partyId || bill.party),
      number: getBillNumber(bill) // Normalize bill number for consistent sorting
    }));
    
    return bills;
  };



  // Sort receipts
  const sortReceipts = (receipts) => {
    if (!receiptsSortBy) return receipts;
    
    return [...receipts].sort((a, b) => {
      let aValue, bValue;
      
      switch (receiptsSortBy) {
        case 'receiptNumber':
          aValue = a.receiptNumber || '';
          bValue = b.receiptNumber || '';
          break;
        case 'partyName':
          aValue = a.partyName || '';
          bValue = b.partyName || '';
          break;
        case 'totalAmount':
          aValue = parseFloat(a.totalAmount || 0);
          bValue = parseFloat(b.totalAmount || 0);
          break;
        case 'paymentDate':
          aValue = new Date(a.paymentDate || a.date || 0);
          bValue = new Date(b.paymentDate || b.date || 0);
          break;
        case 'paymentMode':
          aValue = a.paymentMode || '';
          bValue = b.paymentMode || '';
          break;
        case 'paymentType':
          aValue = a.paymentType || '';
          bValue = b.paymentType || '';
          break;
        default:
          return 0;
      }
      
      if (receiptsSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Handle sort


  // Handle receipts sort
  const handleReceiptsSort = (key) => {
    setReceiptsSortBy(key);
    setReceiptsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Handle add payment (Bill-wise)
  const handleAddPayment = async (bill) => {
    setPaymentType('bill');
    setSelectedBill(bill);
    setSelectedPartyForPayment(bill.partyId || bill.party);
    setPaymentAmount(bill.outstanding.toString());
    const receiptNum = await generateReceiptNumber();
    setReceiptNumber(receiptNum);
    setShowPaymentModal(true);
    // Show advance info
    const collected = getPartyAdvance(bill.partyId || bill.party);
    setAdvanceInfo({ collected, used: 0 });
    setShowAdvanceInfo(collected > 0);
  };

  // Handle add khata payment (Party-wise)
  const handleAddKhataPayment = async (partyId) => {
    setPaymentType('khata');
    setSelectedBill(null);
    setSelectedPartyForPayment(partyId);
    setPaymentAmount('');
    const receiptNum = await generateReceiptNumber();
    setReceiptNumber(receiptNum);
    setShowPaymentModal(true);
    // Show advance info
    const collected = getPartyAdvance(partyId);
    setAdvanceInfo({ collected, used: 0 });
    setShowAdvanceInfo(collected > 0);
  };

  // Handle save payment
  const handleSavePayment = async () => {
    console.log('Payment save started');

    if (!selectedPartyForPayment || !paymentAmount) {
      alert('Please select a party and enter payment amount.');
      return;
    }

    try {
      const paymentAmountNum = parseFloat(paymentAmount);
      
      if (isNaN(paymentAmountNum) || paymentAmountNum <= 0) {
        alert('Please enter a valid payment amount.');
        return;
      }
      
      if (!receiptNumber.trim()) {
        alert('Please enter a receipt number.');
        return;
      }
      
      // Check if bills are loaded
      if (!Array.isArray(invoices) || !Array.isArray(challans) || !Array.isArray(purchaseBills)) {
        alert('Bills data is still loading. Please wait a moment and try again.');
        return;
      }
      
      let paymentData;
      let advanceAllocations = [];
      
      if (paymentType === 'bill' && selectedBill) {
        // Bill-wise payment - allocate to specific bill
        const billOutstanding = selectedBill.outstanding || 0;
        
        // First, try to allocate available advance to this bill
        const { allocatedAdvance, advanceAllocs, remainingBillAmount } = allocateAdvanceToBill(selectedPartyForPayment, billOutstanding);
        if (allocatedAdvance > 0) {
          advanceAllocations = advanceAllocs;
          // Mark advances as used
          await markAdvanceUsed(advanceAllocs);
        }
        
        // Now allocate the new payment
        const actualOutstanding = remainingBillAmount; // After advance allocation
        const allocatedAmount = Math.min(paymentAmountNum, actualOutstanding);
        const remainingAmount = paymentAmountNum - allocatedAmount;
        
        // Update the bill's outstanding amount for display
        selectedBill.outstanding = actualOutstanding;
        
        const allocations = [{
          billType: activeTab,
          billId: selectedBill.id,
          billNumber: getBillNumber(selectedBill),
          allocatedAmount: allocatedAmount,
          billOutstanding: actualOutstanding,
          isFullPayment: allocatedAmount >= actualOutstanding
        }];
        
        // Enhanced FIFO Logic: If payment amount exceeds bill outstanding, allocate excess to other bills
        if (remainingAmount > 0) {
          console.log(`Payment amount (₹${paymentAmountNum}) exceeds bill outstanding (₹${actualOutstanding}). Allocating excess ₹${remainingAmount} using FIFO.`);
          
          // Get all other outstanding bills for this party (excluding the current bill)
          const otherOutstandingBills = getCurrentBills().filter(bill => 
            (bill.partyId === selectedPartyForPayment || bill.party === selectedPartyForPayment) && 
            bill.outstanding > 0 && 
            bill.id !== selectedBill.id
          );
          
          if (otherOutstandingBills.length > 0) {
            // Sort by date (FIFO - oldest first)
            otherOutstandingBills.sort((a, b) => {
              const dateA = new Date(a[getBillDateField()] || a.date || a.createdAt);
              const dateB = new Date(b[getBillDateField()] || b.date || b.createdAt);
              return dateA - dateB;
            });
            
            let remainingToAllocate = remainingAmount;
            const fifoAllocations = [];
            
            for (const bill of otherOutstandingBills) {
              if (remainingToAllocate <= 0) break;
              
              const billOutstanding = bill.outstanding || 0;
              const allocatedToThisBill = Math.min(remainingToAllocate, billOutstanding);
              
              fifoAllocations.push({
                billType: activeTab,
                billId: bill.id,
                billNumber: getBillNumber(bill),
                allocatedAmount: allocatedToThisBill,
                billOutstanding: billOutstanding,
                isFullPayment: allocatedToThisBill >= billOutstanding
              });
              
              remainingToAllocate -= allocatedToThisBill;
            }
            
            allocations.push(...fifoAllocations);
            
            // Update remaining amount (if any bills couldn't be fully paid)
            const finalRemainingAmount = remainingToAllocate;
            
            paymentData = {
              receiptNumber: receiptNumber,
              paymentDate: paymentDate,
              partyId: selectedPartyForPayment,
              partyName: getPartyName(selectedPartyForPayment),
              totalAmount: paymentAmountNum,
              paymentMode: paymentMode,
              reference: paymentReference,
              notes: paymentNotes,
              type: activeTab,
              paymentType: 'bill',
              billId: selectedBill.id,
              billNumber: getBillNumber(selectedBill),
              allocations: allocations,
              remainingAmount: finalRemainingAmount,
              advanceAllocations: advanceAllocations,
              advanceUsed: allocatedAdvance,
              fifoAllocationUsed: remainingAmount - finalRemainingAmount,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
          } else {
            // No other outstanding bills, create advance
            console.log(`No other outstanding bills found. Creating advance of ₹${remainingAmount} for party ${selectedPartyForPayment}`);
        paymentData = {
          receiptNumber: receiptNumber,
          paymentDate: paymentDate,
          partyId: selectedPartyForPayment,
          partyName: getPartyName(selectedPartyForPayment),
          totalAmount: paymentAmountNum,
          paymentMode: paymentMode,
          reference: paymentReference,
          notes: paymentNotes,
          type: activeTab,
          paymentType: 'bill',
          billId: selectedBill.id,
          billNumber: getBillNumber(selectedBill),
          allocations: allocations,
          remainingAmount: remainingAmount,
              advanceAllocations: advanceAllocations,
              advanceUsed: allocatedAdvance,
              fifoAllocationUsed: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
          }
      } else {
          // No excess amount, normal payment
          paymentData = {
            receiptNumber: receiptNumber,
            paymentDate: paymentDate,
            partyId: selectedPartyForPayment,
            partyName: getPartyName(selectedPartyForPayment),
            totalAmount: paymentAmountNum,
            paymentMode: paymentMode,
            reference: paymentReference,
            notes: paymentNotes,
            type: activeTab,
            paymentType: 'bill',
            billId: selectedBill.id,
            billNumber: getBillNumber(selectedBill),
            allocations: allocations,
            remainingAmount: remainingAmount,
            advanceAllocations: advanceAllocations,
            advanceUsed: allocatedAdvance,
            fifoAllocationUsed: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
        }

      } else {
        // Khata-wise payment - first try to allocate available advance
        const availableAdvance = getPartyAdvance(selectedPartyForPayment);
        let advanceAllocations = [];
        let advanceUsed = 0;
        let remainingPaymentAmount = paymentAmountNum;
        
        if (availableAdvance > 0) {
          // Get all outstanding bills for this party
          const outstandingBills = getCurrentBills().filter(bill => 
            (bill.partyId === selectedPartyForPayment || bill.party === selectedPartyForPayment) && 
            bill.outstanding > 0
          );
          
                      if (outstandingBills.length > 0) {
              // Allocate advance to outstanding bills
              const advanceResult = allocateAdvanceToBill(selectedPartyForPayment, outstandingBills.reduce((sum, bill) => sum + bill.outstanding, 0));
              
              if (advanceResult.allocatedAdvance > 0) {
                advanceAllocations = advanceResult.advanceAllocations;
                advanceUsed = advanceResult.allocatedAdvance;
                // Mark advances as used - only if advanceAllocations is an array
                if (Array.isArray(advanceResult.advanceAllocations) && advanceResult.advanceAllocations.length > 0) {
                  await markAdvanceUsed(advanceResult.advanceAllocations);
                }
              }
            }
        }
        
        // Now allocate the remaining payment amount using FIFO
        const fifoResult = allocatePaymentFIFO(selectedPartyForPayment, remainingPaymentAmount, activeTab);
        
        // Validate FIFO result
        if (!fifoResult || !Array.isArray(fifoResult.allocations)) {
          console.error('Invalid FIFO result:', fifoResult);
          throw new Error('Failed to allocate payment. Please try again.');
        }
        
        const { allocations, remainingAmount } = fifoResult;
        
        paymentData = {
          receiptNumber: receiptNumber,
          paymentDate: paymentDate,
          partyId: selectedPartyForPayment,
          partyName: getPartyName(selectedPartyForPayment),
          totalAmount: paymentAmountNum,
          paymentMode: paymentMode,
          reference: paymentReference,
          notes: paymentNotes,
          type: activeTab,
          paymentType: 'khata',
          allocations: allocations,
          remainingAmount: remainingAmount,
          advanceAllocations: advanceAllocations,
          advanceUsed: advanceUsed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
      }

      // Validate payment data before saving
      if (!paymentData || !paymentData.receiptNumber || !paymentData.partyId) {
        throw new Error('Invalid payment data. Please check all required fields.');
      }

      // Add to payments collection
      const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
      const docRef = await addDoc(paymentsRef, paymentData);
      console.log('Payment added with ID:', docRef.id);

      // Reset form
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Cash');
      setPaymentReference('');
      setPaymentNotes('');
      setReceiptNumber('');
      setSelectedPartyForPayment('');
      setPaymentType('bill');
      setShowPaymentModal(false);
      setSelectedBill(null);
      
      alert('Payment added successfully!');
    } catch (error) {
      console.error('Error saving payment:', error);
      
      // More specific error messages
      if (error.code === 'permission-denied') {
        alert('Permission denied. Please check your access rights.');
      } else if (error.code === 'unavailable') {
        alert('Network error. Please check your internet connection and try again.');
      } else if (error.message && error.message.includes('duplicate')) {
        alert('Duplicate receipt number. Please use a different receipt number.');
      } else {
        alert(`Error saving payment: ${error.message || 'Please try again.'}`);
      }
    }
  };

  // Handle view payment details
  const handleViewPaymentDetails = (bill) => {
    setSelectedBill(bill);
    setShowPaymentDetailsModal(true);
  };

  // Handle preview receipt
  const handlePreviewReceipt = (payment) => {
    setSelectedReceipt(payment);
    setShowReceiptModal(true);
    // Close the payment details modal when opening receipt preview
    setShowPaymentDetailsModal(false);
  };

  // Handle delete payment
  const handleDeletePayment = async (payment) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) {
      return;
    }

    try {
      const paymentRef = doc(db, `artifacts/${appId}/users/${userId}/payments`, payment.id);
      await deleteDoc(paymentRef);
      
      setShowPaymentDetailsModal(false);
      setShowReceiptModal(false);
      alert('Payment deleted successfully!');
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error deleting payment. Please try again.');
    }
  };

  // Print receipt (Browser print)
  const printReceipt = () => {
    if (!selectedReceipt) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    const Template = selectedReceipt.type === 'purchase' ? PurchaseReceiptTemplate : ReceiptTemplate;
    
    // Render the receipt template
    const receiptElement = React.createElement(Template, {
      receipt: selectedReceipt,
      bill: selectedBill,
      company: company,
      party: parties.find(p => p.id === selectedReceipt.partyId),
      receiptNumber: selectedReceipt.receiptNumber,
      fifoAllocation: selectedReceipt.allocations
    });
    
    // Create the HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${selectedReceipt.receiptNumber}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: white; 
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
            .receipt-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border: 1px solid #ddd;
            }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
            .receipt-number { font-size: 18px; color: #3b82f6; font-family: monospace; }
            .company-info { 
              text-align: center; 
              margin-bottom: 20px; 
              padding: 15px; 
              border-bottom: 2px solid #d1d5db; 
            }
            .company-name { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .detail-item { margin-bottom: 15px; }
            .label { font-weight: bold; color: #374151; margin-bottom: 5px; }
            .value { font-size: 16px; }
            .amount { font-size: 24px; font-weight: bold; color: #059669; }
            .section { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; }
            .fifo-section { margin-top: 30px; }
            .fifo-title { font-size: 18px; font-weight: bold; color: #1d4ed8; margin-bottom: 15px; }
            .allocation-item { 
              padding: 15px; 
              background: #f9fafb; 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              margin-bottom: 10px; 
            }
            .allocation-header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 8px; 
            }
            .invoice-number { font-weight: bold; }
            .status { font-size: 14px; font-weight: bold; }
            .status.full { color: #059669; }
            .status.partial { color: #d97706; }
            .allocation-details { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
            .allocated-amount { font-size: 16px; font-weight: bold; color: #1d4ed8; }
            .footer { 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 1px solid #d1d5db; 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-end; 
            }
            .generated-info { font-size: 12px; color: #6b7280; }
            .signature { text-align: center; }
            .signature-line { 
              border-top: 2px solid #9ca3af; 
              width: 120px; 
              margin: 0 auto 8px; 
            }
            .signature-text { font-weight: bold; color: #374151; }
            .print-button { 
              position: fixed; 
              top: 20px; 
              right: 20px; 
              background: #3b82f6; 
              color: white; 
              padding: 10px 20px; 
              border: none; 
              border-radius: 5px; 
              cursor: pointer; 
              font-size: 14px; 
            }
            .print-button:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <button class="print-button no-print" onclick="window.print()">Print Receipt</button>
          <div class="receipt-container">
            <div class="header">
              <div class="title">PAYMENT RECEIPT</div>
              <div class="receipt-number">Receipt No: ${selectedReceipt.receiptNumber}</div>
            </div>
            
            <div class="company-info">
              <div class="company-name">${company?.firmName || company?.name || 'Company Name'}</div>
              ${company?.address ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 5px;">${company.address}</div>` : ''}
              ${company?.gstin ? `<div style="font-size: 14px; color: #6b7280;">GSTIN: ${company.gstin}</div>` : ''}
            </div>
            
            <div class="details-grid">
              <div class="detail-item">
                <div class="label">Date:</div>
                <div class="value">${selectedReceipt.paymentDate || new Date().toISOString().split('T')[0]}</div>
              </div>
              <div class="detail-item">
                <div class="label">Receipt No:</div>
                <div class="value" style="font-family: monospace; color: #3b82f6;">${selectedReceipt.receiptNumber}</div>
              </div>
            </div>
            
            <div class="section">
              <div class="detail-item">
                <div class="label">Received From:</div>
                <div class="value">${selectedReceipt.partyName || 'Party Name'}</div>
              </div>
              
              <div class="detail-item">
                <div class="label">Amount:</div>
                <div class="amount">₹${parseFloat(selectedReceipt.totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              </div>
              
              <div class="details-grid">
                <div class="detail-item">
                  <div class="label">Payment Mode:</div>
                  <div class="value">${selectedReceipt.paymentMode || 'Cash'}</div>
                </div>
                <div class="detail-item">
                  <div class="label">Reference:</div>
                  <div class="value">${selectedReceipt.reference || '-'}</div>
                </div>
              </div>
              
              <div class="detail-item">
                <div class="label">Payment Type:</div>
                <div class="value" style="color: #3b82f6;">${selectedReceipt.paymentType === 'bill' ? 'Bill Payment' : 'Khata Payment (FIFO)'}</div>
              </div>
              
              ${selectedReceipt.notes ? `
                <div class="detail-item">
                  <div class="label">Notes:</div>
                  <div class="value">${selectedReceipt.notes}</div>
                </div>
              ` : ''}
            </div>
            
            ${selectedReceipt.allocations && selectedReceipt.allocations.length > 0 ? `
              <div class="fifo-section">
                <div class="fifo-title">${selectedReceipt.type === 'purchase' ? 'Bill' : 'Invoice'}-wise Allocation (FIFO):</div>
                ${selectedReceipt.allocations.map((allocation, index) => `
                  <div class="allocation-item">
                    <div class="allocation-header">
                      <span class="invoice-number">${selectedReceipt.type === 'purchase' ? 'Bill' : 'Invoice'}: ${allocation.billNumber}</span>
                      <span class="status ${allocation.isFullPayment ? 'full' : 'partial'}">${allocation.isFullPayment ? '(Full)' : '(Partial)'}</span>
                    </div>
                    <div class="allocation-details">
                      Outstanding: ₹${(allocation.billOutstanding || 0).toLocaleString('en-IN')}
                    </div>
                    <div class="allocated-amount">
                      Allocated: ₹${(allocation.allocatedAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <div class="footer">
              <div class="generated-info">
                <div>Generated on: ${new Date().toLocaleDateString()}</div>
                <div>Time: ${new Date().toLocaleTimeString()}</div>
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-text">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  // Generate PDF receipt using direct jsPDF (no HTML rendering issues)
  const generatePDFReceipt = () => {
    if (!selectedReceipt) return;
    
    const doc = new jsPDF();
    
    // Set initial position
    let y = 15;
    
    // Add title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55); // Dark gray
    doc.text('PAYMENT RECEIPT', 105, y, { align: 'center' });
    y += 12;
    
    // Add receipt number
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246); // Blue color
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt No: ${selectedReceipt.receiptNumber}`, 105, y, { align: 'center' });
    y += 12;
    
    // Add company name
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(company?.firmName || company?.name || 'Company Name', 105, y, { align: 'center' });
    y += 8;
    
    // Add company details if available
    if (company?.address) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128); // Gray color
      doc.text(company.address, 105, y, { align: 'center' });
      y += 6;
    }
    if (company?.gstin) {
      doc.text(`GSTIN: ${company.gstin}`, 105, y, { align: 'center' });
      y += 10;
    }
    
    // Add line separator
    doc.setDrawColor(209, 213, 219); // Light gray line
    doc.line(25, y, 185, y);
    y += 12;
    
    // Add payment details section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    // Single column layout for better readability and no text cutoff
    const leftMargin = 30;
    const labelX = leftMargin;
    const valueX = leftMargin + 80;
    
    // Date
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedReceipt.paymentDate || new Date().toISOString().split('T')[0], valueX, y);
    y += 10;
    
    // Receipt Number
    doc.setFont('helvetica', 'bold');
    doc.text('Receipt No:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(59, 130, 246);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedReceipt.receiptNumber, valueX, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
    
    // Received From
    doc.setFont('helvetica', 'bold');
    doc.text('Received From:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.setFont('helvetica', 'bold');
    doc.text(selectedReceipt.partyName || 'Party Name', valueX, y);
    doc.setFont('helvetica', 'normal');
    y += 10;
    
    // Amount (larger and prominent)
    doc.setFont('helvetica', 'bold');
    doc.text('Amount:', labelX, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // Green color
    doc.text(`₹${parseFloat(selectedReceipt.totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, valueX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    y += 12;
    
    // Payment Mode
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Mode:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedReceipt.paymentMode || 'Cash', valueX, y);
    y += 10;
    
    // Reference
    doc.setFont('helvetica', 'bold');
    doc.text('Reference:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedReceipt.reference || '-', valueX, y);
    y += 10;
    
    // Payment Type
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Type:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(59, 130, 246);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedReceipt.paymentType === 'bill' ? 'Bill Payment' : 'Khata Payment (FIFO)', valueX, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 12;
    
    y += 15;
    
    // Add notes if available
    if (selectedReceipt.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 30, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedReceipt.notes, 80, y);
      y += 12;
    }
    
    // Add FIFO allocations if available
    if (selectedReceipt.allocations && selectedReceipt.allocations.length > 0) {
      y += 6;
      
      // Section title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(29, 78, 216); // Blue color
      doc.text(`${selectedReceipt.type === 'purchase' ? 'Bill' : 'Invoice'}-wise Allocation (FIFO):`, 30, y);
      y += 10;
      
      // Add subtle background for allocations
      doc.setFillColor(249, 250, 251); // Light gray background
      doc.rect(25, y - 5, 160, (selectedReceipt.allocations.length * 25) + 10, 'F');
      
      selectedReceipt.allocations.forEach((allocation, index) => {
        if (y > 240) {
          doc.addPage();
          y = 25;
        }
        
        // Allocation header with better spacing
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`${selectedReceipt.type === 'purchase' ? 'Bill' : 'Invoice'}: ${allocation.billNumber}`, 35, y);
        
        const status = allocation.allocatedAmount >= allocation.billOutstanding ? '(Full)' : '(Partial)';
        const statusColor = allocation.allocatedAmount >= allocation.billOutstanding ? [5, 150, 105] : [217, 119, 6];
        doc.setTextColor(...statusColor);
        doc.text(status, 160, y);
        doc.setTextColor(0, 0, 0);
        
        y += 5;
        
        // Allocation details with better formatting
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128); // Gray color
        doc.text(`Outstanding: ₹${(allocation.billOutstanding || 0).toLocaleString('en-IN')}`, 40, y);
        y += 5;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 78, 216); // Blue color
        doc.text(`Allocated: ₹${(allocation.allocatedAmount || 0).toLocaleString('en-IN')}`, 40, y);
        doc.setTextColor(0, 0, 0);
        
        y += 10;
      });
    }
    
    // Add footer
    if (y > 250) {
      doc.addPage();
      y = 25;
    }
    
    y += 15;
    
    // Footer line
    doc.setDrawColor(209, 213, 219);
    doc.line(25, y, 185, y);
    y += 12;
    
    // Generated info
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 30, y);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, 30, y + 6);
    
    // Signature section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Authorized Signatory', 150, y, { align: 'center' });
    doc.setDrawColor(156, 163, 175);
    doc.line(120, y + 6, 180, y + 6);
    
    // Save the PDF
    doc.save(`receipt-${selectedReceipt.receiptNumber}.pdf`);
  };

  // Check and fix duplicate receipt numbers
  const checkAndFixDuplicateReceiptNumbers = async () => {
    try {
      console.log('=== CHECKING ALL RECEIPT NUMBERS ===');
      const paymentsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/payments`), orderBy('receiptNumber'));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      const receiptNumbers = new Set();
      const duplicates = [];
      const allReceiptNumbers = [];
      
      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data();
        if (payment.receiptNumber) {
          allReceiptNumbers.push({
            id: doc.id,
            receiptNumber: payment.receiptNumber,
            partyName: payment.partyName || 'Unknown',
            amount: payment.totalAmount || payment.amount || 0
          });
          
          if (receiptNumbers.has(payment.receiptNumber)) {
            duplicates.push({ id: doc.id, receiptNumber: payment.receiptNumber });
          } else {
            receiptNumbers.add(payment.receiptNumber);
          }
        }
      });
      
      console.log('=== ALL EXISTING RECEIPT NUMBERS ===');
      allReceiptNumbers.forEach((item, index) => {
        console.log(`${index + 1}. ${item.receiptNumber} - ${item.partyName} - ₹${item.amount}`);
      });
      
      console.log('=== DUPLICATE RECEIPT NUMBERS ===');
      console.log('Duplicates found:', duplicates);
      
      if (duplicates.length > 0) {
        console.log('=== FIXING DUPLICATES ===');
        // Fix duplicates by regenerating receipt numbers
        for (const duplicate of duplicates) {
          const newReceiptNumber = await generateReceiptNumber();
          console.log(`Fixing duplicate: ${duplicate.receiptNumber} -> ${newReceiptNumber}`);
          
          await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/payments`, duplicate.id), {
            receiptNumber: newReceiptNumber
          });
        }
        
        console.log(`Fixed ${duplicates.length} duplicate receipt numbers`);
      } else {
        console.log('No duplicates found!');
      }
      
      console.log('=== END CHECK ===');
    } catch (error) {
      console.error('Error checking/fixing duplicate receipt numbers:', error);
    }
  };

  // Handle ESC key for modals (LIFO - Last In, First Out)
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        // LIFO order: Last opened modal closes first
        if (showReceiptModal) {
          setShowReceiptModal(false);
        } else if (showPaymentDetailsModal) {
          setShowPaymentDetailsModal(false);
        } else if (showPaymentModal) {
          setShowPaymentModal(false);
        }
      }
    };
    if (showPaymentModal || showPaymentDetailsModal || showReceiptModal) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showPaymentModal, showPaymentDetailsModal, showReceiptModal]);

  // Get bill payments
  const getBillPayments = (bill) => {
    return payments.filter(p => 
      p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === activeTab)
    );
  };

  // Get party-wise summary
  const getPartyWiseSummary = () => {
    const bills = getFilteredBills(); // Use filtered bills to apply time filters
    const partySummary = {};
    
    bills.forEach(bill => {
      const partyId = bill.partyId || bill.party;
      if (!partySummary[partyId]) {
        partySummary[partyId] = {
          partyId: partyId,
          partyName: getPartyName(partyId),
          totalBills: 0,
          totalAmount: 0,
          totalPaid: 0,
          outstanding: 0
        };
      }
      
      partySummary[partyId].totalBills++;
      partySummary[partyId].totalAmount += bill.totalAmount || 0;
      partySummary[partyId].totalPaid += bill.totalPaid || 0;
      partySummary[partyId].outstanding += bill.outstanding || 0;
    });
    
    let summary = Object.values(partySummary);
    
    // Sort by party name
    summary.sort((a, b) => a.partyName.localeCompare(b.partyName));
    
    // Filter by search term
    if (partySearchTerm) {
      summary = summary.filter(party => 
        party.partyName.toLowerCase().includes(partySearchTerm.toLowerCase())
      );
    }
    
    return summary;
  };

  // Table pagination hook - placed after function definitions
  const sortedPartySummary = getSortedData(getPartyWiseSummary());
  const pagination = useTablePagination(sortedPartySummary, 10);



  // Calculate totals for bills table
  const getBillsTotals = () => {
    const bills = getFilteredBills();
    return {
      totalBills: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0),
      totalPaid: bills.reduce((sum, bill) => sum + (bill.totalPaid || 0), 0),
      totalOutstanding: bills.reduce((sum, bill) => sum + (bill.outstanding || 0), 0)
    };
  };

  // Calculate totals for party-wise summary
  const getPartyWiseTotals = () => {
    const summary = getPartyWiseSummary();
    return {
      totalParties: summary.length,
      totalBills: summary.reduce((sum, party) => sum + party.totalBills, 0),
      totalAmount: summary.reduce((sum, party) => sum + party.totalAmount, 0),
      totalPaid: summary.reduce((sum, party) => sum + party.totalPaid, 0),
      totalOutstanding: summary.reduce((sum, party) => sum + party.outstanding, 0)
    };
  };

  // Calculate totals for receipts table
  const getReceiptsTotals = () => {
    const filteredReceipts = payments.filter(payment => {
      if (activeTab === 'receipts') {
        // Filter by sub-tab for receipts
        return payment.type === receiptsSubTab;
      }
      return payment.type === activeTab;
    });
    
    return {
      totalReceipts: filteredReceipts.length,
      totalAmount: filteredReceipts.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0)
    };
  };

  // Comprehensive Export Functions
  const handleExport = async (tableType) => {
    let filename = 'payments-report';
    let tables = [];
    let title = '';
    
    if (tableType === 'bills') {
    const bills = getFilteredBills();
    const exportData = bills.map(bill => ({
        billNumber: getBillNumber(bill),
        date: convertTimestamp(bill[getBillDateField()]),
        partyName: getPartyName(bill.partyId || bill.party),
        totalAmount: bill.totalAmount || 0,
        totalPaid: bill.totalPaid || 0,
        outstanding: bill.outstanding || 0,
        paymentCount: bill.paymentCount || 0
      }));

      // Calculate totals
      const totals = getBillsTotals();
      const totalRow = {
        billNumber: `TOTAL (${totals.totalBills} bills)`,
        date: '',
        partyName: '',
        totalAmount: totals.totalAmount,
        totalPaid: totals.totalPaid,
        outstanding: totals.totalOutstanding,
        paymentCount: ''
      };

      tables = [{
        arr: [...exportData, totalRow],
        columns: [
          { key: 'billNumber', label: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Number` },
          { key: 'date', label: 'Date' },
          { key: 'partyName', label: 'Party Name' },
          { key: 'totalAmount', label: 'Total Amount' },
          { key: 'totalPaid', label: 'Total Paid' },
          { key: 'outstanding', label: 'Outstanding' },
          { key: 'paymentCount', label: 'Payment Count' }
        ],
        tableTitle: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Bills`
      }];
      filename = `${activeTab}-bills`;
      title = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Bills Report`;
    } else if (tableType === 'party-summary') {
    const summary = getPartyWiseSummary();
    const exportData = summary.map(party => ({
        partyName: party.partyName,
        totalBills: party.totalBills,
        totalAmount: party.totalAmount,
        totalPaid: party.totalPaid,
        outstanding: party.outstanding
      }));

      // Calculate totals
      const totals = getPartyWiseTotals();
      const totalRow = {
        partyName: `TOTAL (${totals.totalParties} parties)`,
        totalBills: totals.totalBills,
        totalAmount: totals.totalAmount,
        totalPaid: totals.totalPaid,
        outstanding: totals.totalOutstanding
      };

      tables = [{
        arr: [...exportData, totalRow],
        columns: [
          { key: 'partyName', label: 'Party Name' },
          { key: 'totalBills', label: 'Total Bills' },
          { key: 'totalAmount', label: 'Total Amount' },
          { key: 'totalPaid', label: 'Total Paid' },
          { key: 'outstanding', label: 'Outstanding' }
        ],
        tableTitle: 'Party-wise Summary'
      }];
      filename = 'party-summary';
      title = 'Party-wise Summary Report';
    } else if (tableType === 'receipts') {
    const filteredReceipts = payments.filter(payment => {
      if (activeTab === 'receipts') {
        return payment.type === receiptsSubTab;
      }
      return payment.type === activeTab;
    });

    const exportData = filteredReceipts.map(payment => ({
        receiptNumber: payment.receiptNumber,
        date: convertTimestamp(payment.paymentDate),
        partyName: payment.partyName,
        amount: payment.totalAmount || 0,
        paymentMode: payment.paymentMode,
        paymentType: payment.paymentType === 'bill' ? 'Bill Payment' : 'Khata Payment',
        reference: payment.reference || '-',
        notes: payment.notes || '-'
      }));

      // Calculate totals
      const totals = getReceiptsTotals();
      const totalRow = {
        receiptNumber: `TOTAL (${totals.totalReceipts} receipts)`,
        date: '',
        partyName: '',
        amount: totals.totalAmount,
        paymentMode: '',
        paymentType: '',
        reference: '',
        notes: ''
      };

      tables = [{
        arr: [...exportData, totalRow],
        columns: [
          { key: 'receiptNumber', label: 'Receipt Number' },
          { key: 'date', label: 'Date' },
          { key: 'partyName', label: 'Party Name' },
          { key: 'amount', label: 'Amount' },
          { key: 'paymentMode', label: 'Payment Mode' },
          { key: 'paymentType', label: 'Payment Type' },
          { key: 'reference', label: 'Reference' },
          { key: 'notes', label: 'Notes' }
        ],
        tableTitle: `${activeTab === 'receipts' ? receiptsSubTab.charAt(0).toUpperCase() + receiptsSubTab.slice(1) : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Receipts`
      }];
      filename = `${activeTab === 'receipts' ? receiptsSubTab : activeTab}-receipts`;
      title = `${activeTab === 'receipts' ? receiptsSubTab.charAt(0).toUpperCase() + receiptsSubTab.slice(1) : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Receipts Report`;
    } else if (tableType === 'all') {
      // Export all tables together
      const bills = getFilteredBills();
      const summary = getPartyWiseSummary();
      const filteredReceipts = payments.filter(payment => {
        if (activeTab === 'receipts') {
          return payment.type === receiptsSubTab;
        }
        return payment.type === activeTab;
      });

      // Calculate totals for bills
      const billsTotals = getBillsTotals();
      const billsTotalRow = {
        billNumber: `TOTAL (${billsTotals.totalBills} bills)`,
        date: '',
        partyName: '',
        totalAmount: billsTotals.totalAmount,
        totalPaid: billsTotals.totalPaid,
        outstanding: billsTotals.totalOutstanding,
        paymentCount: ''
      };

      // Calculate totals for party summary
      const partyTotals = getPartyWiseTotals();
      const partyTotalRow = {
        partyName: `TOTAL (${partyTotals.totalParties} parties)`,
        totalBills: partyTotals.totalBills,
        totalAmount: partyTotals.totalAmount,
        totalPaid: partyTotals.totalPaid,
        outstanding: partyTotals.totalOutstanding
      };

      // Calculate totals for receipts
      const receiptsTotals = getReceiptsTotals();
      const receiptsTotalRow = {
        receiptNumber: `TOTAL (${receiptsTotals.totalReceipts} receipts)`,
        date: '',
        partyName: '',
        amount: receiptsTotals.totalAmount,
        paymentMode: '',
        paymentType: '',
        reference: '',
        notes: ''
      };

      tables = [
        {
          arr: [...bills.map(bill => ({
            billNumber: getBillNumber(bill),
            date: convertTimestamp(bill[getBillDateField()]),
            partyName: getPartyName(bill.partyId || bill.party),
            totalAmount: bill.totalAmount || 0,
            totalPaid: bill.totalPaid || 0,
            outstanding: bill.outstanding || 0,
            paymentCount: bill.paymentCount || 0
          })), billsTotalRow],
          columns: [
            { key: 'billNumber', label: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Number` },
            { key: 'date', label: 'Date' },
            { key: 'partyName', label: 'Party Name' },
            { key: 'totalAmount', label: 'Total Amount' },
            { key: 'totalPaid', label: 'Total Paid' },
            { key: 'outstanding', label: 'Outstanding' },
            { key: 'paymentCount', label: 'Payment Count' }
          ],
          tableTitle: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Bills`
        },
        {
          arr: [...summary.map(party => ({
            partyName: party.partyName,
            totalBills: party.totalBills,
            totalAmount: party.totalAmount,
            totalPaid: party.totalPaid,
            outstanding: party.outstanding
          })), partyTotalRow],
          columns: [
            { key: 'partyName', label: 'Party Name' },
            { key: 'totalBills', label: 'Total Bills' },
            { key: 'totalAmount', label: 'Total Amount' },
            { key: 'totalPaid', label: 'Total Paid' },
            { key: 'outstanding', label: 'Outstanding' }
          ],
          tableTitle: 'Party-wise Summary'
        },
        {
          arr: [...filteredReceipts.map(payment => ({
            receiptNumber: payment.receiptNumber,
            date: convertTimestamp(payment.paymentDate),
            partyName: payment.partyName,
            amount: payment.totalAmount || 0,
            paymentMode: payment.paymentMode,
            paymentType: payment.paymentType === 'bill' ? 'Bill Payment' : 'Khata Payment',
            reference: payment.reference || '-',
            notes: payment.notes || '-'
          })), receiptsTotalRow],
          columns: [
            { key: 'receiptNumber', label: 'Receipt Number' },
            { key: 'date', label: 'Date' },
            { key: 'partyName', label: 'Party Name' },
            { key: 'amount', label: 'Amount' },
            { key: 'paymentMode', label: 'Payment Mode' },
            { key: 'paymentType', label: 'Payment Type' },
            { key: 'reference', label: 'Reference' },
            { key: 'notes', label: 'Notes' }
          ],
          tableTitle: `${activeTab === 'receipts' ? receiptsSubTab.charAt(0).toUpperCase() + receiptsSubTab.slice(1) : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Receipts`
        }
      ];
      filename = `${activeTab}-complete-report`;
      title = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Complete Report`;
    }

    // Export logic
    if (exportFormat === 'pdf') {
      await multiTablePDF(tables, filename + '.pdf', title, company);
    } else if (exportFormat === 'excel') {
      multiTableExcel(tables, filename + '.xlsx');
    } else if (exportFormat === 'csv') {
      await multiTableCSV(tables, filename);
    }
  };

  // Legacy export functions (for backward compatibility)
  const exportBillsData = (format) => {
    handleExport('bills');
  };
  
  const exportPartyWiseData = (format) => {
    handleExport('party-summary');
  };

  const exportReceiptsData = (format) => {
    handleExport('receipts');
  };

  const filteredBills = getFilteredBills();
  const partySummary = getPartyWiseSummary();

  // Bills table pagination hook - use new sorting system
  const sortedBills = getBillsSortedData(filteredBills);
  const billsPagination = useTablePagination(sortedBills, 10);

  // --- ADVANCE AGGREGATION AND USAGE LOGIC ---

  /**
   * Get total available advance for a party (carry-forward across years, minus used/refunded)
   * @param {string} partyId
   * @returns {number}
   */
  const getPartyAdvance = (partyId) => {
    return getPartyAdvanceUtil(partyId, payments);
  };

  /**
   * Allocate available advance to a new bill (FIFO: oldest advances first)
   * @param {string} partyId
   * @param {number} billAmount
   * @returns {Object} { allocatedAdvance, advanceAllocations: [{paymentId, amountUsed}], remainingBillAmount }
   */
  const allocateAdvanceToBill = (partyId, billAmount) => {
    return allocateAdvanceToBillUtil(partyId, billAmount, payments);
  };

  /**
   * Mark advances as used (update payment records with advanceUsed field)
   * @param {Array} allocations [{paymentId, amountUsed}]
   */
  const markAdvanceUsed = async (allocations) => {
    return markAdvanceUsedUtil(allocations, db, appId, userId, payments);
  };

  /**
   * Refund an advance (set advanceRefunded flag)
   * @param {string} paymentId
   */
  const refundAdvance = async (paymentId) => {
    return refundAdvanceUtil(paymentId, db, appId, userId);
  };

  // Get advance details for a party
  const getAdvanceDetails = (partyId) => {
    return getAdvanceDetailsUtil(partyId, payments);
  };

  // Set advance modal party
  const [advanceModalParty, setAdvanceModalParty] = useState(null);

  // Add state for advance info popup
  const [showAdvanceInfo, setShowAdvanceInfo] = useState(false);
  const [advanceInfo, setAdvanceInfo] = useState({ collected: 0, used: 0 });

  // Add ESC key handling for modals (LIFO order)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showReceiptModal) {
          setShowReceiptModal(false);
        } else if (advanceModalParty) {
          setAdvanceModalParty(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showReceiptModal, advanceModalParty]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Payments</h1>
      
      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        {['invoice', 'challan', 'purchase', 'receipts'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab === 'receipts' ? 'Payment Receipts' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Sub-tabs for Payment Receipts */}
      {activeTab === 'receipts' && (
        <div className="flex space-x-1 mb-6">
          {['invoice', 'challan', 'purchase'].map((subTab) => (
            <button
              key={subTab}
              onClick={() => setReceiptsSubTab(subTab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                receiptsSubTab === subTab
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {subTab.charAt(0).toUpperCase() + subTab.slice(1)} Receipts
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Time Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Filter</label>
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
                // Reset sub-filters when changing main filter
                setSelectedSubFilter('');
                setSelectedMonth('');
                setSelectedQuarter('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="custom">Custom</option>
              <option value="financial">Financial Year</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {timeFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Financial Year Filter */}
          {timeFilter === 'financial' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Financial Year</label>
                <select
                  value={selectedFinancialYear}
                  onChange={(e) => {
                    setSelectedFinancialYear(e.target.value);
                    // Reset sub-filters when changing financial year
                    setSelectedSubFilter('');
                    setSelectedMonth('');
                    setSelectedQuarter('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getAvailableFinancialYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              {/* Sub-filter for Financial Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Type</label>
                <select
                  value={selectedSubFilter}
                  onChange={(e) => {
                    setSelectedSubFilter(e.target.value);
                    setSelectedMonth('');
                    setSelectedQuarter('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Full Financial Year</option>
                  <option value="month">Specific Month</option>
                  <option value="quarter">Specific Quarter</option>
                </select>
              </div>
              
              {/* Month Filter (only when sub-filter is 'month') */}
              {selectedSubFilter === 'month' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Month</option>
                    <option value="04-25">April 2025</option>
                    <option value="05-25">May 2025</option>
                    <option value="06-25">June 2025</option>
                    <option value="07-25">July 2025</option>
                    <option value="08-25">August 2025</option>
                    <option value="09-25">September 2025</option>
                    <option value="10-25">October 2025</option>
                    <option value="11-25">November 2025</option>
                    <option value="12-25">December 2025</option>
                    <option value="01-26">January 2026</option>
                    <option value="02-26">February 2026</option>
                    <option value="03-26">March 2026</option>
                  </select>
                </div>
              )}
              
              {/* Quarter Filter (only when sub-filter is 'quarter') */}
              {selectedSubFilter === 'quarter' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Quarter</option>
                    {getCurrentFinancialYearQuarters().map(quarter => (
                      <option key={quarter.value} value={quarter.value}>{quarter.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}



          {/* Party Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Party</label>
            <div className="flex space-x-2">
              <select
                value={selectedParty}
                onChange={(e) => setSelectedParty(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Parties</option>
                              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.firmName || party.name}
                </option>
              ))}
              </select>
              <button
                onClick={() => {
                  setSelectedParty('');
                  setTimeFilter('all');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                  // Reset to current financial year or first available year
                  const availableYears = getAvailableFinancialYears();
                  const currentFY = getCurrentFinancialYear();
                  const defaultYear = availableYears.includes(currentFY) ? currentFY : (availableYears.length > 0 ? availableYears[0] : '');
                  setSelectedFinancialYear(defaultYear);
                  setSelectedMonth('');
                  setSelectedQuarter('');
                  setSelectedSubFilter('');
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
              >
                Clear
              </button>

            </div>
          </div>

          {/* Export Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content - Bills and Party Summary (for invoice, challan, purchase tabs) */}
      {activeTab !== 'receipts' && (
        <>
          {/* Overall Records Table */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Overall {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Records</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => handleExport('bills')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Export {exportFormat.toUpperCase()}
              </button>
              <button
                onClick={() => handleExport('all')}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Export All Tables
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader columnKey="number" label={`${activeTab.toUpperCase()} NUMBER`} onSort={handleBillsSort} sortConfig={billsSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="partyName" label="PARTY NAME" onSort={handleBillsSort} sortConfig={billsSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="totalAmount" label="TOTAL AMOUNT" onSort={handleBillsSort} sortConfig={billsSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="totalPaid" label="TOTAL PAID" onSort={handleBillsSort} sortConfig={billsSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="outstanding" label="OUTSTANDING" onSort={handleBillsSort} sortConfig={billsSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="paymentCount" label="PAYMENT RECEIPTS" onSort={handleBillsSort} sortConfig={billsSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {billsPagination.currentData.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {getBillNumber(bill)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getPartyName(bill.partyId || bill.party)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{parseFloat(bill.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{parseFloat(bill.totalPaid || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-medium ${bill.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{parseFloat(bill.outstanding || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={() => handleViewPaymentDetails(bill)}
                      className="text-blue-600 hover:text-blue-900 font-medium underline"
                      title="View Payment Receipts"
                    >
                      Receipts ({bill.paymentCount || 0})
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={() => handleAddPayment(bill)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Add Payment
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              {(() => {
                const totals = getBillsTotals();
                return (
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>Total ({totals.totalBills} bills)</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>₹{totals.totalAmount.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>₹{totals.totalPaid.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong className="text-red-600">₹{totals.totalOutstanding.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <PaginationControls {...billsPagination} />
      </div>

      {/* Party-wise Summary Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Party-wise Summary</h2>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Search parties..."
                value={partySearchTerm}
                onChange={(e) => setPartySearchTerm(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  setPartySearchTerm('');
                  setSelectedParty('');
                  setTimeFilter('all');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                  // Reset to current financial year or first available year
                  const availableYears = getAvailableFinancialYears();
                  const currentFY = getCurrentFinancialYear();
                  const defaultYear = availableYears.includes(currentFY) ? currentFY : (availableYears.length > 0 ? availableYears[0] : '');
                  setSelectedFinancialYear(defaultYear);
                  setSelectedMonth('');
                  setSelectedQuarter('');
                  setSelectedSubFilter('');
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
              >
                Clear All
              </button>
              <button
                onClick={() => handleExport('party-summary')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader columnKey="partyName" label="PARTY NAME" onSort={handleNewSort} sortConfig={newSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="totalBills" label="TOTAL BILLS" onSort={handleNewSort} sortConfig={newSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="totalAmount" label="TOTAL AMOUNT" onSort={handleNewSort} sortConfig={newSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="totalPaid" label="TOTAL PAID" onSort={handleNewSort} sortConfig={newSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <SortableHeader columnKey="outstanding" label="OUTSTANDING" onSort={handleNewSort} sortConfig={newSortConfig} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ADVANCE
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.map((party) => {
                const advance = getPartyAdvance(party.partyId);
                return (
                <tr key={party.partyId} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {party.partyName}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {party.totalBills}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{parseFloat(party.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{parseFloat(party.totalPaid || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-medium ${party.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{parseFloat(party.outstanding || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {advance > 0 ? (
                        <button
                          className="text-blue-600 underline hover:text-blue-800 font-semibold"
                          onClick={() => setAdvanceModalParty(party.partyId)}
                        >
                          ₹{advance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </button>
                      ) : (
                        <span className="text-gray-400">₹0</span>
                      )}
                    </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedParty(party.partyId);
                          setActiveTab('invoice');
                        }}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View Bills
                      </button>
                      {party.outstanding > 0 && (
                        <button
                          onClick={() => handleAddKhataPayment(party.partyId)}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Add FIFO Payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {/* Totals Row */}
              {(() => {
                const totals = getPartyWiseTotals();
                return (
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>Total ({totals.totalParties} parties)</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>{totals.totalBills}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>₹{totals.totalAmount.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>₹{totals.totalPaid.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong className="text-red-600">₹{totals.totalOutstanding.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          <PaginationControls {...pagination} />
        </div>
      </div>
        </>
      )}

      {/* Payment Receipts Table (for receipts tab) */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Payment Receipts</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleExport('receipts')}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Export {exportFormat.toUpperCase()}
                </button>
                <button
                  onClick={() => handleExport('all')}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                >
                  Export All Tables
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleReceiptsSort('receiptNumber')}>
                    RECEIPT NUMBER
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleReceiptsSort('partyName')}>
                    PARTY NAME
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleReceiptsSort('totalAmount')}>
                    AMOUNT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleReceiptsSort('paymentDate')}>
                    DATE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleReceiptsSort('paymentMode')}>
                    MODE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleReceiptsSort('paymentType')}>
                    TYPE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortReceipts(payments.filter(payment => payment.type === receiptsSubTab)).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.receiptNumber}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.partyName}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{parseFloat(payment.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentDate || payment.date}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentMode}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        payment.paymentType === 'bill' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {payment.paymentType === 'bill' ? 'Bill Payment' : 'Khata Payment'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handlePreviewReceipt(payment)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                {(() => {
                  const totals = getReceiptsTotals();
                  return (
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>Total ({totals.totalReceipts} receipts)</strong>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>-</strong>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>₹{totals.totalAmount.toLocaleString('en-IN')}</strong>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>-</strong>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>-</strong>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>-</strong>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <strong>-</strong>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {paymentType === 'bill' ? 'Add Bill Payment' : 'Add Khata Payment'}
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Payment Type Indicator */}
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  {paymentType === 'bill' ? (
                    <>
                      <strong>Bill-wise Payment:</strong> Payment against specific bill
                      {selectedBill && (
                        <div className="mt-1 text-xs">
                          Bill: {getBillNumber(selectedBill)} | 
                          Outstanding: ₹{parseFloat(selectedBill?.outstanding || 0).toLocaleString('en-IN')}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Khata-wise Payment:</strong> FIFO allocation across all bills
                      <div className="mt-1 text-xs">
                        Party: {getPartyName(selectedPartyForPayment)}
                      </div>
                    </>
                  )}
                </p>
              </div>
              
              {/* Party Selection (only for khata payments) */}
              {paymentType === 'khata' && (
                <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Party</label>
                  <select
                    value={selectedPartyForPayment}
                    onChange={(e) => setSelectedPartyForPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Party</option>
                    {parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.firmName || party.name}
                      </option>
                    ))}
                  </select>
                </div>
                  
                  {/* Advance Information for Khata Payment */}
                  {selectedPartyForPayment && (() => {
                    const availableAdvance = getPartyAdvance(selectedPartyForPayment);
                    if (availableAdvance > 0) {
                      return (
                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                          <div className="text-sm text-yellow-800">
                            <strong>Available Advance:</strong> ₹{availableAdvance.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            This advance will be automatically allocated to outstanding bills before processing the new payment.
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
              
              {/* Party Display (for bill payments) */}
              {paymentType === 'bill' && selectedBill && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bill Number</label>
                    <input
                      type="text"
                      value={getBillNumber(selectedBill)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Party</label>
                    <input
                      type="text"
                      value={getPartyName(selectedBill.partyId || selectedBill.party)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      readOnly
                    />
                  </div>
                  
                  {/* Advance Information */}
                  {(() => {
                    const partyId = selectedBill.partyId || selectedBill.party;
                    const availableAdvance = getPartyAdvance(partyId);
                    if (availableAdvance > 0) {
                      return (
                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                          <div className="text-sm text-yellow-800">
                            <strong>Available Advance:</strong> ₹{availableAdvance.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            This advance will be automatically allocated to this bill before processing the new payment.
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            <strong>Note:</strong> The actual payment amount needed will be reduced by this advance amount.
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount"
                    step="0.01"
                    min="0"
                  />
                  {paymentType === 'bill' && selectedBill && (() => {
                    const partyId = selectedBill.partyId || selectedBill.party;
                    const availableAdvance = getPartyAdvance(partyId);
                    const actualOutstanding = Math.max(0, (selectedBill.outstanding || 0) - availableAdvance);
                    
                    return (
                      <div className="space-y-1">
                        {availableAdvance > 0 && (
                          <div className="text-xs text-gray-600">
                            <strong>Actual payment needed:</strong> ₹{actualOutstanding.toLocaleString('en-IN')} 
                            (after ₹{availableAdvance.toLocaleString('en-IN')} advance allocation)
                          </div>
                        )}
                        <div className="text-xs text-blue-600">
                          <strong>Note:</strong> If you pay more than ₹{actualOutstanding.toLocaleString('en-IN')}, 
                          the excess amount will be automatically allocated to other outstanding bills using FIFO. 
                          If no other bills exist, it will be saved as advance.
                        </div>
                      </div>
                    );
                  })()}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {paymentModes.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cheque number, UPI reference, etc."
                />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Additional notes"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Number</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>

              {/* Advance Information */}
              {showAdvanceInfo && (
                <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded">
                  <div className="font-semibold mb-1">Advance Information</div>
                  <div>Advance Collected: <span className="font-bold">₹{advanceInfo.collected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                  {advanceInfo.used > 0 && (
                    <div>Advance Used: <span className="font-bold">₹{advanceInfo.used.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                  )}
                  <button className="mt-2 text-blue-600 underline text-xs" onClick={() => setShowAdvanceInfo(false)}>Dismiss</button>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSavePayment}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Save Payment
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Payment Receipts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}: {selectedBill[getBillNumberField()]} | 
                  Party: {getPartyName(selectedBill.partyId || selectedBill.party)} | 
                  Total Amount: ₹{(selectedBill.totalAmount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            
            {/* Payment Summary */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Total Bill Amount:</span>
                  <span className="ml-2 text-lg font-semibold">₹{(selectedBill.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Total Paid:</span>
                  <span className="ml-2 text-lg font-semibold text-green-600">₹{(selectedBill.totalPaid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Outstanding:</span>
                  <span className="ml-2 text-lg font-semibold text-red-600">₹{(selectedBill.outstanding || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
              
              {/* Advance Allocation Summary */}
              {(() => {
                const billPayments = getBillPayments(selectedBill);
                const advancePayments = billPayments.filter(payment => 
                  payment.advanceAllocations && payment.advanceAllocations.length > 0
                );
                
                if (advancePayments.length > 0) {
                  const totalAdvanceUsed = advancePayments.reduce((sum, payment) => 
                    sum + (payment.advanceUsed || 0), 0
                  );
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm">
                        <span className="font-medium text-purple-700">Advance Used:</span>
                        <span className="ml-2 text-lg font-semibold text-purple-600">₹{totalAdvanceUsed.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        This amount was automatically allocated from available advances
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PAYMENT RECEIPT NO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AGAINST {activeTab.toUpperCase()}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AMOUNT PAID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DATE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      MODE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getBillPayments(selectedBill).map((payment) => {
                    const allocation = payment.allocations.find(a => a.billId === selectedBill.id && a.billType === activeTab);
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.receiptNumber}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {allocation?.billNumber || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{parseFloat(allocation?.allocatedAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.date}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.paymentMode}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handlePreviewReceipt(payment)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => handleDeletePayment(payment)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* Advance Details Modal */}
      {advanceModalParty && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              onClick={() => setAdvanceModalParty(null)}
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 text-blue-700">Advance Details</h2>
            <div className="mb-4">
              <span className="font-semibold">Party:</span> {getPartyName(advanceModalParty)}
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {payments.filter(p => p.partyId === advanceModalParty && p.remainingAmount > 0 && !p.advanceRefunded && !p.advanceFullyUsed).map((adv, idx) => (
                <div key={adv.id} className="border rounded p-3 bg-gray-50 flex flex-col">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-blue-700">Receipt: {adv.receiptNumber}</span>
                    <span className="text-xs text-gray-500">{adv.paymentDate || adv.createdAt}</span>
                  </div>
                  <div className="text-sm text-gray-700">Amount: ₹{adv.remainingAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                  <div className="text-xs text-gray-500">Mode: {adv.paymentMode}</div>
                  <div className="text-xs text-gray-500">Reference: {adv.reference || '-'}</div>
                  <div className="flex space-x-2 mt-2">
                    <button
                      className="text-blue-600 underline text-xs"
                      onClick={() => handlePreviewReceipt(adv)}
                    >
                      Preview
                    </button>
                    <button
                      className="text-red-600 underline text-xs"
                      onClick={async () => { await refundAdvance(adv.id); setAdvanceModalParty(null); }}
                    >
                      Refund
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setAdvanceModalParty(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Receipt Preview Modal (should be rendered after advance modal for higher z-index) */}
      {showReceiptModal && selectedReceipt && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
                      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Payment Receipt - {selectedReceipt.receiptNumber}</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    setShowPaymentDetailsModal(true);
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                  title="Back to receipts list"
                >
                  ← Back to List
                </button>
                <button
                  onClick={printReceipt}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  title="Print using browser print dialog"
                >
                  Print
                </button>
                <button
                  onClick={generatePDFReceipt}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  title="Download as PDF file"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              {selectedReceipt.type === 'purchase' ? (
                <PurchaseReceiptTemplate
                  receipt={selectedReceipt}
                  bill={selectedBill}
                  company={company}
                  party={parties.find(p => p.id === selectedReceipt.partyId)}
                  receiptNumber={selectedReceipt.receiptNumber}
                  fifoAllocation={selectedReceipt.allocations}
                />
              ) : (
                <ReceiptTemplate
                  receipt={selectedReceipt}
                  bill={selectedBill}
                  company={company}
                  party={parties.find(p => p.id === selectedReceipt.partyId)}
                  receiptNumber={selectedReceipt.receiptNumber}
                  fifoAllocation={selectedReceipt.allocations}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;

