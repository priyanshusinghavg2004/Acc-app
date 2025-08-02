import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import InvoiceTemplate from './BillTemplates/InvoiceTemplate';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { useTableSort } from '../utils/tableSort';
import { useTablePagination } from '../utils/tablePagination';
import PaginationControls from '../utils/PaginationControls';
// Use jsPDF from the global window object
const jsPDF = window.jspdf.jsPDF;
console.log('autoTable on jsPDF:', typeof jsPDF.prototype.autoTable);

// Replace REPORT_TYPES with grouped structure
const REPORT_GROUPS = [
  {
    label: 'Sales & Purchases (Partywise)',
    options: [
      { value: 'partywise-sales', label: 'Partywise Sales' },
      { value: 'partywise-purchase', label: 'Partywise Purchase' },
      { value: 'partywise-challan', label: 'Partywise Challan' },
      { value: 'partywise-quotation', label: 'Partywise Quotation' },
      { value: 'partywise-purchase-orders', label: 'Partywise Purchase Orders' },
      { value: 'profit-loss', label: 'Profit & Loss' },
    ],
  },
  {
    label: 'Inventory & Items',
    options: [
      { value: 'itemwise-report', label: 'Itemwise Report' },
      { value: 'stock', label: 'Stock/Inventory' },
    ],
  },
  {
    label: 'GST / Income Tax',
    options: [
      { value: 'gst-summary-regular', label: 'GST Summary (Regular)' },
      { value: 'gst-summary-composition', label: 'GST Summary (Composition)' },
    ],
  },
  {
    label: 'Party/Account Ledgers',
    options: [
      { value: 'ledger', label: 'Ledger' },
      { value: 'customer-ledger', label: 'Customer Ledger (Khata)' },
      { value: 'supplier-ledger', label: 'Supplier Ledger (Khata)' },
    ],
  },
  {
    label: 'Documents/Transactions',
    options: [
      { value: 'daybook', label: 'Daybook/Cashbook' },
      { value: 'bills', label: 'Bills' },
    ],
  },
  {
    label: 'Expenses',
    options: [
      { value: 'expenses', label: 'Expenses' },
    ],
  },
];

const Reports = ({ db, userId, isAuthReady, appId }) => {
  // UI state
  const [reportType, setReportType] = useState('partywise-sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [partyList, setPartyList] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const [modalBills, setModalBills] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCompany, setInvoiceCompany] = useState({});
  const [invoiceParty, setInvoiceParty] = useState({});
  const [invoiceBank, setInvoiceBank] = useState({});
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Add state for itemwise sales and purchase arrays
  const [itemwiseSalesArr, setItemwiseSalesArr] = useState([]);
  const [itemwisePurchaseArr, setItemwisePurchaseArr] = useState([]);
  
  // Add state for all collections to get available financial years
  const [salesBills, setSalesBills] = useState([]);
  const [challans, setChallans] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // Add state for selectedBillSummary and showBillSummaryModal
  const [selectedBillSummary, setSelectedBillSummary] = useState(null);
  const [showBillSummaryModal, setShowBillSummaryModal] = useState(false);

  const [companyDetails, setCompanyDetails] = useState({});

  // Pagination hooks for main tables
  const partywiseSalesPagination = useTablePagination(data, 10);
  const partywisePurchasePagination = useTablePagination(data, 10);
  const outstandingPagination = useTablePagination(data, 10);

  // Add state for filter controls
  const [pendingDateFrom, setPendingDateFrom] = useState('');
  const [pendingDateTo, setPendingDateTo] = useState('');
  const [selectedFY, setSelectedFY] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  // Add at the top of the Reports component, after useState imports:
  const [partywiseSortConfig, setPartywiseSortConfig] = useState({ key: '', direction: 'asc' });
  const [sortConfigs, setSortConfigs] = useState({});

  // Add export format state
  const [exportFormat, setExportFormat] = useState('csv');

  // Time filter state variables (updated to match Payments.js)
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'custom', 'financial'
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('');
  const [selectedSubFilter, setSelectedSubFilter] = useState(''); // 'month' or 'quarter'

  // Add state for expenses
  const [expenses, setExpenses] = useState([]);
  const [expenseHead, setExpenseHead] = useState('');

  // Add state for payments
  const [payments, setPayments] = useState([]);

  // Helper: returns sort function for each table type
  const getSortFns = (table) => {
    switch (table) {
      case 'partywise-sales':
      case 'partywise-purchase':
        return {
          partyName: (a, b) => (a.partyName || '').localeCompare(b.partyName || ''),
          total: (a, b) => (a.total || 0) - (b.total || 0),
          totalPaid: (a, b) => (a.totalPaid || 0) - (b.totalPaid || 0),
          outstanding: (a, b) => (a.outstanding || 0) - (b.outstanding || 0),
        };
      case 'challan':
      case 'quotation':
      case 'purchase-orders':
        return {
          number: (a, b) => {
            const getNum = val => parseInt((val.challanNumber || val.quotationNumber || val.orderNumber || val.id || '').replace(/\D/g, '')) || 0;
            return getNum(a) - getNum(b);
          },
          date: (a, b) => new Date(a.date || a.challanDate || a.quotationDate || a.orderDate || '') - new Date(b.date || b.challanDate || b.quotationDate || b.orderDate || ''),
          partyName: (a, b) => (a.partyName || a.party || '').localeCompare(b.partyName || b.party || ''),
          amount: (a, b) => (a.amount || 0) - (b.amount || 0),
        };
      case 'itemwise-report':
        return {
          itemName: (a, b) => (a.itemName || '').localeCompare(b.itemName || ''),
          hsn: (a, b) => (parseInt(a.hsn) || 0) - (parseInt(b.hsn) || 0),
          totalSales: (a, b) => (a.totalSales || 0) - (b.totalSales || 0),
          totalPurchases: (a, b) => (a.totalPurchases || 0) - (b.totalPurchases || 0),
        };
      case 'stock':
        return {
          itemName: (a, b) => (a.itemName || '').localeCompare(b.itemName || ''),
          hsn: (a, b) => (parseInt(a.hsn) || 0) - (parseInt(b.hsn) || 0),
          openingStock: (a, b) => (a.openingStock || 0) - (b.openingStock || 0),
          purchased: (a, b) => (a.purchased || 0) - (b.purchased || 0),
          sold: (a, b) => (a.sold || 0) - (b.sold || 0),
          stock: (a, b) => (a.stock || 0) - (b.stock || 0),
        };
      default:
        return {};
    }
  };

  const handleTableSort = (table, key) => {
    const sortFns = getSortFns(table);
    if (!sortFns[key]) return;
    setSortConfigs(prev => {
      const prevConfig = prev[table] || { key: '', direction: 'asc' };
      return {
        ...prev,
        [table]: {
          key,
          direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc',
        },
      };
    });
  };

  const navigate = useNavigate();

  // Fetch parties and items for filters
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const unsubParties = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/parties`), (snap) => {
        const arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        setPartyList(arr);
      });
      const unsubItems = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/items`), (snap) => {
        const arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        setItemList(arr);
      });
      return () => { unsubParties(); unsubItems(); };
    }
  }, [db, userId, isAuthReady, appId]);

  // Fetch company details
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
    getDoc(companyDocRef).then(docSnap => {
      if (docSnap.exists()) setCompanyDetails(docSnap.data());
    });
  }, [db, userId, isAuthReady, appId]);

  // Fetch all collections for financial year calculation
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
    const challansRef = collection(db, `artifacts/${appId}/users/${userId}/challans`);
    const quotationsRef = collection(db, `artifacts/${appId}/users/${userId}/quotations`);
    const purchaseBillsRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
    const purchaseOrdersRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseOrders`);
    
    const unsubSales = onSnapshot(salesRef, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setSalesBills(arr);
    });
    
    const unsubChallans = onSnapshot(challansRef, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setChallans(arr);
    });
    
    const unsubQuotations = onSnapshot(quotationsRef, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setQuotations(arr);
    });
    
    const unsubPurchaseBills = onSnapshot(purchaseBillsRef, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setPurchaseBills(arr);
    });
    
    const unsubPurchaseOrders = onSnapshot(purchaseOrdersRef, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setPurchaseOrders(arr);
    });
    
    return () => {
      unsubSales();
      unsubChallans();
      unsubQuotations();
      unsubPurchaseBills();
      unsubPurchaseOrders();
    };
  }, [db, userId, isAuthReady, appId]);

  // Fetch report data (Partywise Sales as template, add Challan, Quotation, Purchase Orders)
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    setLoading(true); setError('');
    if (reportType === 'partywise-sales') {
      // Real-time fetch all sales bills and payments
      const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
      const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
      
      const unsubSales = onSnapshot(salesRef, (snap) => {
        let arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        // Filter by date
        if (dateFrom) arr = arr.filter(bill => bill.invoiceDate >= dateFrom);
        if (dateTo) arr = arr.filter(bill => bill.invoiceDate <= dateTo);
        // Filter by party
        if (selectedParty) arr = arr.filter(bill => bill.party === selectedParty || bill.customerId === selectedParty);
        
        // Now fetch payments to calculate outstanding
        const unsubPayments = onSnapshot(paymentsRef, (paySnap) => {
          const payments = [];
          paySnap.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
          
          // Group by party and calculate outstanding using new allocation logic
        const grouped = {};
        arr.forEach(bill => {
          const partyId = bill.party || bill.customerId || 'Unknown';
          if (!grouped[partyId]) grouped[partyId] = { total: 0, bills: [], partyId };
            const totalAmount = parseFloat(bill.totalAmount || bill.amount || 0);
            grouped[partyId].total += totalAmount;
            
            // Calculate paid amount using allocations
            const billPayments = payments.filter(p =>
              p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
            );
            const totalPaid = billPayments.reduce((sum, payment) => {
              const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
              return sum + (allocation ? allocation.allocatedAmount : 0);
            }, 0);
            
            // Add payment info to bill
            bill.totalPaid = totalPaid;
            bill.outstanding = totalAmount - totalPaid;
          grouped[partyId].bills.push(bill);
        });
          
        // Map to array with party info
        const result = Object.values(grouped).map(g => {
          const party = partyList.find(p => p.id === g.partyId);
          return {
            partyName: party?.firmName || 'Unknown',
            partyType: party?.partyType || '',
            gstin: party?.gstin || '',
            total: g.total,
            billCount: g.bills.length,
            bills: g.bills,
          };
        });
        setData(result);
        setLoading(false);
        });
        
        return () => unsubPayments();
      }, err => { setError('Error fetching sales bills'); setLoading(false); });
      
      return () => unsubSales();
    }
    if (reportType === 'challan') {
      const challanRef = collection(db, `artifacts/${appId}/users/${userId}/challans`);
      const unsub = onSnapshot(challanRef, (snap) => {
        let arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        setData(arr);
        setLoading(false);
      }, err => { setError('Error fetching challans'); setLoading(false); });
      return () => unsub();
    }
    if (reportType === 'quotation') {
      const quotationRef = collection(db, `artifacts/${appId}/users/${userId}/quotations`);
      const unsub = onSnapshot(quotationRef, (snap) => {
        let arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        setData(arr);
        setLoading(false);
      }, err => { setError('Error fetching quotations'); setLoading(false); });
      return () => unsub();
    }
    if (reportType === 'purchase-orders') {
      const poRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseOrders`);
      const unsub = onSnapshot(poRef, (snap) => {
        let arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        setData(arr);
        setLoading(false);
      }, err => { setError('Error fetching purchase orders'); setLoading(false); });
      return () => unsub();
    }
    if (reportType === 'stock') {
      // Fetch all sales and purchase bills for inventory
      const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
      const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
      const unsubSales = onSnapshot(salesRef, (snap) => {
        let salesArr = [];
        snap.forEach(doc => salesArr.push({ id: doc.id, ...doc.data() }));
        if (dateFrom) salesArr = salesArr.filter(bill => bill.invoiceDate >= dateFrom);
        if (dateTo) salesArr = salesArr.filter(bill => bill.invoiceDate <= dateTo);
        setItemwiseSalesArr(salesArr);
        onSnapshot(purchaseRef, (psnap) => {
          let purchaseArr = [];
          psnap.forEach(doc => purchaseArr.push({ id: doc.id, ...doc.data() }));
          if (dateFrom) purchaseArr = purchaseArr.filter(bill => bill.billDate >= dateFrom);
          if (dateTo) purchaseArr = purchaseArr.filter(bill => bill.billDate <= dateTo);
          setItemwisePurchaseArr(purchaseArr);
          setLoading(false);
        });
      });
      return () => unsubSales();
    }
    
    // GST Summary reports need sales and purchase data
    if (reportType === 'gst-summary-regular' || reportType === 'gst-summary-composition') {
      setLoading(true); setError('');
      const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
      const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
      const unsubSales = onSnapshot(salesRef, (snap) => {
        let salesArr = [];
        snap.forEach(doc => salesArr.push({ id: doc.id, ...doc.data() }));
        if (dateFrom) salesArr = salesArr.filter(bill => bill.invoiceDate >= dateFrom);
        if (dateTo) salesArr = salesArr.filter(bill => bill.invoiceDate <= dateTo);
        setItemwiseSalesArr(salesArr);
        onSnapshot(purchaseRef, (psnap) => {
          let purchaseArr = [];
          psnap.forEach(doc => purchaseArr.push({ id: doc.id, ...doc.data() }));
          if (dateFrom) purchaseArr = purchaseArr.filter(bill => bill.billDate >= dateFrom);
          if (dateTo) purchaseArr = purchaseArr.filter(bill => bill.billDate <= dateTo);
          setItemwisePurchaseArr(purchaseArr);
          setLoading(false);
        });
      });
      return () => unsubSales();
    }
    
    // TODO: Add other report types here
  }, [db, userId, isAuthReady, appId, reportType, dateFrom, dateTo, selectedParty, partyList]);

  // Add Customer Ledger (Khata) report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'customer-ledger') return;
    setLoading(true); setError('');
    if (!selectedParty) { setData([]); setLoading(false); return; }
    // Fetch all sales bills and payments for the selected customer
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
    let bills = [];
    let payments = [];
    const unsubSales = onSnapshot(salesRef, (snap) => {
      bills = [];
      snap.forEach(doc => {
        const bill = { id: doc.id, ...doc.data() };
        if (bill.party === selectedParty || bill.customerId === selectedParty) {
          if (!dateFrom || bill.invoiceDate >= dateFrom) {
            if (!dateTo || bill.invoiceDate <= dateTo) {
              bills.push({
                type: 'bill',
                date: bill.invoiceDate,
                amount: parseFloat(bill.totalAmount || bill.amount || 0),
                description: `Bill #${bill.invoiceNumber || bill.number || bill.id}`,
                ref: bill,
              });
            }
          }
        }
      });
      // Now fetch payments
      onSnapshot(paymentsRef, (paySnap) => {
        payments = [];
        paySnap.forEach(doc => {
          const pay = { id: doc.id, ...doc.data() };
          if (pay.partyId === selectedParty || pay.party === selectedParty) {
            const paymentDate = pay.date || pay.paymentDate;
            if (!dateFrom || paymentDate >= dateFrom) {
              if (!dateTo || paymentDate <= dateTo) {
                // Calculate total allocated amount for this payment
                const totalAllocated = pay.allocations ? pay.allocations.reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0) : 0;
                payments.push({
                  type: 'payment',
                  date: paymentDate,
                  amount: totalAllocated,
                  description: pay.notes ? `Payment (${pay.notes})` : 'Payment',
                  ref: pay,
                });
              }
            }
          }
        });
        // Merge and sort
        const all = [...bills, ...payments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        // Calculate running balance
        let balance = 0;
        const ledger = all.map(entry => {
          if (entry.type === 'bill') balance += entry.amount;
          else if (entry.type === 'payment') balance -= entry.amount;
          return { ...entry, balance: balance };
        });
        setData(ledger);
        setLoading(false);
      });
    }, err => { setError('Error fetching ledger'); setLoading(false); });
    return () => unsubSales();
  }, [db, userId, isAuthReady, appId, reportType, selectedParty, timeFilter, customDateFrom, customDateTo, selectedFinancialYear, selectedSubFilter, selectedMonth, selectedQuarter]);

  // Supplier Ledger (Khata) report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'supplier-ledger') return;
    setLoading(true); setError('');
    if (!selectedParty) { setData([]); setLoading(false); return; }
    // Fetch all purchase bills and payments for the selected supplier
    const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/purchasePayments`);
    let bills = [];
    let payments = [];
    const unsubPurchase = onSnapshot(purchaseRef, (snap) => {
      bills = [];
      snap.forEach(doc => {
        const bill = { id: doc.id, ...doc.data() };
        if (bill.party === selectedParty) {
          const { effectiveDateFrom, effectiveDateTo } = getEffectiveDateRange();
          if (!effectiveDateFrom || bill.billDate >= effectiveDateFrom) {
            if (!effectiveDateTo || bill.billDate <= effectiveDateTo) {
              bills.push({
                type: 'bill',
                date: bill.billDate,
                amount: parseFloat(bill.amount || 0),
                description: `Bill #${bill.number || bill.id}`,
                ref: bill,
              });
            }
          }
        }
      });
      // Now fetch payments
      onSnapshot(paymentsRef, (paySnap) => {
        payments = [];
        paySnap.forEach(doc => {
          const pay = { id: doc.id, ...doc.data() };
          if (pay.partyId === selectedParty || pay.party === selectedParty) {
            const paymentDate = pay.date || pay.paymentDate;
            if (!dateFrom || paymentDate >= dateFrom) {
              if (!dateTo || paymentDate <= dateTo) {
                // Calculate total allocated amount for this payment
                const totalAllocated = pay.allocations ? pay.allocations.reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0) : 0;
                payments.push({
                  type: 'payment',
                  date: paymentDate,
                  amount: totalAllocated,
                  description: pay.notes ? `Payment (${pay.notes})` : 'Payment',
                  ref: pay,
                });
              }
            }
          }
        });
        // Merge and sort
        const all = [...bills, ...payments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        // Calculate running balance
        let balance = 0;
        const ledger = all.map(entry => {
          if (entry.type === 'bill') balance += entry.amount;
          else if (entry.type === 'payment') balance -= entry.amount;
          return { ...entry, balance: balance };
        });
        setData(ledger);
        setLoading(false);
      });
    }, err => { setError('Error fetching supplier ledger'); setLoading(false); });
    return () => unsubPurchase();
  }, [db, userId, isAuthReady, appId, reportType, selectedParty, timeFilter, customDateFrom, customDateTo, selectedFinancialYear, selectedSubFilter, selectedMonth, selectedQuarter]);

  // Outstanding Report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'outstanding') return;
    setLoading(true); setError('');
    // Fetch all parties, bills, and payments
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
    const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
    
    onSnapshot(salesRef, (salesSnap) => {
      const salesBills = [];
      salesSnap.forEach(doc => {
        const bill = { id: doc.id, ...doc.data() };
        salesBills.push(bill);
      });
      
      onSnapshot(purchaseRef, (purchaseSnap) => {
        const purchaseBills = [];
        purchaseSnap.forEach(doc => {
          const bill = { id: doc.id, ...doc.data() };
          purchaseBills.push(bill);
        });
        
      onSnapshot(paymentsRef, (paySnap) => {
        const payments = [];
        paySnap.forEach(doc => {
          const pay = { id: doc.id, ...doc.data() };
          payments.push(pay);
        });
          
          // Calculate outstanding for each party using new allocation logic
        const partyMap = {};
          
          // Process sales bills (receivables)
          salesBills.forEach(bill => {
          const pid = bill.party || bill.customerId;
            if (!partyMap[pid]) partyMap[pid] = { total: 0, paid: 0, outstanding: 0 };
            const totalAmount = parseFloat(bill.totalAmount || bill.amount || 0);
            partyMap[pid].total += totalAmount;
            
            // Calculate paid amount using allocations
            const billPayments = payments.filter(p =>
              p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
            );
            const totalPaid = billPayments.reduce((sum, payment) => {
              const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
              return sum + (allocation ? allocation.allocatedAmount : 0);
            }, 0);
            partyMap[pid].paid += totalPaid;
          });
          
          // Process purchase bills (payables)
          purchaseBills.forEach(bill => {
            const pid = bill.party || bill.supplierId;
            if (!partyMap[pid]) partyMap[pid] = { total: 0, paid: 0, outstanding: 0 };
            const totalAmount = parseFloat(bill.totalAmount || bill.amount || 0);
            partyMap[pid].total += totalAmount;
            
            // Calculate paid amount using allocations
            const billPayments = payments.filter(p =>
              p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
            );
            const totalPaid = billPayments.reduce((sum, payment) => {
              const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
              return sum + (allocation ? allocation.allocatedAmount : 0);
            }, 0);
            partyMap[pid].paid += totalPaid;
          });
          
          // Calculate outstanding for each party
          Object.keys(partyMap).forEach(pid => {
            partyMap[pid].outstanding = partyMap[pid].total - partyMap[pid].paid;
        });
          
        const result = Object.entries(partyMap).map(([pid, val]) => {
          const party = partyList.find(p => p.id === pid);
          return {
            partyName: party?.firmName || pid,
            total: val.total,
            paid: val.paid,
              outstanding: val.outstanding,
          };
        }).filter(row => row.outstanding !== 0);
          
        setData(result);
        setLoading(false);
        });
      });
    }, err => { setError('Error fetching outstanding'); setLoading(false); });
  }, [db, userId, isAuthReady, appId, reportType, partyList]);

  // Bill Register logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'bill-register') return;
    setLoading(true); setError('');
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
    onSnapshot(salesRef, (snap) => {
      let arr = [];
      snap.forEach(doc => {
        const bill = { id: doc.id, ...doc.data() };
        const { effectiveDateFrom, effectiveDateTo } = getEffectiveDateRange();
        if ((!effectiveDateFrom || bill.invoiceDate >= effectiveDateFrom) && (!effectiveDateTo || bill.invoiceDate <= effectiveDateTo)) {
          arr.push(bill);
        }
      });
      setData(arr);
      setLoading(false);
    }, err => { setError('Error fetching bill register'); setLoading(false); });
  }, [db, userId, isAuthReady, appId, reportType, timeFilter, customDateFrom, customDateTo, selectedFinancialYear, selectedSubFilter, selectedMonth, selectedQuarter]);

  // Add Partywise Purchase report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'partywise-purchase') return;
    setLoading(true); setError('');
    const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
    
    const unsubPurchase = onSnapshot(purchaseRef, (snap) => {
      let arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      // Filter by date
      if (dateFrom) arr = arr.filter(bill => bill.billDate >= dateFrom);
      if (dateTo) arr = arr.filter(bill => bill.billDate <= dateTo);
      // Filter by party
      if (selectedParty) arr = arr.filter(bill => bill.party === selectedParty);
      
      // Now fetch payments to calculate outstanding
      const unsubPayments = onSnapshot(paymentsRef, (paySnap) => {
        const payments = [];
        paySnap.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
        
        // Group by party and calculate outstanding using new allocation logic
      const grouped = {};
      arr.forEach(bill => {
        const partyId = bill.party || 'Unknown';
        if (!grouped[partyId]) grouped[partyId] = { total: 0, bills: [], partyId };
          const totalAmount = parseFloat(bill.totalAmount || bill.amount || 0);
          grouped[partyId].total += totalAmount;
          
          // Calculate paid amount using allocations
          const billPayments = payments.filter(p =>
            p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
          );
          const totalPaid = billPayments.reduce((sum, payment) => {
            const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
            return sum + (allocation ? allocation.allocatedAmount : 0);
          }, 0);
          
          // Add payment info to bill
          bill.totalPaid = totalPaid;
          bill.outstanding = totalAmount - totalPaid;
        grouped[partyId].bills.push(bill);
      });
        
        // Map to array with party info
        const result = Object.values(grouped).map(g => {
          const party = partyList.find(p => p.id === g.partyId);
          return {
            partyName: party?.firmName || 'Unknown',
            partyType: party?.partyType || '',
            gstin: party?.gstin || '',
            total: g.total,
            billCount: g.bills.length,
            bills: g.bills,
          };
        });
        setData(result);
        setLoading(false);
      });
      
      return () => unsubPayments();
    }, err => { setError('Error fetching purchase bills'); setLoading(false); });
    
    return () => unsubPurchase();
  }, [db, userId, isAuthReady, appId, reportType, dateFrom, dateTo, selectedParty, partyList]);

  // Utility to get current financial year date range
  function getCurrentFinancialYearRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let fyStart, fyEnd;
    if (month >= 4) {
      fyStart = new Date(year, 3, 1); // April 1
      fyEnd = new Date(year + 1, 2, 31); // March 31 next year
    } else {
      fyStart = new Date(year - 1, 3, 1);
      fyEnd = new Date(year, 2, 31);
    }
    return {
      from: fyStart.toISOString().split('T')[0],
      to: fyEnd.toISOString().split('T')[0],
    };
  }

  // Helper function to get financial year date range (from Payments.js)
  const getFinancialYearRange = (financialYear) => {
    const [startYear] = financialYear.split('-');
    // Handle both formats: "2025-26" and "25-26"
    const yearNum = startYear.length === 4 ? parseInt(startYear) : parseInt('20' + startYear);
    const startDate = new Date(yearNum, 3, 1); // April 1st (month 3 = April)
    const endDate = new Date(yearNum + 1, 2, 31); // March 31st (month 2 = March)
    return { startDate, endDate };
  };

  // Helper function to get month date range (from Payments.js)
  const getMonthRange = (monthYear) => {
    const [month, year] = monthYear.split('-');
    const yearNum = parseInt('20' + year); // Convert 25 to 2025
    const startDate = new Date(yearNum, parseInt(month) - 1, 1);
    const endDate = new Date(yearNum, parseInt(month), 0);
    return { startDate, endDate };
  };

  // Helper function to get quarter date range (from Payments.js)
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

  // Helper function to get current financial year (from Payments.js)
  const getCurrentFinancialYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11
    return month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
  };

  // Helper function to get quarters for current financial year only (from Payments.js)
  const getCurrentFinancialYearQuarters = () => {
    const currentFY = getCurrentFinancialYear();
    const [startYear] = currentFY.split('-');
    const yearNum = startYear.length === 4 ? parseInt(startYear) : parseInt('20' + startYear);
    
    return [
      { value: `Q1-${yearNum.toString().slice(-2)}`, label: `Q1 (Apr-Jun) ${yearNum}` },
      { value: `Q2-${yearNum.toString().slice(-2)}`, label: `Q2 (Jul-Sep) ${yearNum}` },
      { value: `Q3-${yearNum.toString().slice(-2)}`, label: `Q3 (Oct-Dec) ${yearNum}` },
      { value: `Q4-${(yearNum + 1).toString().slice(-2)}`, label: `Q4 (Jan-Mar) ${yearNum + 1}` }
    ];
  };

  // Helper function to get effective date range based on time filter (from Payments.js)
  const getEffectiveDateRange = () => {
    let effectiveDateFrom = '';
    let effectiveDateTo = '';

    if (timeFilter === 'custom' && customDateFrom && customDateTo) {
      effectiveDateFrom = customDateFrom;
      effectiveDateTo = customDateTo;
    } else if (timeFilter === 'financial' && selectedFinancialYear) {
      // If sub-filter is selected, use that specific range
      if (selectedSubFilter === 'month' && selectedMonth) {
        const monthRange = getMonthRange(selectedMonth);
        effectiveDateFrom = monthRange.startDate.toISOString().split('T')[0];
        effectiveDateTo = monthRange.endDate.toISOString().split('T')[0];
      } else if (selectedSubFilter === 'quarter' && selectedQuarter) {
        const quarterRange = getQuarterRange(selectedQuarter);
        effectiveDateFrom = quarterRange.startDate.toISOString().split('T')[0];
        effectiveDateTo = quarterRange.endDate.toISOString().split('T')[0];
      } else {
        // Use full financial year range
        const yearRange = getFinancialYearRange(selectedFinancialYear);
        effectiveDateFrom = yearRange.startDate.toISOString().split('T')[0];
        effectiveDateTo = yearRange.endDate.toISOString().split('T')[0];
      }
    }

    return { effectiveDateFrom, effectiveDateTo };
  };
  // Set default date range to current FY on mount
  useEffect(() => {
    const { from, to } = getCurrentFinancialYearRange();
    if (!dateFrom) setDateFrom(from);
    if (!dateTo) setDateTo(to);
  }, []);

  // Set default financial year when data is loaded
  useEffect(() => {
    const availableYears = getAvailableFinancialYears();
    console.log('Available Financial Years in Reports:', availableYears);
    console.log('Current Data Counts:', {
      salesBills: salesBills.length,
      challans: challans.length,
      quotations: quotations.length,
      purchaseBills: purchaseBills.length,
      purchaseOrders: purchaseOrders.length,
      itemwiseSalesArr: itemwiseSalesArr.length,
      itemwisePurchaseArr: itemwisePurchaseArr.length,
      data: data.length
    });
    
    if (availableYears.length > 0 && !selectedFinancialYear) {
      // Set to current financial year if available, otherwise use the first available year
      const currentFY = getCurrentFinancialYear();
      const defaultYear = availableYears.includes(currentFY) ? currentFY : availableYears[0];
      console.log('Setting default financial year in Reports:', { currentFY, defaultYear, availableYears });
      setSelectedFinancialYear(defaultYear);
    }
  }, [salesBills, challans, quotations, purchaseBills, purchaseOrders, itemwiseSalesArr, itemwisePurchaseArr, data, selectedFinancialYear]);

  // Itemwise Report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'itemwise-report') return;
    setLoading(true); setError('');
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
    const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
    const stockRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
    // Fetch sales
    onSnapshot(salesRef, (snap) => {
      let salesArr = [];
      snap.forEach(doc => salesArr.push({ id: doc.id, ...doc.data() }));
      if (dateFrom) salesArr = salesArr.filter(bill => bill.invoiceDate >= dateFrom);
      if (dateTo) salesArr = salesArr.filter(bill => bill.invoiceDate <= dateTo);
      // Fetch purchases
      onSnapshot(purchaseRef, (psnap) => {
        let purchaseArr = [];
        psnap.forEach(doc => purchaseArr.push({ id: doc.id, ...doc.data() }));
        if (dateFrom) purchaseArr = purchaseArr.filter(bill => bill.billDate >= dateFrom);
        if (dateTo) purchaseArr = purchaseArr.filter(bill => bill.billDate <= dateTo);
        // Fetch stock
        onSnapshot(stockRef, (ssnap) => {
          const stockMap = {};
          ssnap.forEach(doc => { stockMap[doc.id] = doc.data().itemQuantity || 0; });
          // Group by item
          const grouped = {};
          // Sales: Quantity Sold
          salesArr.forEach(bill => {
            (bill.rows || []).forEach(row => {
              if (!selectedItem || row.item === selectedItem) {
                const itemId = row.item || 'Unknown';
                if (!grouped[itemId]) grouped[itemId] = { sold: 0, purchased: 0, stock: 0, itemId, hsn: row.hsn || '', salesBills: 0, purchaseBills: 0 };
                grouped[itemId].sold += parseFloat(row.qty || 0);
                grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
                grouped[itemId].salesBills += 1;
              }
            });
          });
          // Purchases: Quantity Purchased
          purchaseArr.forEach(bill => {
            (bill.rows || []).forEach(row => {
              if (!selectedItem || row.item === selectedItem) {
                const itemId = row.item || 'Unknown';
                if (!grouped[itemId]) grouped[itemId] = { sold: 0, purchased: 0, stock: 0, itemId, hsn: row.hsn || '', salesBills: 0, purchaseBills: 0 };
                grouped[itemId].purchased += parseFloat(row.qty || 0);
                grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
                grouped[itemId].purchaseBills += 1;
              }
            });
          });
          // Stock: Quantity in Hand
          Object.keys(grouped).forEach(itemId => {
            grouped[itemId].stock = stockMap[itemId] || 0;
          });
          // Map to array with item info
          const result = Object.values(grouped).map(g => {
            const item = itemList.find(i => i.id === g.itemId);
            // Use openingStock from itemList (item master data)
            const openingStock = typeof item?.openingStock === 'number' ? item.openingStock : parseFloat(item?.openingStock) || 0;
            // Purchases and sales up to dateTo (for running stock)
            const allPurchases = purchaseArr
              .filter(bill => (!dateTo || (bill.billDate <= dateTo)))
              .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
              .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
            const allSales = salesArr
              .filter(bill => (!dateTo || (bill.invoiceDate <= dateTo)))
              .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
              .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
            // Purchases in period (for total qty)
            const periodPurchases = purchaseArr
              .filter(bill => (!dateFrom || bill.billDate >= dateFrom) && (!dateTo || bill.billDate <= dateTo))
              .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
              .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
            return {
              itemId: g.itemId,
              itemName: item?.itemName || g.itemId,
              hsn: item?.hsnCode || g.hsn,
              openingStock: openingStock,
              purchased: g.purchased,
              totalQty: openingStock + periodPurchases,
              sold: g.sold,
              stock: openingStock + allPurchases - allSales,
              salesBills: g.salesBills,
              purchaseBills: g.purchaseBills,
            };
          });
          setData(result);
          setLoading(false);
          // Add state for itemwise sales and purchase arrays
          setItemwiseSalesArr(salesArr);
          setItemwisePurchaseArr(purchaseArr);
        });
      });
    }, err => { setError('Error fetching itemwise report'); setLoading(false); });
  }, [db, userId, isAuthReady, appId, reportType, dateFrom, dateTo, selectedItem, itemList]);

  // Helper functions to calculate totals for different report types
  const calculatePartywiseTotals = (data) => {
    const totals = data.reduce((acc, row) => {
      const totalPaid = (row.bills || []).reduce((sum, bill) => sum + (bill.totalPaid || 0), 0);
      const outstanding = (row.total || 0) - totalPaid;
      return {
        total: acc.total + (row.total || 0),
        totalPaid: acc.totalPaid + totalPaid,
        outstanding: acc.outstanding + outstanding,
        billCount: acc.billCount + (row.billCount || 0)
      };
    }, { total: 0, totalPaid: 0, outstanding: 0, billCount: 0 });
    
    return {
      ...totals,
      partyCount: data.length
    };
  };

  const calculateItemwiseTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      totalSales: acc.totalSales + (row.totalSales || 0),
      totalPurchases: acc.totalPurchases + (row.totalPurchases || 0),
      profitLoss: acc.profitLoss + (row.profitLoss || 0),
      salesBills: acc.salesBills + (row.salesBills || 0),
      purchaseBills: acc.purchaseBills + (row.purchaseBills || 0)
    }), { totalSales: 0, totalPurchases: 0, profitLoss: 0, salesBills: 0, purchaseBills: 0 });
    
    return {
      ...totals,
      itemCount: data.length
    };
  };

  const calculateStockTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      openingStock: acc.openingStock + (row.openingStock || 0),
      purchased: acc.purchased + (row.purchased || 0),
      totalQty: acc.totalQty + (row.totalQty || 0),
      sold: acc.sold + (row.sold || 0),
      stock: acc.stock + (row.stock || 0),
      salesBills: acc.salesBills + (row.salesBills || 0),
      purchaseBills: acc.purchaseBills + (row.purchaseBills || 0)
    }), { openingStock: 0, purchased: 0, totalQty: 0, sold: 0, stock: 0, salesBills: 0, purchaseBills: 0 });
    
    return {
      ...totals,
      itemCount: data.length
    };
  };

  const calculateOutstandingTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      total: acc.total + (row.total || 0),
      paid: acc.paid + (row.paid || 0),
      outstanding: acc.outstanding + (row.outstanding || 0)
    }), { total: 0, paid: 0, outstanding: 0 });
    
    return {
      ...totals,
      partyCount: data.length
    };
  };

  const calculateBillRegisterTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      totalAmount: acc.totalAmount + (row.totalAmount || 0)
    }), { totalAmount: 0 });
    
    return {
      ...totals,
      billCount: data.length
    };
  };

  const calculateChallanQuotationTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      amount: acc.amount + (row.amount || 0)
    }), { amount: 0 });
    
    return {
      ...totals,
      documentCount: data.length
    };
  };

  const calculateLedgerTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      billAmount: acc.billAmount + (row.billAmount || 0),
      payment: acc.payment + (row.payment || 0)
    }), { billAmount: 0, payment: 0 });
    
    // Get the final balance from the last row
    const finalBalance = data.length > 0 ? data[data.length - 1]?.balance || 0 : 0;
    
    return {
      ...totals,
      finalBalance,
      entryCount: data.length
    };
  };

  const calculateGSTTotals = (data) => {
    const totals = data.reduce((acc, row) => ({
      taxable: acc.taxable + (row.taxable || 0),
      cgst: acc.cgst + (row.cgst || 0),
      sgst: acc.sgst + (row.sgst || 0),
      igst: acc.igst + (row.igst || 0),
      net: acc.net + (row.net || 0)
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, net: 0 });
    
    return {
      ...totals,
      documentCount: data.length
    };
  };

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
  const arrayToPDF = async (arr, columns, filename, title = 'Report') => {
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
    // Table
    doc.autoTable({
      head: [columns.map(col => col.label)],
      body: arr.map(row => columns.map(col => row[col.key] ?? '')),
      startY: detailsY + 12,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      didParseCell: function(data) {
        // Apply custom styling to total rows
        if (data.row.index < arr.length) {
          const row = arr[data.row.index];
          const isTotalRow = row.partyName?.includes('TOTAL') || 
                            row.itemName?.includes('TOTAL') || 
                            row.invoiceNumber?.includes('TOTAL') ||
                            row.number?.includes('TOTAL') ||
                            row.date?.includes('TOTAL');
          
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

  // Utility: Build GST Summary tables for rendering and export
  function getGSTSummaryTables(itemwiseSalesArr, itemwisePurchaseArr, itemList, partyList) {
    // 1. Sales/Outward GST Table
    const salesRows = [];
    itemwiseSalesArr.forEach(bill => {
      const partyName = partyList.find(p => p.id === bill.party)?.firmName || bill.party || 'Unknown';
      const gstMap = {};
      (bill.rows || []).forEach(row => {
        const gstPercent = (parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)) || 0;
        const key = gstPercent;
        if (!gstMap[key]) gstMap[key] = { gstPercent, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        gstMap[key].taxable += parseFloat(row.amount) || 0;
        gstMap[key].cgst += ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0)) / 100;
        gstMap[key].sgst += ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0)) / 100;
        gstMap[key].igst += ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0)) / 100;
      });
      const gstArr = Object.values(gstMap);
      gstArr.forEach((g, idx) => {
        salesRows.push({
          invoiceNumber: idx === 0 ? (bill.invoiceNumber || bill.number || bill.id) : '',
          bill: idx === 0 ? bill : null,
          partyName: idx === 0 ? partyName : '',
          gstPercent: g.gstPercent,
          taxable: g.taxable,
          cgst: g.cgst,
          sgst: g.sgst,
          igst: g.igst,
          net: g.cgst + g.sgst + g.igst,
          showButton: idx === 0,
        });
      });
    });
    // 2. Purchase/Inward GST Table
    const purchaseRows = [];
    itemwisePurchaseArr.forEach(bill => {
      const partyName = partyList.find(p => p.id === bill.party)?.firmName || bill.party || 'Unknown';
      const gstMap = {};
      (bill.rows || []).forEach(row => {
        const gstPercent = (parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)) || 0;
        const key = gstPercent;
        if (!gstMap[key]) gstMap[key] = { gstPercent, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        gstMap[key].taxable += parseFloat(row.amount) || 0;
        gstMap[key].cgst += ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0)) / 100;
        gstMap[key].sgst += ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0)) / 100;
        gstMap[key].igst += ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0)) / 100;
      });
      const gstArr = Object.values(gstMap);
      gstArr.forEach((g, idx) => {
        purchaseRows.push({
          invoiceNumber: idx === 0 ? (bill.invoiceNumber || bill.number || bill.id) : '',
          bill: idx === 0 ? bill : null,
          partyName: idx === 0 ? partyName : '',
          gstPercent: g.gstPercent,
          taxable: g.taxable,
          cgst: g.cgst,
          sgst: g.sgst,
          igst: g.igst,
          net: g.cgst + g.sgst + g.igst,
          showButton: idx === 0,
        });
      });
    });
    // 3. Item-wise GST summary
    const itemSummaryMap = {};
    itemList.forEach(item => {
      itemSummaryMap[item.id] = {
        itemName: item.itemName || '',
        hsn: item.hsnCode || item.hsn || 'N/A',
        gstPercent: null,
        taxableOut: 0, outputCGST: 0, outputSGST: 0, outputIGST: 0,
        taxableIn: 0, inputCGST: 0, inputSGST: 0, inputIGST: 0
      };
    });
    // Sales (Output Tax)
    itemwiseSalesArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item;
        if (!itemSummaryMap[itemId]) return;
        const gstPercent = (parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)) || 0;
        itemSummaryMap[itemId].gstPercent = gstPercent;
        itemSummaryMap[itemId].taxableOut += parseFloat(row.amount) || 0;
        itemSummaryMap[itemId].outputCGST += ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0)) / 100;
        itemSummaryMap[itemId].outputSGST += ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0)) / 100;
        itemSummaryMap[itemId].outputIGST += ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0)) / 100;
      });
    });
    // Purchases (Input Tax)
    itemwisePurchaseArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item;
        if (!itemSummaryMap[itemId]) return;
        const gstPercent = (parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)) || 0;
        itemSummaryMap[itemId].gstPercent = gstPercent;
        itemSummaryMap[itemId].taxableIn += parseFloat(row.amount) || 0;
        itemSummaryMap[itemId].inputCGST += ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0)) / 100;
        itemSummaryMap[itemId].inputSGST += ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0)) / 100;
        itemSummaryMap[itemId].inputIGST += ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0)) / 100;
      });
    });
    const itemSummaryArr = Object.values(itemSummaryMap).filter(row => row.taxableOut > 0 || row.taxableIn > 0);
    return { salesRows, purchaseRows, itemSummaryArr };
  }

  // Export logic for multi-table reports
  const handleExport = async () => {
    let filename = 'report';
    let tables = [];
    let title = '';
    if (reportType === 'gst-summary-regular' || reportType === 'gst-summary-composition') {
      const { salesRows, purchaseRows, itemSummaryArr } = getGSTSummaryTables(itemwiseSalesArr, itemwisePurchaseArr, itemList, partyList);
      
      // Calculate totals for sales
      const salesTotals = calculateGSTTotals(salesRows);
      const salesTotalRow = {
        invoiceNumber: `TOTAL (${salesTotals.documentCount} invoices)`,
        partyName: '',
        taxable: salesTotals.taxable,
        gstPercent: '',
        cgst: salesTotals.cgst,
        sgst: salesTotals.sgst,
        igst: salesTotals.igst,
        net: salesTotals.net,
      };
      
      // Calculate totals for purchases
      const purchaseTotals = calculateGSTTotals(purchaseRows);
      const purchaseTotalRow = {
        invoiceNumber: `TOTAL (${purchaseTotals.documentCount} invoices)`,
        partyName: '',
        taxable: purchaseTotals.taxable,
        gstPercent: '',
        cgst: purchaseTotals.cgst,
        sgst: purchaseTotals.sgst,
        igst: purchaseTotals.igst,
        net: purchaseTotals.net,
      };
      
      // Calculate totals for item summary
      const itemTotals = itemSummaryArr.reduce((acc, row) => ({
        taxableOut: acc.taxableOut + (row.taxableOut || 0),
        outputCGST: acc.outputCGST + (row.outputCGST || 0),
        outputSGST: acc.outputSGST + (row.outputSGST || 0),
        outputIGST: acc.outputIGST + (row.outputIGST || 0),
        taxableIn: acc.taxableIn + (row.taxableIn || 0),
        inputCGST: acc.inputCGST + (row.inputCGST || 0),
        inputSGST: acc.inputSGST + (row.inputSGST || 0),
        inputIGST: acc.inputIGST + (row.inputIGST || 0),
      }), { taxableOut: 0, outputCGST: 0, outputSGST: 0, outputIGST: 0, taxableIn: 0, inputCGST: 0, inputSGST: 0, inputIGST: 0 });
      
      const itemTotalRow = {
        itemName: `TOTAL (${itemSummaryArr.length} items)`,
        hsn: '',
        gstPercent: '',
        taxableOut: itemTotals.taxableOut,
        outputCGST: itemTotals.outputCGST,
        outputSGST: itemTotals.outputSGST,
        outputIGST: itemTotals.outputIGST,
        taxableIn: itemTotals.taxableIn,
        inputCGST: itemTotals.inputCGST,
        inputSGST: itemTotals.inputSGST,
        inputIGST: itemTotals.inputIGST,
      };
      
      tables = [
        { arr: [...salesRows, salesTotalRow], columns: [
          { key: 'invoiceNumber', label: 'Invoice Number' },
          { key: 'partyName', label: 'Party Name' },
          { key: 'taxable', label: 'Taxable Outward' },
          { key: 'gstPercent', label: 'GST %' },
          { key: 'cgst', label: 'OTW CGST' },
          { key: 'sgst', label: 'OTW SGST' },
          { key: 'igst', label: 'OTW IGST' },
          { key: 'net', label: 'OTW NET' },
        ], tableTitle: 'Sales/Outward GST (Invoice-wise)' },
        { arr: [...purchaseRows, purchaseTotalRow], columns: [
          { key: 'invoiceNumber', label: 'Invoice Number' },
          { key: 'partyName', label: 'Party Name' },
          { key: 'taxable', label: 'Taxable Inward' },
          { key: 'gstPercent', label: 'GST %' },
          { key: 'cgst', label: 'ITW CGST' },
          { key: 'sgst', label: 'ITW SGST' },
          { key: 'igst', label: 'ITW IGST' },
          { key: 'net', label: 'ITW NET' },
        ], tableTitle: 'Purchase/Inward GST (Invoice-wise)' },
        { arr: [...itemSummaryArr, itemTotalRow], columns: [
          { key: 'itemName', label: 'Item Name' },
          { key: 'hsn', label: 'HSN' },
          { key: 'gstPercent', label: 'GST %' },
          { key: 'taxableOut', label: 'Taxable Outward' },
          { key: 'outputCGST', label: 'Output CGST' },
          { key: 'outputSGST', label: 'Output SGST' },
          { key: 'outputIGST', label: 'Output IGST' },
          { key: 'taxableIn', label: 'Taxable Inward' },
          { key: 'inputCGST', label: 'Input CGST' },
          { key: 'inputSGST', label: 'Input SGST' },
          { key: 'inputIGST', label: 'Input IGST' },
        ], tableTitle: 'Item-wise GST Summary' },
      ];
      filename = reportType;
      title = reportType === 'gst-summary-regular' ? 'GST Summary (Regular)' : 'GST Summary (Composition)';
    } else {
      // Fallback: single-table export for other reports
      let columns = [];
      let rows = [];
      title = '';
      if (reportType === 'partywise-sales' || reportType === 'partywise-purchase') {
        columns = [
          { key: 'partyName', label: 'Party Name' },
          { key: 'partyType', label: 'Party Type' },
          { key: 'gstin', label: 'GSTIN' },
          { key: 'total', label: 'Total' },
          { key: 'totalPaid', label: 'Total Paid' },
          { key: 'outstanding', label: 'Outstanding' },
          { key: 'billCount', label: 'No. of Bills' },
        ];
        const preparedData = data.map(row => {
          const totalPaid = getPartyPaidAmount(row.bills);
          const outstanding = (row.total || 0) - totalPaid;
          return { ...row, totalPaid, outstanding };
        });
        
        // Calculate totals
        const totals = calculatePartywiseTotals(data);
        const totalRow = {
          partyName: `TOTAL (${totals.partyCount} parties)`,
          partyType: '',
          gstin: '',
          total: totals.total,
          totalPaid: totals.totalPaid,
          outstanding: totals.outstanding,
          billCount: totals.billCount
        };
        
        rows = [...preparedData, totalRow];
        filename = reportType;
        title = reportType === 'partywise-sales' ? 'Partywise Sales' : 'Partywise Purchase';
      } else if (reportType === 'itemwise-report') {
        columns = [
          { key: 'itemName', label: 'Item Name' },
          { key: 'hsn', label: 'HSN' },
          { key: 'totalSales', label: 'Total Sales (₹)' },
          { key: 'totalPurchases', label: 'Total Purchases (₹)' },
          { key: 'profitLoss', label: 'Profit/Loss (₹)' },
          { key: 'salesBills', label: 'No. of Sales Bills' },
          { key: 'purchaseBills', label: 'No. of Purchase Bills' },
        ];
        const salesArr = itemwiseSalesArr;
        const purchaseArr = itemwisePurchaseArr;
        const grouped = {};
        salesArr.forEach(bill => {
          (bill.rows || []).forEach(row => {
            const itemId = row.item || 'Unknown';
            if (!grouped[itemId]) grouped[itemId] = { sales: 0, purchases: 0, salesBills: 0, purchaseBills: 0, hsn: row.hsn || '' };
            grouped[itemId].sales += (parseFloat(row.amount) || 0);
            grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
            grouped[itemId].salesBills += 1;
          });
        });
        purchaseArr.forEach(bill => {
          (bill.rows || []).forEach(row => {
            const itemId = row.item || 'Unknown';
            if (!grouped[itemId]) grouped[itemId] = { sales: 0, purchases: 0, salesBills: 0, purchaseBills: 0, hsn: row.hsn || '' };
            grouped[itemId].purchases += (parseFloat(row.amount) || 0);
            grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
            grouped[itemId].purchaseBills += 1;
          });
        });
        const itemwiseData = Object.entries(grouped).map(([itemId, g]) => {
          const item = itemList.find(i => i.id === itemId);
          return {
            itemName: item?.itemName || itemId,
            hsn: item?.hsnCode || g.hsn,
            totalSales: g.sales,
            totalPurchases: g.purchases,
            profitLoss: g.sales - g.purchases,
            salesBills: g.salesBills,
            purchaseBills: g.purchaseBills,
          };
        });
        
        // Calculate totals
        const totals = calculateItemwiseTotals(itemwiseData);
        const totalRow = {
          itemName: `TOTAL (${totals.itemCount} items)`,
          hsn: '',
          totalSales: totals.totalSales,
          totalPurchases: totals.totalPurchases,
          profitLoss: totals.profitLoss,
          salesBills: totals.salesBills,
          purchaseBills: totals.purchaseBills,
        };
        
        rows = [...itemwiseData, totalRow];
        filename = 'itemwise-report';
        title = 'Itemwise Report';
      } else if (reportType === 'stock') {
        columns = [
          { key: 'itemName', label: 'Item Name' },
          { key: 'hsn', label: 'HSN' },
          { key: 'openingStock', label: 'Opening Stock' },
          { key: 'purchased', label: 'Quantity Purchased' },
          { key: 'totalQty', label: 'Total Qty (Opening + Purchase)' },
          { key: 'sold', label: 'Quantity Sold' },
          { key: 'stock', label: 'Quantity in Hand' },
          { key: 'salesBills', label: 'No. of Sales Bills' },
          { key: 'purchaseBills', label: 'No. of Purchase Bills' },
        ];
        const salesArr = itemwiseSalesArr;
        const purchaseArr = itemwisePurchaseArr;
        const grouped = {};
        salesArr.forEach(bill => {
          (bill.rows || []).forEach(row => {
            const itemId = row.item || 'Unknown';
            if (!grouped[itemId]) grouped[itemId] = { sold: 0, purchased: 0, stock: 0, itemId, hsn: row.hsn || '', salesBills: 0, purchaseBills: 0 };
            grouped[itemId].sold += parseFloat(row.qty || 0);
            grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
            grouped[itemId].salesBills += 1;
          });
        });
        purchaseArr.forEach(bill => {
          (bill.rows || []).forEach(row => {
            const itemId = row.item || 'Unknown';
            if (!grouped[itemId]) grouped[itemId] = { sold: 0, purchased: 0, stock: 0, itemId, hsn: row.hsn || '', salesBills: 0, purchaseBills: 0 };
            grouped[itemId].purchased += parseFloat(row.qty || 0);
            grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
            grouped[itemId].purchaseBills += 1;
          });
        });
        itemList.forEach(item => {
          if (!grouped[item.id]) grouped[item.id] = { sold: 0, purchased: 0, stock: 0, itemId: item.id, hsn: item.hsnCode || '', salesBills: 0, purchaseBills: 0 };
        });
        Object.keys(grouped).forEach(itemId => {
          grouped[itemId].stock = 0;
        });
        const stockData = Object.values(grouped).map(g => {
          const item = itemList.find(i => i.id === g.itemId);
          const openingStock = typeof item?.openingStock === 'number' ? item.openingStock : parseFloat(item?.openingStock) || 0;
          const allPurchases = purchaseArr
            .filter(bill => (!dateTo || (bill.billDate <= dateTo)))
            .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
            .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
          const allSales = salesArr
            .filter(bill => (!dateTo || (bill.invoiceDate <= dateTo)))
            .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
            .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
          const periodPurchases = purchaseArr
            .filter(bill => (!dateFrom || bill.billDate >= dateFrom) && (!dateTo || bill.billDate <= dateTo))
            .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
            .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
          return {
            itemName: item?.itemName || '',
            hsn: item?.hsnCode || g.hsn,
            openingStock: openingStock,
            purchased: g.purchased,
            totalQty: openingStock + periodPurchases,
            sold: g.sold,
            stock: openingStock + allPurchases - allSales,
            salesBills: g.salesBills,
            purchaseBills: g.purchaseBills,
          };
        });
        
        // Calculate totals
        const totals = calculateStockTotals(stockData);
        const totalRow = {
          itemName: `TOTAL (${totals.itemCount} items)`,
          hsn: '',
          openingStock: totals.openingStock,
          purchased: totals.purchased,
          totalQty: totals.totalQty,
          sold: totals.sold,
          stock: totals.stock,
          salesBills: totals.salesBills,
          purchaseBills: totals.purchaseBills,
        };
        
        rows = [...stockData, totalRow];
        filename = 'stock-report';
        title = 'Stock Report';
      } else if (reportType === 'outstanding') {
        columns = [
          { key: 'partyName', label: 'Party Name' },
          { key: 'total', label: 'Total Billed' },
          { key: 'paid', label: 'Total Paid' },
          { key: 'outstanding', label: 'Outstanding' },
        ];
        
        // Calculate totals
        const totals = calculateOutstandingTotals(data);
        const totalRow = {
          partyName: `TOTAL (${totals.partyCount} parties)`,
          total: totals.total,
          paid: totals.paid,
          outstanding: totals.outstanding,
        };
        
        rows = [...data, totalRow];
        filename = 'outstanding-report';
        title = 'Outstanding Report';
      } else if (reportType === 'bill-register') {
        columns = [
          { key: 'invoiceNumber', label: 'Invoice No.' },
          { key: 'invoiceDate', label: 'Date' },
          { key: 'party', label: 'Party' },
          { key: 'totalAmount', label: 'Amount' },
          { key: 'paymentStatus', label: 'Status' },
        ];
        const billData = data.map(row => ({
          invoiceNumber: row.invoiceNumber || row.number || row.id,
          invoiceDate: row.invoiceDate || row.date || '',
          party: partyList.find(p => p.id === (row.party || row.customerId))?.firmName || row.party || row.customerId || '',
          totalAmount: row.totalAmount || row.amount || 0,
          paymentStatus: row.paymentStatus || 'Unpaid',
        }));
        
        // Calculate totals
        const totals = calculateBillRegisterTotals(billData);
        const totalRow = {
          invoiceNumber: `TOTAL (${totals.billCount} bills)`,
          invoiceDate: '',
          party: '',
          totalAmount: totals.totalAmount,
          paymentStatus: '',
        };
        
        rows = [...billData, totalRow];
        filename = 'bill-register';
        title = 'Bill Register';
      } else if (reportType === 'challan' || reportType === 'quotation' || reportType === 'purchase-orders') {
        columns = [
          { key: 'number', label: reportType === 'challan' ? 'Challan No.' : reportType === 'quotation' ? 'Quotation No.' : 'Order No.' },
          { key: 'date', label: 'Date' },
          { key: 'party', label: 'Party' },
          { key: 'amount', label: 'Amount' },
        ];
        const documentData = data.map(row => ({
          number: row.challanNumber || row.quotationNumber || row.orderNumber || row.id,
          date: row.date || row.challanDate || row.quotationDate || row.orderDate || '',
          party: row.partyName || row.party || '',
          amount: row.amount || 0,
        }));
        
        // Calculate totals
        const totals = calculateChallanQuotationTotals(documentData);
        const totalRow = {
          number: `TOTAL (${totals.documentCount} ${reportType === 'challan' ? 'challans' : reportType === 'quotation' ? 'quotations' : 'orders'})`,
          date: '',
          party: '',
          amount: totals.amount,
        };
        
        rows = [...documentData, totalRow];
        filename = reportType;
        title = reportType === 'challan' ? 'Challan List' : reportType === 'quotation' ? 'Quotation List' : 'Purchase Orders';
      } else if (reportType === 'customer-ledger' || reportType === 'supplier-ledger') {
        columns = [
          { key: 'date', label: 'Date' },
          { key: 'description', label: 'Description' },
          { key: 'billAmount', label: 'Bill Amount' },
          { key: 'payment', label: 'Payment' },
          { key: 'balance', label: 'Balance' },
        ];
        const ledgerData = data.map(row => ({
          date: row.date,
          description: row.description,
          billAmount: row.type === 'bill' ? row.amount : '',
          payment: row.type === 'payment' ? row.amount : '',
          balance: row.balance,
        }));
        
        // Calculate totals
        const totals = calculateLedgerTotals(ledgerData);
        const totalRow = {
          date: `TOTAL (${totals.entryCount} entries)`,
          description: '',
          billAmount: totals.billAmount,
          payment: totals.payment,
          balance: totals.finalBalance,
        };
        
        rows = [...ledgerData, totalRow];
        filename = reportType;
        title = reportType === 'customer-ledger' ? 'Customer Ledger' : 'Supplier Ledger';
      } else if (reportType === 'daybook' || reportType === 'sales-register' || reportType === 'purchase-register' || reportType === 'profit-loss' || reportType === 'ledger' || reportType === 'daily-sales-receipts') {
        columns = Object.keys(data[0] || {}).map(k => ({ key: k, label: k }));
        rows = data;
        filename = reportType;
        title = REPORT_GROUPS.find(group => group.options.some(opt => opt.value === reportType))?.label || reportType;
      } else if (reportType === 'expenses') {
        const columns = [
          { key: 'date', label: 'Date' },
          { key: 'head', label: 'Expense Head' },
          { key: 'amount', label: 'Amount' },
          { key: 'description', label: 'Description' },
          { key: 'receiptUrl', label: 'Receipt' },
        ];
        const rows = expenses
          .filter(e => (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo) && (!expenseHead || e.head === expenseHead));
        await multiTableCSV([{ arr: rows, columns, tableTitle: 'Expenses' }], 'expenses');
        multiTableExcel([{ arr: rows, columns, tableTitle: 'Expenses' }], 'expenses.xlsx');
        await arrayToPDF(rows, columns, 'expenses.pdf', 'Expenses');
        return;
      } else {
        alert('Export is not supported for this report type yet.');
        return;
      }
      // Wrap single-table in tables array for export helpers
      tables = [
        { arr: rows, columns, tableTitle: title }
      ];
    }
    // Export logic
    if (exportFormat === 'pdf') {
      await multiTablePDF(tables, filename + '.pdf', title);
    } else if (exportFormat === 'excel') {
      multiTableExcel(tables, filename + '.xlsx');
    } else if (exportFormat === 'csv') {
      await multiTableCSV(tables, filename);
    }
  };

  // Handler for viewing bills in Itemwise Report
  function handleViewBills(itemId) {
    // Simple logic: Find bills containing this item
    const salesBills = itemwiseSalesArr
      .filter(bill => (bill.rows || []).some(row => row.item === itemId))
      .map(bill => ({ 
        ...bill, 
        _billType: 'Sales',
        displayNumber: bill.invoiceNumber || bill.number || bill.id
      }));
    
    const purchaseBills = itemwisePurchaseArr
      .filter(bill => (bill.rows || []).some(row => row.item === itemId))
      .map(bill => ({ 
        ...bill, 
        _billType: 'Purchase',
        displayNumber: bill.billNumber || bill.number || bill.id
      }));
    
    // Combine and sort by date
    const allBills = [...salesBills, ...purchaseBills].sort((a, b) => {
      const dateA = a.invoiceDate || a.billDate || a.date || '';
      const dateB = b.invoiceDate || b.billDate || b.date || '';
      return dateB.localeCompare(dateA);
    });
    
    setModalBills(allBills);
    setShowModal(true);
  }

  // UI for filters
  const renderFilters = () => (
    <div className="flex flex-wrap gap-4 mb-4 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-700">Report Type</label>
        <select value={reportType} onChange={e => setReportType(e.target.value)} className="border rounded p-2 min-w-[160px]">
          {REPORT_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      
      {/* Time Filter Section (updated to match Payments.js) */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700">Time Filter</label>
          <select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
              // Reset sub-filters when changing main filter
              setSelectedSubFilter('');
              setSelectedMonth('');
              setSelectedQuarter('');
            }}
            className="border rounded p-2 min-w-[120px]"
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
              <label className="block text-xs font-medium text-gray-700">From Date</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="border rounded p-2 min-w-[140px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">To Date</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="border rounded p-2 min-w-[140px]"
              />
            </div>
          </>
        )}

        {/* Financial Year Filter */}
        {timeFilter === 'financial' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700">Financial Year</label>
              <select
                value={selectedFinancialYear}
                onChange={(e) => {
                  setSelectedFinancialYear(e.target.value);
                  // Reset sub-filters when changing financial year
                  setSelectedSubFilter('');
                  setSelectedMonth('');
                  setSelectedQuarter('');
                }}
                className="border rounded p-2 min-w-[140px]"
              >
                <option value="">Select Financial Year</option>
                {getAvailableFinancialYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            {/* Sub-filter for Financial Year */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Filter Type</label>
              <select
                value={selectedSubFilter}
                onChange={(e) => {
                  setSelectedSubFilter(e.target.value);
                  setSelectedMonth('');
                  setSelectedQuarter('');
                }}
                className="border rounded p-2 min-w-[160px]"
              >
                <option value="">Full Financial Year</option>
                <option value="month">Specific Month</option>
                <option value="quarter">Specific Quarter</option>
              </select>
            </div>
            
            {/* Month Filter (only when sub-filter is 'month') */}
            {selectedSubFilter === 'month' && (
              <div>
                <label className="block text-xs font-medium text-gray-700">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border rounded p-2 min-w-[140px]"
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
                <label className="block text-xs font-medium text-gray-700">Quarter</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="border rounded p-2 min-w-[160px]"
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
      </div>
      
      {(reportType.startsWith('partywise')) && (
        <div>
          <label className="block text-xs font-medium text-gray-700">Party</label>
          <select value={selectedParty} onChange={e => setSelectedParty(e.target.value)} className="border rounded p-2 min-w-[140px]">
            <option value="">All Parties</option>
            {partyList.map(p => <option key={p.id} value={p.id}>{p.firmName}</option>)}
          </select>
        </div>
      )}
      {(reportType.startsWith('itemwise') || reportType === 'stock') && (
        <div>
          <label className="block text-xs font-medium text-gray-700">Item</label>
          <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="border rounded p-2 min-w-[140px]">
            <option value="">All Items</option>
            {itemList.map(i => <option key={i.id} value={i.id}>{i.itemName}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700">Export Format</label>
        <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} className="border rounded p-2 min-w-[100px]">
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded shadow">Export</button>
    </div>
  );

  // Table for Partywise Sales (template)
  const renderPartywiseSales = () => {
    const preparedData = data.map(row => {
      const totalPaid = getPartyPaidAmount(row.bills);
      const outstanding = (row.total || 0) - totalPaid;
      return { ...row, totalPaid, outstanding };
    });
    
    // Calculate totals
    const totals = calculatePartywiseTotals(data);
    const totalRow = {
      partyName: `TOTAL (${totals.partyCount} parties)`,
      partyType: '',
      gstin: '',
      total: totals.total,
      totalPaid: totals.totalPaid,
      outstanding: totals.outstanding,
      billCount: totals.billCount,
      bills: []
    };
    
    const sortFns = getSortFns('partywise-sales');
    const config = sortConfigs['partywise-sales'] || { key: '', direction: 'asc' };
    let sortedData = [...preparedData];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    // Add total row at the end
    sortedData.push(totalRow);
    
    // Use sortedData for pagination instead of the original data
    const paginatedData = sortedData.slice(
      partywiseSalesPagination.startIndex, 
      partywiseSalesPagination.endIndex + 1
    );
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-sales', 'partyName')}>
                Party Name{config.key === 'partyName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th className="px-4 py-2 text-center">Party Type</th>
              <th className="px-4 py-2 text-center">GSTIN</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-sales', 'total')}>
                Total Sales{config.key === 'total' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-sales', 'totalPaid')}>
                Total Paid{config.key === 'totalPaid' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-sales', 'outstanding')}>
                Outstanding{config.key === 'outstanding' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
              <th className="px-4 py-2 text-center">No. of Bills</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => {
              const isTotalRow = row.partyName?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                  <td className="px-4 py-2 text-center">{row.partyType}</td>
                  <td className="px-4 py-2 text-center">{row.gstin}</td>
                  <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.totalPaid || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.outstanding || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setModalBills(row.bills); setShowModal(true); }}>{row.billCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationControls {...partywiseSalesPagination} />
      </div>
    );
  };

  // Table for Challan
  const renderChallan = () => {
    const sortFns = getSortFns('challan');
    const config = sortConfigs['challan'] || { key: '', direction: 'asc' };
    let sortedData = [...data];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    
    // Calculate totals
    const totals = calculateChallanQuotationTotals(data);
    const totalRow = {
      challanNumber: `TOTAL (${totals.documentCount} challans)`,
      date: '',
      partyName: '',
      amount: totals.amount
    };
    
    // Add total row at the end
    sortedData.push(totalRow);
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('challan', 'number')}>Challan No.{config.key === 'number' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('challan', 'date')}>Date{config.key === 'date' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('challan', 'partyName')}>Party{config.key === 'partyName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('challan', 'amount')}>Amount{config.key === 'amount' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const isTotalRow = row.challanNumber?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center">{row.challanNumber || row.id}</td>
                  <td className="px-4 py-2 text-center">{row.date || row.challanDate}</td>
                  <td className="px-4 py-2 text-center">{row.partyName || row.party || ''}</td>
                  <td className="px-4 py-2 text-center">₹{(row.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Table for Quotation
  const renderQuotation = () => {
    const sortFns = getSortFns('quotation');
    const config = sortConfigs['quotation'] || { key: '', direction: 'asc' };
    let sortedData = [...data];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    
    // Calculate totals
    const totals = calculateChallanQuotationTotals(data);
    const totalRow = {
      quotationNumber: `TOTAL (${totals.documentCount} quotations)`,
      date: '',
      partyName: '',
      amount: totals.amount
    };
    
    // Add total row at the end
    sortedData.push(totalRow);
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('quotation', 'number')}>Quotation No.{config.key === 'number' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('quotation', 'date')}>Date{config.key === 'date' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('quotation', 'partyName')}>Party{config.key === 'partyName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('quotation', 'amount')}>Amount{config.key === 'amount' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const isTotalRow = row.quotationNumber?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center">{row.quotationNumber || row.id}</td>
                  <td className="px-4 py-2 text-center">{row.date || row.quotationDate}</td>
                  <td className="px-4 py-2 text-center">{row.partyName || row.party || ''}</td>
                  <td className="px-4 py-2 text-center">₹{(row.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Table for Purchase Orders
  const renderPurchaseOrders = () => {
    const sortFns = getSortFns('purchase-orders');
    const config = sortConfigs['purchase-orders'] || { key: '', direction: 'asc' };
    let sortedData = [...data];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    
    // Calculate totals
    const totals = calculateChallanQuotationTotals(data);
    const totalRow = {
      orderNumber: `TOTAL (${totals.documentCount} orders)`,
      date: '',
      partyName: '',
      amount: totals.amount
    };
    
    // Add total row at the end
    sortedData.push(totalRow);
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('purchase-orders', 'number')}>Order No.{config.key === 'number' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('purchase-orders', 'date')}>Date{config.key === 'date' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('purchase-orders', 'partyName')}>Party{config.key === 'partyName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('purchase-orders', 'amount')}>Amount{config.key === 'amount' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const isTotalRow = row.orderNumber?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center">{row.orderNumber || row.id}</td>
                  <td className="px-4 py-2 text-center">{row.date || row.orderDate}</td>
                  <td className="px-4 py-2 text-center">{row.partyName || row.party || ''}</td>
                  <td className="px-4 py-2 text-center">₹{(row.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Modal for bill list (update Invoice No. to be clickable and redirect)
  const renderBillModal = () => (
    showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full relative">
          <button onClick={() => setShowModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
          <h3 className="text-lg font-bold mb-4">Bill List</h3>
          {modalBills.length > 0 ? (
            <>
              <div className="text-sm text-gray-600 mb-4">
                Showing {modalBills.length} bills for the selected item
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-center">Type</th>
                    <th className="px-4 py-2 text-center">Bill No.</th>
                    <th className="px-4 py-2 text-center">Date</th>
                    <th className="px-4 py-2 text-center">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {modalBills.map((bill, idx) => (
                    <tr key={idx} className="hover:bg-blue-50">
                      <td className="px-4 py-2 text-center">{bill._billType}</td>
                      <td className="px-4 py-2 text-center">
                        <span 
                          className="text-blue-700 underline cursor-pointer" 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            setSelectedBillSummary(bill); 
                            setShowBillSummaryModal(true); 
                          }}
                        >
                          {bill.displayNumber || bill.invoiceNumber || bill.billNumber || bill.number || bill.id}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">{bill.invoiceDate || bill.billDate || bill.date || ''}</td>
                      <td className="px-4 py-2 text-center">₹{(bill.totalAmount || bill.amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No bills found for the selected item.</p>
            </div>
          )}
        </div>
      </div>
    )
  );

  // Add ESC key listener for LIFO modal closing
  useEffect(() => {
    if (!showModal && !showBillSummaryModal) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showBillSummaryModal) setShowBillSummaryModal(false);
        else if (showModal) setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal, showBillSummaryModal]);

  // Render Customer Ledger table
  const renderCustomerLedger = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Date</th>
            <th className="px-4 py-2 text-center">Description</th>
            <th className="px-4 py-2 text-center">Bill Amount</th>
            <th className="px-4 py-2 text-center">Payment</th>
            <th className="px-4 py-2 text-center">Balance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="px-4 py-2 text-center">{row.date}</td>
              <td className="px-4 py-2 text-center">{row.description}</td>
              <td className="px-4 py-2 text-center">{row.type === 'bill' ? `₹${(row.amount || 0).toLocaleString('en-IN')}` : ''}</td>
              <td className="px-4 py-2 text-center">{row.type === 'payment' ? `₹${(row.amount || 0).toLocaleString('en-IN')}` : ''}</td>
              <td className="px-4 py-2 text-center font-bold">₹{(row.balance || 0).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render Supplier Ledger table
  const renderSupplierLedger = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Date</th>
            <th className="px-4 py-2 text-center">Description</th>
            <th className="px-4 py-2 text-center">Bill Amount</th>
            <th className="px-4 py-2 text-center">Payment</th>
            <th className="px-4 py-2 text-center">Balance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="px-4 py-2 text-center">{row.date}</td>
              <td className="px-4 py-2 text-center">{row.description}</td>
              <td className="px-4 py-2 text-center">{row.type === 'bill' ? `₹${(row.amount || 0).toLocaleString('en-IN')}` : ''}</td>
              <td className="px-4 py-2 text-center">{row.type === 'payment' ? `₹${(row.amount || 0).toLocaleString('en-IN')}` : ''}</td>
              <td className="px-4 py-2 text-center font-bold">₹{(row.balance || 0).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render Outstanding Report table
  const renderOutstanding = () => {
    console.log('=== OUTSTANDING DEBUG ===');
    console.log('Raw data:', data);
    console.log('Payments data:', payments);
    
    const sortFns = getSortFns('outstanding');
    const config = sortConfigs['outstanding'] || { key: '', direction: 'asc' };
    let sortedData = [...data];
    if (config.key && sortFns && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    
    // Calculate totals
    const totals = calculateOutstandingTotals(data);
    const totalRow = {
      partyName: `TOTAL (${totals.partyCount} parties)`,
      total: totals.total,
      paid: totals.paid,
      outstanding: totals.outstanding
    };
    
    // Add total row at the end
    sortedData.push(totalRow);
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('outstanding', 'partyName')}>Party Name{config.key === 'partyName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('outstanding', 'total')}>Total Billed{config.key === 'total' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('outstanding', 'paid')}>Total Paid{config.key === 'paid' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('outstanding', 'outstanding')}>Outstanding{config.key === 'outstanding' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {outstandingPagination.currentData.map((row, idx) => {
              const isTotalRow = row.partyName?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center">{row.partyName}</td>
                  <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.paid || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.outstanding || 0).toLocaleString('en-IN')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationControls {...outstandingPagination} />
      </div>
    );
  };

  // Render Partywise Purchase table
  const renderPartywisePurchase = () => {
    const preparedData = data.map(row => {
      const totalPaid = getPartyPaidAmount(row.bills);
      const outstanding = (row.total || 0) - totalPaid;
      return { ...row, totalPaid, outstanding };
    });
    
    // Calculate totals
    const totals = calculatePartywiseTotals(data);
    const totalRow = {
      partyName: `TOTAL (${totals.partyCount} parties)`,
      partyType: '',
      gstin: '',
      total: totals.total,
      totalPaid: totals.totalPaid,
      outstanding: totals.outstanding,
      billCount: totals.billCount,
      bills: []
    };
    
    const sortFns = getSortFns('partywise-purchase');
    const config = sortConfigs['partywise-purchase'] || { key: '', direction: 'asc' };
    let sortedData = [...preparedData];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    // Add total row at the end
    sortedData.push(totalRow);
    
    // Use sortedData for pagination instead of the original data
    const paginatedData = sortedData.slice(
      partywisePurchasePagination.startIndex, 
      partywisePurchasePagination.endIndex + 1
    );
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-purchase', 'partyName')}>Party Name{config.key === 'partyName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center">Party Type</th>
              <th className="px-4 py-2 text-center">GSTIN</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-purchase', 'total')}>Total Purchase{config.key === 'total' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-purchase', 'totalPaid')}>Total Paid{config.key === 'totalPaid' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('partywise-purchase', 'outstanding')}>Outstanding{config.key === 'outstanding' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center">No. of Bills</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => {
              const isTotalRow = row.partyName?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                  <td className="px-4 py-2 text-center">{row.partyType}</td>
                  <td className="px-4 py-2 text-center">{row.gstin}</td>
                  <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.totalPaid || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.outstanding || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setModalBills(row.bills); setShowModal(true); }}>{row.billCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationControls {...partywisePurchasePagination} />
      </div>
    );
  };

  // Render Itemwise Report table
  const renderItemwiseReport = () => {
    // Fetch salesArr and purchaseArr from state or Firestore (as in previous logic)
    const salesArr = itemwiseSalesArr;
    const purchaseArr = itemwisePurchaseArr;
    // Calculate totals for each item
    const grouped = {};
    salesArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item || 'Unknown';
        if (!grouped[itemId]) grouped[itemId] = { sales: 0, purchases: 0, salesBills: 0, purchaseBills: 0, hsn: row.hsn || '' };
        grouped[itemId].sales += (parseFloat(row.amount) || 0);
        grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
        grouped[itemId].salesBills += 1;
      });
    });
    purchaseArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item || 'Unknown';
        if (!grouped[itemId]) grouped[itemId] = { sales: 0, purchases: 0, salesBills: 0, purchaseBills: 0, hsn: row.hsn || '' };
        grouped[itemId].purchases += (parseFloat(row.amount) || 0);
        grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
        grouped[itemId].purchaseBills += 1;
      });
    });
    const result = Object.entries(grouped).map(([itemId, g]) => {
      const item = itemList.find(i => i.id === itemId);
      return {
        itemId,
        itemName: item?.itemName || itemId,
        hsn: item?.hsnCode || g.hsn,
        totalSales: g.sales,
        totalPurchases: g.purchases,
        profitLoss: g.sales - g.purchases,
        salesBills: g.salesBills,
        purchaseBills: g.purchaseBills,
      };
    });
    // Calculate totals
    const totals = calculateItemwiseTotals(result);
    const totalRow = {
      itemId: 'total',
      itemName: `TOTAL (${totals.itemCount} items)`,
      hsn: '',
      totalSales: totals.totalSales,
      totalPurchases: totals.totalPurchases,
      profitLoss: totals.profitLoss,
      salesBills: totals.salesBills,
      purchaseBills: totals.purchaseBills,
    };
    
    // Render new itemwise report table
    const sortFns = getSortFns('itemwise-report');
    const config = sortConfigs['itemwise-report'] || { key: '', direction: 'asc' };
    let sortedResult = [...result];
    if (config.key && sortFns[config.key]) {
      sortedResult.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    // Add total row at the end
    sortedResult.push(totalRow);
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'itemName')}>Item Name{config.key === 'itemName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'hsn')}>HSN{config.key === 'hsn' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'totalSales')}>Total Sales (₹){config.key === 'totalSales' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'totalPurchases')}>Total Purchases (₹){config.key === 'totalPurchases' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center">Profit / Loss (₹)</th>
              <th className="px-4 py-2 text-center">No. of Bills (Sales / Purchase)</th>
            </tr>
          </thead>
          <tbody>
            {sortedResult.map(row => {
              const isTotalRow = row.itemName?.includes('TOTAL');
              return (
                <tr key={row.itemId} className={isTotalRow ? "bg-gray-100 font-bold" : ""}>
                  <td className="px-4 py-2 text-center">{row.itemName}</td>
                  <td className="px-4 py-2 text-center">{row.hsn}</td>
                  <td className="px-4 py-2 text-center">₹{(row.totalSales || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.totalPurchases || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold {row.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}">₹{(row.profitLoss || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">
                    {isTotalRow ? (
                      `${row.salesBills} / ${row.purchaseBills}`
                    ) : (
                      <a href="#" onClick={(e) => { e.preventDefault(); handleViewBills(row.itemId); }} className="text-blue-700 underline cursor-pointer">
                        {row.salesBills} / {row.purchaseBills}
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Stock Report Table
  const renderStockReport = () => {
    // Use all items from itemList
    const salesArr = itemwiseSalesArr;
    const purchaseArr = itemwisePurchaseArr;
    const grouped = {};
    // Sales: Quantity Sold
    salesArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item || 'Unknown';
        if (!grouped[itemId]) grouped[itemId] = { sold: 0, purchased: 0, stock: 0, itemId, hsn: row.hsn || '', salesBills: 0, purchaseBills: 0 };
        grouped[itemId].sold += parseFloat(row.qty || 0);
        grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
        grouped[itemId].salesBills += 1;
      });
    });
    // Purchases: Quantity Purchased
    purchaseArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item || 'Unknown';
        if (!grouped[itemId]) grouped[itemId] = { sold: 0, purchased: 0, stock: 0, itemId, hsn: row.hsn || '', salesBills: 0, purchaseBills: 0 };
        grouped[itemId].purchased += parseFloat(row.qty || 0);
        grouped[itemId].hsn = row.hsn || grouped[itemId].hsn;
        grouped[itemId].purchaseBills += 1;
      });
    });
    // Ensure all items from itemList are present
    itemList.forEach(item => {
      if (!grouped[item.id]) grouped[item.id] = { sold: 0, purchased: 0, stock: 0, itemId: item.id, hsn: item.hsnCode || '', salesBills: 0, purchaseBills: 0 };
    });
    // Stock: Quantity in Hand
    Object.keys(grouped).forEach(itemId => {
      grouped[itemId].stock = 0; // Not used, but can be set if needed
    });
    // Map to array with item info
    const result = Object.values(grouped).map(g => {
      const item = itemList.find(i => i.id === g.itemId);
      const openingStock = typeof item?.openingStock === 'number' ? item.openingStock : parseFloat(item?.openingStock) || 0;
      // Purchases and sales up to dateTo (for running stock)
      const allPurchases = purchaseArr
        .filter(bill => (!dateTo || (bill.billDate <= dateTo)))
        .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
        .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
      const allSales = salesArr
        .filter(bill => (!dateTo || (bill.invoiceDate <= dateTo)))
        .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
        .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
      const periodPurchases = purchaseArr
        .filter(bill => (!dateFrom || bill.billDate >= dateFrom) && (!dateTo || bill.billDate <= dateTo))
        .flatMap(bill => (bill.rows || []).filter(row => row.item === g.itemId))
        .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
      return {
        itemId: g.itemId,
        itemName: item?.itemName || '', // Always use the actual name
        hsn: item?.hsnCode || g.hsn,
        openingStock: openingStock,
        purchased: g.purchased,
        totalQty: openingStock + periodPurchases,
        sold: g.sold,
        stock: openingStock + allPurchases - allSales,
        salesBills: g.salesBills,
        purchaseBills: g.purchaseBills,
      };
    });
    // Calculate totals
    const totals = calculateStockTotals(result);
    const totalRow = {
      itemId: 'total',
      itemName: `TOTAL (${totals.itemCount} items)`,
      hsn: '',
      openingStock: totals.openingStock,
      purchased: totals.purchased,
      totalQty: totals.totalQty,
      sold: totals.sold,
      stock: totals.stock,
      salesBills: totals.salesBills,
      purchaseBills: totals.purchaseBills,
    };
    
    const sortFns = getSortFns('stock');
    const config = sortConfigs['stock'] || { key: '', direction: 'asc' };
    let sortedResult = [...result];
    if (config.key && sortFns[config.key]) {
      sortedResult.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
    // Add total row at the end
    sortedResult.push(totalRow);
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'itemName')}>Item Name{config.key === 'itemName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'hsn')}>HSN{config.key === 'hsn' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'openingStock')}>Opening Stock{config.key === 'openingStock' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'purchased')}>Quantity Purchased{config.key === 'purchased' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'totalQty')}>Total Qty (Opening + Purchase){config.key === 'totalQty' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'sold')}>Quantity Sold{config.key === 'sold' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('stock', 'stock')}>Quantity in Hand{config.key === 'stock' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              <th className="px-4 py-2 text-center">No. of Bills (Sales / Purchase)</th>
            </tr>
          </thead>
          <tbody>
            {sortedResult.map(row => {
              const isTotalRow = row.itemName?.includes('TOTAL');
              return (
                <tr key={row.itemId} className={isTotalRow ? "bg-gray-100 font-bold" : ""}>
                  <td className="px-4 py-2 text-center">{row.itemName}</td>
                  <td className="px-4 py-2 text-center">{row.hsn}</td>
                  <td className="px-4 py-2 text-center">{row.openingStock}</td>
                  <td className="px-4 py-2 text-center">{row.purchased}</td>
                  <td className="px-4 py-2 text-center">{row.totalQty}</td>
                  <td className="px-4 py-2 text-center">{row.sold}</td>
                  <td className="px-4 py-2 text-center">{row.stock}</td>
                  <td className="px-4 py-2 text-center">
                    {isTotalRow ? (
                      `${row.salesBills} / ${row.purchaseBills}`
                    ) : (
                      <a href="#" onClick={(e) => { e.preventDefault(); handleViewBills(row.itemId); }} className="text-blue-700 underline cursor-pointer">
                        {row.salesBills} / {row.purchaseBills}
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Add this function below renderItemwiseReport
  const renderGSTSummaryRegular = () => {
    const { salesRows, purchaseRows, itemSummaryArr } = getGSTSummaryTables(itemwiseSalesArr, itemwisePurchaseArr, itemList, partyList);
    // Render tables for each section
    return (
      <div className="space-y-8">
        {/* 1. Sales/Outward GST Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
          <div className="font-bold text-lg p-2">Sales/Outward GST (Invoice-wise)</div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center">Invoice Number</th>
                <th className="px-4 py-2 text-center">Party Name</th>
                <th className="px-4 py-2 text-center">Taxable Outward</th>
                <th className="px-4 py-2 text-center">GST %</th>
                <th className="px-4 py-2 text-center">OTW CGST</th>
                <th className="px-4 py-2 text-center">OTW SGST</th>
                <th className="px-4 py-2 text-center">OTW IGST</th>
                <th className="px-4 py-2 text-center">OTW NET</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={(e) => {
                    e.preventDefault();
                    let bill = itemwiseSalesArr.find(b => b.invoiceNumber === row.invoiceNumber);
                    if (!bill) {
                      // Fallback: search by other fields
                      bill = itemwiseSalesArr.find(b => b.number === row.invoiceNumber || b.id === row.invoiceNumber);
                    }
                    console.log('GST Sales Click:', { invoiceNumber: row.invoiceNumber, foundBill: bill });
                    if (bill) {
                      setSelectedBillSummary({ ...bill, _billType: 'Sales' });
                      setShowBillSummaryModal(true);
                    } else {
                      console.warn('Bill not found for invoice number:', row.invoiceNumber);
                      alert('Bill details not found for this invoice number.');
                    }
                  }}>{row.invoiceNumber}</td>
                  <td className="px-4 py-2 text-center">{row.partyName}</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxable || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.cgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.sgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.igst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.net || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 2. Purchase/Inward GST Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
          <div className="font-bold text-lg p-2">Purchase/Inward GST (Invoice-wise)</div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center">Invoice Number</th>
                <th className="px-4 py-2 text-center">Party Name</th>
                <th className="px-4 py-2 text-center">Taxable Inward</th>
                <th className="px-4 py-2 text-center">GST %</th>
                <th className="px-4 py-2 text-center">ITW CGST</th>
                <th className="px-4 py-2 text-center">ITW SGST</th>
                <th className="px-4 py-2 text-center">ITW IGST</th>
                <th className="px-4 py-2 text-center">ITW NET</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={(e) => {
                    e.preventDefault();
                    let bill = itemwisePurchaseArr.find(b => b.billNumber === row.invoiceNumber);
                    if (!bill) {
                      // Fallback: search by other fields
                      bill = itemwisePurchaseArr.find(b => b.number === row.invoiceNumber || b.id === row.invoiceNumber);
                    }
                    console.log('GST Purchase Click:', { invoiceNumber: row.invoiceNumber, foundBill: bill });
                    if (bill) {
                      setSelectedBillSummary({ ...bill, _billType: 'Purchase' });
                      setShowBillSummaryModal(true);
                    } else {
                      console.warn('Bill not found for invoice number:', row.invoiceNumber);
                      alert('Bill details not found for this invoice number.');
                    }
                  }}>{row.invoiceNumber}</td>
                  <td className="px-4 py-2 text-center">{row.partyName}</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxable || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.cgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.sgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.igst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.net || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 3. Item-wise GST summary table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
          <div className="font-bold text-lg p-2">Item-wise GST Summary</div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center">Item Name</th>
                <th className="px-4 py-2 text-center">HSN</th>
                <th className="px-4 py-2 text-center">GST %</th>
                <th className="px-4 py-2 text-center">Taxable Outward</th>
                <th className="px-4 py-2 text-center">Output CGST</th>
                <th className="px-4 py-2 text-center">Output SGST</th>
                <th className="px-4 py-2 text-center">Output IGST</th>
                <th className="px-4 py-2 text-center">Taxable Inward</th>
                <th className="px-4 py-2 text-center">Input CGST</th>
                <th className="px-4 py-2 text-center">Input SGST</th>
                <th className="px-4 py-2 text-center">Input IGST</th>
              </tr>
            </thead>
            <tbody>
              {itemSummaryArr.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-center">{row.itemName}</td>
                  <td className="px-4 py-2 text-center">{row.hsn}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxableOut || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.outputCGST || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.outputSGST || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.outputIGST || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxableIn || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.inputCGST || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.inputSGST || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.inputIGST || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // GST Summary for Composition (existing logic)
  const renderGSTSummaryComposition = () => {
    if (companyDetails.gstinType !== 'Composition') return null;
    // 1. Sales GST (Bill of Supply) Table
    const salesRows = [];
    itemwiseSalesArr.forEach(bill => {
      const partyName = partyList.find(p => p.id === bill.party)?.firmName || bill.party || 'Unknown';
      const gstMap = {};
      (bill.rows || []).forEach(row => {
        const item = itemList.find(i => i.id === row.item);
        let gstPercent = 1;
        const itemType = item?.itemType || '';
        if (itemType === 'Service') gstPercent = 6;
        else if (itemType === 'Finished Good' || itemType === 'Raw Material' || itemType === 'Goods') gstPercent = 1;
        else if (itemType === 'Restaurant') gstPercent = 5;
        else if (item?.compositionGstRate) gstPercent = item.compositionGstRate;
        const key = gstPercent;
        if (!gstMap[key]) gstMap[key] = { gstPercent, taxable: 0 };
        gstMap[key].taxable += parseFloat(row.amount) || 0;
      });
      Object.values(gstMap).forEach(g => {
        salesRows.push({
          billNo: bill.invoiceNumber || bill.number || bill.id,
          partyName,
          gstPercent: g.gstPercent,
          taxable: g.taxable,
          gstPayable: g.taxable * g.gstPercent / 100,
        });
      });
    });
    const totalSalesTaxable = salesRows.reduce((sum, row) => sum + (row.taxable || 0), 0);
    const totalSalesGst = salesRows.reduce((sum, row) => sum + (row.gstPayable || 0), 0);

    // 2. Item-wise GST Summary Table
    const itemSummaryMap = {};
    itemList.forEach(item => {
      itemSummaryMap[item.id] = {
        itemName: item.itemName || '',
        hsn: item.hsnCode || 'N/A',
        gstPercent: item.compositionGstRate || 1,
        taxable: 0,
        gstPayable: 0,
      };
    });
    itemwiseSalesArr.forEach(bill => {
      (bill.rows || []).forEach(row => {
        const itemId = row.item;
        const item = itemList.find(i => i.id === itemId);
        let gstPercent = 1;
        const itemType = item?.itemType || '';
        if (itemType === 'Service') gstPercent = 6;
        else if (itemType === 'Finished Good' || itemType === 'Raw Material' || itemType === 'Goods') gstPercent = 1;
        else if (itemType === 'Restaurant') gstPercent = 5;
        else if (item?.compositionGstRate) gstPercent = item.compositionGstRate;
        if (!itemSummaryMap[itemId]) return;
        itemSummaryMap[itemId].gstPercent = gstPercent;
        itemSummaryMap[itemId].taxable += parseFloat(row.amount) || 0;
        itemSummaryMap[itemId].gstPayable += (parseFloat(row.amount) || 0) * gstPercent / 100;
      });
    });
    const itemSummaryArr = Object.values(itemSummaryMap).filter(row => row.taxable > 0);
    const totalItemTaxable = itemSummaryArr.reduce((sum, row) => sum + (row.taxable || 0), 0);
    const totalItemGst = itemSummaryArr.reduce((sum, row) => sum + (row.gstPayable || 0), 0);

    const sortFns = getSortFns('itemwise-report');
    const config = sortConfigs['itemwise-report'] || { key: '', direction: 'asc' };
    let sortedItemSummaryArr = [...itemSummaryArr];
    if (config.key && sortFns[config.key]) {
      sortedItemSummaryArr.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }

    return (
      <div className="space-y-8">
        {/* 1. Sales GST (Bill of Supply) Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
          <div className="font-bold text-lg p-2">Sales GST (Bill of Supply)</div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center">Bill No</th>
                <th className="px-4 py-2 text-center">Party Name</th>
                <th className="px-4 py-2 text-center">GST %</th>
                <th className="px-4 py-2 text-center">Taxable Amount</th>
                <th className="px-4 py-2 text-center">GST Payable</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => {
                    const bill = itemwiseSalesArr.find(b => (b.invoiceNumber === row.billNo || b.number === row.billNo || b.id === row.billNo));
                    if (bill) {
                      setSelectedBillSummary({ ...bill, _billType: 'Sales' });
                      setShowBillSummaryModal(true);
                    }
                  }}>{row.billNo}</td>
                  <td className="px-4 py-2 text-center">{row.partyName}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxable || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.gstPayable || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="font-bold bg-gray-100">
                <td className="px-4 py-2 text-center">Total</td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center">₹{totalSalesTaxable.toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{totalSalesGst.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* 2. Item-wise GST Summary Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
          <div className="font-bold text-lg p-2">Item-wise GST Summary</div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'itemName')}>Item Name{config.key === 'itemName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'hsn')}>HSN{config.key === 'hsn' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th className="px-4 py-2 text-center">GST %</th>
                <th className="px-4 py-2 text-center">Taxable Value</th>
                <th className="px-4 py-2 text-center">GST Payable</th>
              </tr>
            </thead>
            <tbody>
              {sortedItemSummaryArr.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-center">{row.itemName}</td>
                  <td className="px-4 py-2 text-center">{row.hsn}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxable || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.gstPayable || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="font-bold bg-gray-100">
                <td className="px-4 py-2 text-center">Total</td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center">₹{totalItemTaxable.toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{totalItemGst.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render Bill Register table
  const renderBillRegister = () => {
    // Calculate totals
    const totals = calculateBillRegisterTotals(data);
    const totalRow = {
      invoiceNumber: `TOTAL (${totals.billCount} bills)`,
      invoiceDate: '',
      party: '',
      totalAmount: totals.totalAmount,
      paymentStatus: ''
    };
    
    const allData = [...data, totalRow];
    
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center">Invoice No.</th>
              <th className="px-4 py-2 text-center">Date</th>
              <th className="px-4 py-2 text-center">Party</th>
              <th className="px-4 py-2 text-center">Amount</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {allData.map((row, idx) => {
              const isTotalRow = row.invoiceNumber?.includes('TOTAL');
              return (
                <tr key={idx} className={isTotalRow ? "bg-gray-100 font-bold" : "hover:bg-blue-50"}>
                  <td className="px-4 py-2 text-center">{row.invoiceNumber || row.number || row.id}</td>
                  <td className="px-4 py-2 text-center">{row.invoiceDate || row.date || ''}</td>
                  <td className="px-4 py-2 text-center">{partyList.find(p => p.id === (row.party || row.customerId))?.firmName || row.party || row.customerId || ''}</td>
                  <td className="px-4 py-2 text-center">₹{(row.totalAmount || row.amount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">{row.paymentStatus || 'Unpaid'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Add a new modal for bill summary preview:
  const renderBillSummaryModal = () => {
    console.log('Bill Summary Modal State:', { showBillSummaryModal, selectedBillSummary });
    return (
      showBillSummaryModal && selectedBillSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <button onClick={() => setShowBillSummaryModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            <h3 className="text-xl font-bold mb-4 text-center">{selectedBillSummary._billType === 'Purchase' ? 'Purchase Bill Summary' : 'Sales Bill Summary'}</h3>
            <div className="mb-4 flex flex-col gap-2">
              <div><span className="font-semibold">{selectedBillSummary._billType === 'Purchase' ? 'Bill Number' : 'Invoice Number'}:</span> {selectedBillSummary.displayNumber || selectedBillSummary.invoiceNumber || selectedBillSummary.billNumber || selectedBillSummary.number}</div>
              <div><span className="font-semibold">Date:</span> {(() => { 
                const d = selectedBillSummary.invoiceDate || selectedBillSummary.billDate || selectedBillSummary.date || ''; 
                if (d && d.includes('-')) { 
                  const [yyyy, mm, dd] = d.split('-'); 
                  return `${dd}/${mm}/${yyyy}`; 
                } 
                return d; 
              })()}</div>
              <div><span className="font-semibold">Party:</span> {(() => { 
                const p = partyList.find(pt => pt.id === selectedBillSummary.party); 
                return p ? p.firmName : (selectedBillSummary.party || 'Unknown'); 
              })()}</div>
              <div><span className="font-semibold">Amount:</span> ₹{(selectedBillSummary.totalAmount || selectedBillSummary.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              {selectedBillSummary.notes && <div><span className="font-semibold">Notes:</span> {selectedBillSummary.notes}</div>}
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-2">Items {selectedBillSummary._billType === 'Purchase' ? 'Purchased' : 'Sold'}:</div>
              <ul className="list-disc list-inside text-sm space-y-1">
                {(selectedBillSummary.rows || []).map((row, i) => {
                  const itemObj = (itemList || []).find(it => it.id === row.item) || {};
                  const itemName = itemObj.itemName || row.item || '?';
                  return (
                    <li key={i}>{itemName} (Qty: {row.qty}, Rate: ₹{row.rate})</li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )
    );
  };

  // Helper: get available financial years from itemwiseSalesArr, itemwisePurchaseArr, data
  function getAvailableFinancialYears() {
    const years = new Set();
    
    // Collect dates from all collections
    const allDates = [
      // Sales bills
      ...salesBills.map(b => b.invoiceDate || b.date),
      // Challans
      ...challans.map(b => b.challanDate || b.date),
      // Quotations
      ...quotations.map(b => b.quotationDate || b.date),
      // Purchase bills
      ...purchaseBills.map(b => b.billDate || b.date),
      // Purchase orders
      ...purchaseOrders.map(b => b.orderDate || b.date),
      // Itemwise arrays (for backward compatibility)
      ...itemwiseSalesArr.map(b => b.invoiceDate),
      ...itemwisePurchaseArr.map(b => b.billDate),
      // Current data array
      ...data.map(b => b.invoiceDate || b.billDate || b.date)
    ].filter(Boolean);
    
    allDates.forEach(dateStr => {
      const year = parseInt(dateStr?.slice(0, 4));
      if (!isNaN(year)) {
        const month = parseInt(dateStr.slice(5, 7));
        // Financial year logic: April-March
        const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
        years.add(fy);
      }
    });
    
    return Array.from(years).sort();
  }
  const availableFYs = getAvailableFinancialYears();
  const quarters = [
    { value: 'Q1', label: 'Q1 (Apr-Jun)', from: '-04-01', to: '-06-30' },
    { value: 'Q2', label: 'Q2 (Jul-Sep)', from: '-07-01', to: '-09-30' },
    { value: 'Q3', label: 'Q3 (Oct-Dec)', from: '-10-01', to: '-12-31' },
    { value: 'Q4', label: 'Q4 (Jan-Mar)', from: '-01-01', to: '-03-31' },
  ];
  const months = [
    { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
    { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
  ];
  // Update date range when FY/quarter/month changes
  useEffect(() => {
    if (selectedFY && selectedQuarter) {
      const [fyStart, fyEnd] = selectedFY.split('-');
      const q = quarters.find(q => q.value === selectedQuarter);
      if (q) {
        const from = (q.value === 'Q4' ? fyEnd : fyStart) + q.from;
        const to = (q.value === 'Q4' ? fyEnd : fyStart) + q.to;
        setPendingDateFrom(from);
        setPendingDateTo(to);
      }
    } else if (selectedFY && selectedMonth) {
      const [fyStart, fyEnd] = selectedFY.split('-');
      const m = months.find(m => m.value === selectedMonth);
      if (m) {
        const year = (parseInt(m.value) >= 4 ? fyStart : fyEnd);
        const from = `${year}-${m.value}-01`;
        const to = `${year}-${m.value}-${['04','06','09','11'].includes(m.value) ? '30' : m.value === '02' ? '28' : '31'}`;
        setPendingDateFrom(from);
        setPendingDateTo(to);
      }
    }
  }, [selectedFY, selectedQuarter, selectedMonth]);
  // Apply button handler
  const handleApplyDateFilter = () => {
    setDateFrom(pendingDateFrom);
    setDateTo(pendingDateTo);
  };


  // Sorting logic
  function sortRows(rows, columns) {
    if (!sortConfig.key) return rows;
    const col = columns.find(c => c.key === sortConfig.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }

  // Set default sort order when reportType changes
  useEffect(() => {
    if (reportType === 'partywise-sales' || reportType === 'partywise-purchase' || reportType === 'bill-register' || reportType === 'gst-summary-regular' || reportType === 'gst-summary-composition') {
      setSortConfig({ key: 'invoiceDate', direction: 'desc' });
    } else if (reportType === 'itemwise-report' || reportType === 'stock') {
      setSortConfig({ key: 'itemName', direction: 'asc' });
    } else if (reportType === 'outstanding') {
      setSortConfig({ key: 'outstanding', direction: 'desc' });
    } else if (reportType === 'customer-ledger' || reportType === 'supplier-ledger' || reportType === 'ledger') {
      setSortConfig({ key: 'date', direction: 'asc' });
    } else {
      setSortConfig({ key: '', direction: 'asc' });
    }
  }, [reportType]);

  // Add a handler for sorting
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        return { key, direction: 'asc' };
      }
    });
  };

  // Utility: Export multiple tables to PDF with letterhead, each on a new page
  const multiTablePDF = async (tables, filename, title = 'Report') => {
    const doc = new jsPDF();
    for (let i = 0; i < tables.length; i++) {
      const { arr, columns, tableTitle } = tables[i];
      // Letterhead (reuse your existing logic)
      let y = 16;
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
      const leftX = companyDetails.logoUrl ? 40 : 14;
      doc.setFontSize(14);
      doc.text(companyDetails.firmName || '', leftX, 16);
      doc.setFontSize(10);
      let detailsY = 22;
      if (companyDetails.address) { doc.text(companyDetails.address, leftX, detailsY); detailsY += 6; }
      if (companyDetails.city || companyDetails.state || companyDetails.pincode) {
        doc.text([
          companyDetails.city, companyDetails.state, companyDetails.pincode
        ].filter(Boolean).join(', '), leftX, detailsY); detailsY += 6;
      }
      if (companyDetails.gstin) { doc.text('GSTIN: ' + companyDetails.gstin, leftX, detailsY); detailsY += 6; }
      if (companyDetails.contactNumber) { doc.text('Contact: ' + companyDetails.contactNumber, leftX, detailsY); detailsY += 6; }
      if (companyDetails.email) { doc.text('Email: ' + companyDetails.email, leftX, detailsY); detailsY += 6; }
      doc.setFontSize(12);
      doc.text(tableTitle || title, 14, detailsY + 6);
      doc.autoTable({
        head: [columns.map(col => col.label)],
        body: arr.map(row => columns.map(col => row[col.key] ?? '')),
        startY: detailsY + 12,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        didParseCell: function(data) {
          // Apply custom styling to total rows
          if (data.row.index < arr.length) {
            const row = arr[data.row.index];
            const isTotalRow = row.partyName?.includes('TOTAL') || 
                              row.itemName?.includes('TOTAL') || 
                              row.invoiceNumber?.includes('TOTAL') ||
                              row.number?.includes('TOTAL') ||
                              row.date?.includes('TOTAL');
            
            if (isTotalRow) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
              data.cell.styles.textColor = [0, 0, 0];
            }
          }
        }
      });
      if (i < tables.length - 1) doc.addPage();
    }
    doc.save(filename);
  };

  // Utility: Export multiple tables to Excel (XLSX) with a sheet for each
  const multiTableExcel = (tables, filename) => {
    const wb = XLSX.utils.book_new();
    tables.forEach(({ arr, columns, tableTitle }) => {
      const wsData = [columns.map(col => col.label), ...arr.map(row => columns.map(col => row[col.key] ?? ''))];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, tableTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
  };

  // Utility: Export multiple tables to CSV (zipped)
  const multiTableCSV = async (tables, filenameBase) => {
    const zip = new JSZip();
    for (const { arr, columns, tableTitle } of tables) {
      const csvRows = [columns.map(col => '"' + col.label + '"').join(',')];
      arr.forEach(row => {
        csvRows.push(columns.map(col => '"' + (row[col.key] ?? '') + '"').join(','));
      });
      zip.file(tableTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 31) + '.csv', csvRows.join('\n'));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameBase + '.zip';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  };

  // Partywise Challan
  const renderPartywiseChallan = () => {
    // Group challans by party
    const partyMap = {};
    challans.forEach(row => {
      const partyId = row.partyId || row.party || 'Unknown';
      if (!partyMap[partyId]) partyMap[partyId] = { partyId, challans: [], total: 0, totalPaid: 0, partyType: '', gstin: '' };
      partyMap[partyId].challans.push(row);
      partyMap[partyId].total += parseFloat(row.amount || 0);
    });
    // Join party details
    Object.values(partyMap).forEach(party => {
      const partyObj = partyList.find(pt => pt.id === party.partyId) || {};
      party.partyName = partyObj.firmName || party.partyId;
      party.partyType = partyObj.type || '';
      party.gstin = partyObj.gstin || '';
      // For each challan, sum payments
      party.challans.forEach(challan => {
        const challanPayments = payments.filter(p =>
          p.allocations && p.allocations.some(a => a.billId === challan.id && a.billType === 'challan')
        );
        challan.totalPaid = challanPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      });
      party.totalPaid = party.challans.reduce((sum, c) => sum + (c.totalPaid || 0), 0);
      party.outstanding = party.total - party.totalPaid;
    });
    const partywise = Object.values(partyMap);
    // Calculate totals
    const totalRow = {
      partyName: `TOTAL (${partywise.length} parties)`,
      partyType: '',
      gstin: '',
      total: partywise.reduce((sum, p) => sum + p.total, 0),
      totalPaid: partywise.reduce((sum, p) => sum + p.totalPaid, 0),
      outstanding: partywise.reduce((sum, p) => sum + p.outstanding, 0),
      challanCount: partywise.reduce((sum, p) => sum + p.challans.length, 0),
    };
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center">Party Name</th>
              <th className="px-4 py-2 text-center">Party Type</th>
              <th className="px-4 py-2 text-center">GSTIN</th>
              <th className="px-4 py-2 text-center">Total Challans</th>
              <th className="px-4 py-2 text-center">Total Amount</th>
              <th className="px-4 py-2 text-center">Total Paid</th>
              <th className="px-4 py-2 text-center">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {partywise.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                <td className="px-4 py-2 text-center">{row.partyType}</td>
                <td className="px-4 py-2 text-center">{row.gstin}</td>
                <td className="px-4 py-2 text-center">{row.challans.length}</td>
                <td className="px-4 py-2 text-center">₹{row.total.toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{row.totalPaid.toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center font-bold">₹{row.outstanding.toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-2 text-center">{totalRow.partyName}</td>
              <td className="px-4 py-2 text-center"></td>
              <td className="px-4 py-2 text-center"></td>
              <td className="px-4 py-2 text-center">{totalRow.challanCount}</td>
              <td className="px-4 py-2 text-center">₹{totalRow.total.toLocaleString('en-IN')}</td>
              <td className="px-4 py-2 text-center">₹{totalRow.totalPaid.toLocaleString('en-IN')}</td>
              <td className="px-4 py-2 text-center">₹{totalRow.outstanding.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Partywise Quotation
  const renderPartywiseQuotation = () => {
    const partyMap = {};
    quotations.forEach(row => {
      const partyId = row.partyId || row.party || 'Unknown';
      if (!partyMap[partyId]) partyMap[partyId] = { partyId, quotations: [], total: 0, partyType: '', gstin: '' };
      partyMap[partyId].quotations.push(row);
      partyMap[partyId].total += parseFloat(row.amount || 0);
    });
    Object.values(partyMap).forEach(party => {
      const partyObj = partyList.find(pt => pt.id === party.partyId) || {};
      party.partyName = partyObj.firmName || party.partyId;
      party.partyType = partyObj.type || '';
      party.gstin = partyObj.gstin || '';
    });
    const partywise = Object.values(partyMap);
    const totalRow = {
      partyName: `TOTAL (${partywise.length} parties)`,
      partyType: '',
      gstin: '',
      total: partywise.reduce((sum, p) => sum + p.total, 0),
      quotationCount: partywise.reduce((sum, p) => sum + p.quotations.length, 0),
    };
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center">Party Name</th>
              <th className="px-4 py-2 text-center">Party Type</th>
              <th className="px-4 py-2 text-center">GSTIN</th>
              <th className="px-4 py-2 text-center">Total Quotations</th>
              <th className="px-4 py-2 text-center">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {partywise.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                <td className="px-4 py-2 text-center">{row.partyType}</td>
                <td className="px-4 py-2 text-center">{row.gstin}</td>
                <td className="px-4 py-2 text-center">{row.quotations.length}</td>
                <td className="px-4 py-2 text-center">₹{row.total.toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-2 text-center">{totalRow.partyName}</td>
              <td className="px-4 py-2 text-center"></td>
              <td className="px-4 py-2 text-center"></td>
              <td className="px-4 py-2 text-center">{totalRow.quotationCount}</td>
              <td className="px-4 py-2 text-center">₹{totalRow.total.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Partywise Purchase Orders
  const renderPartywisePurchaseOrders = () => {
    const partyMap = {};
    purchaseOrders.forEach(row => {
      const partyId = row.partyId || row.party || 'Unknown';
      if (!partyMap[partyId]) partyMap[partyId] = { partyId, orders: [], total: 0, partyType: '', gstin: '' };
      partyMap[partyId].orders.push(row);
      partyMap[partyId].total += parseFloat(row.amount || 0);
    });
    Object.values(partyMap).forEach(party => {
      const partyObj = partyList.find(pt => pt.id === party.partyId) || {};
      party.partyName = partyObj.firmName || party.partyId;
      party.partyType = partyObj.type || '';
      party.gstin = partyObj.gstin || '';
    });
    const partywise = Object.values(partyMap);
    const totalRow = {
      partyName: `TOTAL (${partywise.length} parties)`,
      partyType: '',
      gstin: '',
      total: partywise.reduce((sum, p) => sum + p.total, 0),
      orderCount: partywise.reduce((sum, p) => sum + p.orders.length, 0),
    };
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center">Party Name</th>
              <th className="px-4 py-2 text-center">Party Type</th>
              <th className="px-4 py-2 text-center">GSTIN</th>
              <th className="px-4 py-2 text-center">Total Orders</th>
              <th className="px-4 py-2 text-center">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {partywise.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                <td className="px-4 py-2 text-center">{row.partyType}</td>
                <td className="px-4 py-2 text-center">{row.gstin}</td>
                <td className="px-4 py-2 text-center">{row.orders.length}</td>
                <td className="px-4 py-2 text-center">₹{row.total.toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-2 text-center">{totalRow.partyName}</td>
              <td className="px-4 py-2 text-center"></td>
              <td className="px-4 py-2 text-center"></td>
              <td className="px-4 py-2 text-center">{totalRow.orderCount}</td>
              <td className="px-4 py-2 text-center">₹{totalRow.total.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Expense heads (should match entry form)
  const EXPENSE_HEADS = [
    'Rent', 'Utilities', 'Salaries & Wages', 'Employee Benefits', 'Office Supplies',
    'Telephone & Internet', 'Travel & Conveyance', 'Repairs & Maintenance', 'Professional Fees',
    'Advertising & Marketing', 'Insurance', 'Depreciation', 'Bank Charges', 'Interest Paid',
    'Printing & Stationery', 'Postage & Courier', 'Vehicle Expenses', 'Licenses & Subscriptions',
    'Training & Development', 'Miscellaneous Expenses',
  ];

  // Render Expenses report table
  const renderExpensesReport = () => {
    // Filter by date and head
    let filtered = expenses;
    if (dateFrom) filtered = filtered.filter(e => e.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(e => e.date <= dateTo);
    if (expenseHead) filtered = filtered.filter(e => e.head === expenseHead);
    // Sort by date desc
    filtered = filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    // Calculate total
    const total = filtered.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 mt-4">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-center">Date</th>
              <th className="px-4 py-2 text-center">Expense Head</th>
              <th className="px-4 py-2 text-center">Amount</th>
              <th className="px-4 py-2 text-center">Description</th>
              <th className="px-4 py-2 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, idx) => (
              <tr key={e.id || idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center">{e.date}</td>
                <td className="px-4 py-2 text-center">{e.head}</td>
                <td className="px-4 py-2 text-center">₹{(e.amount || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">{e.description}</td>
                <td className="px-4 py-2 text-center">
                  {e.receiptUrl ? <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a> : ''}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-2 text-center" colSpan={2}>TOTAL</td>
              <td className="px-4 py-2 text-center">₹{total.toLocaleString('en-IN')}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Fetch payments for use in renderPartywiseChallan
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
    const unsub = onSnapshot(paymentsRef, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setPayments(arr);
    });
    return () => unsub();
  }, [db, userId, isAuthReady, appId]);

  // Utility: Get paid amount for a bill
  function getBillPaidAmount(billId) {
    const billPayments = payments.filter(p => {
      const matches = p.billId === billId || 
        p.invoiceId === billId || 
        p.purchaseBillId === billId ||
        p.invoiceNumber === billId ||
        p.billNumber === billId;
      
      return matches;
    });
    
    const totalPaid = billPayments.reduce((sum, p) => {
      // Try multiple possible amount fields
      const amount = parseFloat(p.amount) || parseFloat(p.totalAmount) || parseFloat(p.paymentAmount) || 0;
      return sum + amount;
    }, 0);
    
    return totalPaid;
  }

  // Utility: Get paid amount for a party (sum of all bills for that party)
  function getPartyPaidAmount(bills) {
    if (!bills || bills.length === 0) {
      return 0;
    }
    
    const totalPaid = (bills || []).reduce((sum, bill) => {
      const billPaid = getBillPaidAmount(bill.id);
      return sum + billPaid;
    }, 0);
    
    return totalPaid;
  }



  // Main render
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Reports</h2>
      

      
      {renderFilters()}
      {loading && <div className="text-blue-600 px-4 py-2">Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {renderBillModal()}
      {renderBillSummaryModal()}
      {/* Render report table based on type */}
      {reportType === 'partywise-sales' && renderPartywiseSales()}
      {reportType === 'partywise-purchase' && renderPartywisePurchase()}
      {reportType === 'challan' && renderChallan()}
      {reportType === 'quotation' && renderQuotation()}
      {reportType === 'purchase-orders' && renderPurchaseOrders()}
      {reportType === 'customer-ledger' && renderCustomerLedger()}
      {reportType === 'supplier-ledger' && renderSupplierLedger()}
      {reportType === 'outstanding' && renderOutstanding()}
      {reportType === 'bill-register' && renderBillRegister()}
      {reportType === 'itemwise-report' && renderItemwiseReport()}
      {reportType === 'stock' && renderStockReport()}
      {reportType === 'gst-summary-regular' && companyDetails.gstinType === 'Regular' && renderGSTSummaryRegular()}
      {reportType === 'gst-summary-composition' && companyDetails.gstinType === 'Composition' && renderGSTSummaryComposition()}
      {reportType === 'partywise-challan' && renderPartywiseChallan()}
      {reportType === 'partywise-quotation' && renderPartywiseQuotation()}
      {reportType === 'partywise-purchase-orders' && renderPartywisePurchaseOrders()}
      {reportType === 'expenses' && renderExpensesReport()}
      {/* TODO: Add more report renderers here */}
    </div>
  );
};

export default Reports; 