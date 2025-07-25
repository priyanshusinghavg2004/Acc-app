import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import InvoiceTemplate from './BillTemplates/InvoiceTemplate';
import { useNavigate } from 'react-router-dom';

const REPORT_TYPES = [
  { value: 'partywise-sales', label: 'Partywise Sales' },
  { value: 'partywise-purchase', label: 'Partywise Purchase' },
  { value: 'itemwise-report', label: 'Itemwise Report' },
  { value: 'stock', label: 'Stock/Inventory' },
  { value: 'gst-summary-regular', label: 'GST Summary (Regular)' },
  { value: 'gst-summary-composition', label: 'GST Summary (Composition)' },
  { value: 'daybook', label: 'Daybook/Cashbook' },
  { value: 'sales-register', label: 'Sales Register' },
  { value: 'purchase-register', label: 'Purchase Register' },
  { value: 'purchase-orders', label: 'Purchase Orders' },
  { value: 'challan', label: 'Challan List' },
  { value: 'quotation', label: 'Quotation List' },
  { value: 'profit-loss', label: 'Profit & Loss' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'customer-ledger', label: 'Customer Ledger (Khata)' },
  { value: 'supplier-ledger', label: 'Supplier Ledger' },
  { value: 'outstanding', label: 'Outstanding Report' },
  { value: 'daily-sales-receipts', label: 'Daily Sales & Receipts' },
  { value: 'bill-register', label: 'Bill Register' },
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

  // Add state for selectedBillSummary and showBillSummaryModal
  const [selectedBillSummary, setSelectedBillSummary] = useState(null);
  const [showBillSummaryModal, setShowBillSummaryModal] = useState(false);

  const [companyDetails, setCompanyDetails] = useState({});

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

  // Fetch report data (Partywise Sales as template, add Challan, Quotation, Purchase Orders)
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    setLoading(true); setError('');
    if (reportType === 'partywise-sales') {
      // Real-time fetch all sales bills
      const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
      const unsub = onSnapshot(salesRef, (snap) => {
        let arr = [];
        snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        // Filter by date
        if (dateFrom) arr = arr.filter(bill => bill.invoiceDate >= dateFrom);
        if (dateTo) arr = arr.filter(bill => bill.invoiceDate <= dateTo);
        // Filter by party
        if (selectedParty) arr = arr.filter(bill => bill.party === selectedParty || bill.customerId === selectedParty);
        // Group by party
        const grouped = {};
        arr.forEach(bill => {
          const partyId = bill.party || bill.customerId || 'Unknown';
          if (!grouped[partyId]) grouped[partyId] = { total: 0, bills: [], partyId };
          grouped[partyId].total += parseFloat(bill.totalAmount || bill.amount || 0);
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
      }, err => { setError('Error fetching sales bills'); setLoading(false); });
      return () => unsub();
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
          if (pay.party === selectedParty) {
            if (!dateFrom || pay.date >= dateFrom) {
              if (!dateTo || pay.date <= dateTo) {
                payments.push({
                  type: 'payment',
                  date: pay.date,
                  amount: parseFloat(pay.amount || 0),
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
  }, [db, userId, isAuthReady, appId, reportType, selectedParty, dateFrom, dateTo]);

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
          if (!dateFrom || bill.billDate >= dateFrom) {
            if (!dateTo || bill.billDate <= dateTo) {
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
          if (pay.party === selectedParty) {
            if (!dateFrom || pay.date >= dateFrom) {
              if (!dateTo || pay.date <= dateTo) {
                payments.push({
                  type: 'payment',
                  date: pay.date,
                  amount: parseFloat(pay.amount || 0),
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
  }, [db, userId, isAuthReady, appId, reportType, selectedParty, dateFrom, dateTo]);

  // Outstanding Report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'outstanding') return;
    setLoading(true); setError('');
    // Fetch all parties, bills, and payments
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
    onSnapshot(salesRef, (salesSnap) => {
      const bills = [];
      salesSnap.forEach(doc => {
        const bill = { id: doc.id, ...doc.data() };
        bills.push(bill);
      });
      onSnapshot(paymentsRef, (paySnap) => {
        const payments = [];
        paySnap.forEach(doc => {
          const pay = { id: doc.id, ...doc.data() };
          payments.push(pay);
        });
        // Calculate outstanding for each party
        const partyMap = {};
        bills.forEach(bill => {
          const pid = bill.party || bill.customerId;
          if (!partyMap[pid]) partyMap[pid] = { total: 0, paid: 0 };
          partyMap[pid].total += parseFloat(bill.totalAmount || bill.amount || 0);
        });
        payments.forEach(pay => {
          if (!partyMap[pay.party]) partyMap[pay.party] = { total: 0, paid: 0 };
          partyMap[pay.party].paid += parseFloat(pay.amount || 0);
        });
        const result = Object.entries(partyMap).map(([pid, val]) => {
          const party = partyList.find(p => p.id === pid);
          return {
            partyName: party?.firmName || pid,
            total: val.total,
            paid: val.paid,
            outstanding: val.total - val.paid,
          };
        }).filter(row => row.outstanding !== 0);
        setData(result);
        setLoading(false);
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
        if ((!dateFrom || bill.invoiceDate >= dateFrom) && (!dateTo || bill.invoiceDate <= dateTo)) {
          arr.push(bill);
        }
      });
      setData(arr);
      setLoading(false);
    }, err => { setError('Error fetching bill register'); setLoading(false); });
  }, [db, userId, isAuthReady, appId, reportType, dateFrom, dateTo]);

  // Add Partywise Purchase report logic
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    if (reportType !== 'partywise-purchase') return;
    setLoading(true); setError('');
    const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
    const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/purchasePayments`);
    onSnapshot(purchaseRef, (snap) => {
      let arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      // Filter by date
      if (dateFrom) arr = arr.filter(bill => bill.billDate >= dateFrom);
      if (dateTo) arr = arr.filter(bill => bill.billDate <= dateTo);
      // Filter by party
      if (selectedParty) arr = arr.filter(bill => bill.party === selectedParty);
      // Group by party
      const grouped = {};
      arr.forEach(bill => {
        const partyId = bill.party || 'Unknown';
        if (!grouped[partyId]) grouped[partyId] = { total: 0, bills: [], partyId };
        grouped[partyId].total += parseFloat(bill.amount || 0);
        grouped[partyId].bills.push(bill);
      });
      // Fetch payments and map to bills
      onSnapshot(paymentsRef, (paySnap) => {
        const paymentsArr = [];
        paySnap.forEach(doc => paymentsArr.push({ id: doc.id, ...doc.data() }));
        // Attach payments to bills
        Object.values(grouped).forEach(g => {
          g.bills.forEach(bill => {
            bill.payments = paymentsArr.filter(p => p.billId === bill.id || p.party === bill.party);
          });
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
    }, err => { setError('Error fetching purchase bills'); setLoading(false); });
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
  // Set default date range to current FY on mount
  useEffect(() => {
    const { from, to } = getCurrentFinancialYearRange();
    if (!dateFrom) setDateFrom(from);
    if (!dateTo) setDateTo(to);
  }, []);

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

  // Export placeholder
  const handleExport = () => {
    alert('Export feature coming soon!');
  };

  // Handler for viewing bills in Itemwise Report
  function handleViewBills(itemId) {
    const salesBills = itemwiseSalesArr.filter(bill => (bill.rows || []).some(row2 => row2.item === itemId)).map(bill => ({ ...bill, _billType: 'Sales' }));
    const purchaseBills = itemwisePurchaseArr.filter(bill => (bill.rows || []).some(row2 => row2.item === itemId)).map(bill => ({ ...bill, _billType: 'Purchase' }));
    setModalBills([...salesBills, ...purchaseBills]);
    setShowModal(true);
  }

  // UI for filters
  const renderFilters = () => (
    <div className="flex flex-wrap gap-4 mb-4 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-700">Report Type</label>
        <select value={reportType} onChange={e => setReportType(e.target.value)} className="border rounded p-2">
          {REPORT_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">From</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded p-2" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700">To</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded p-2" />
      </div>
      {(reportType.startsWith('partywise')) && (
        <div>
          <label className="block text-xs font-medium text-gray-700">Party</label>
          <select value={selectedParty} onChange={e => setSelectedParty(e.target.value)} className="border rounded p-2">
            <option value="">All Parties</option>
            {partyList.map(p => <option key={p.id} value={p.id}>{p.firmName}</option>)}
          </select>
        </div>
      )}
      {(reportType.startsWith('itemwise') || reportType === 'stock') && (
        <div>
          <label className="block text-xs font-medium text-gray-700">Item</label>
          <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="border rounded p-2">
            <option value="">All Items</option>
            {itemList.map(i => <option key={i.id} value={i.id}>{i.itemName}</option>)}
          </select>
        </div>
      )}
      <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded shadow">Export</button>
    </div>
  );

  // Table for Partywise Sales (template)
  const renderPartywiseSales = () => {
    const preparedData = data.map(row => {
      const totalPaid = (row.bills || []).reduce((sum, bill) => sum + ((bill.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), 0);
      const outstanding = (row.total || 0) - totalPaid;
      return { ...row, totalPaid, outstanding };
    });
    const sortFns = getSortFns('partywise-sales');
    const config = sortConfigs['partywise-sales'] || { key: '', direction: 'asc' };
    let sortedData = [...preparedData];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
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
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                <td className="px-4 py-2 text-center">{row.partyType}</td>
                <td className="px-4 py-2 text-center">{row.gstin}</td>
                <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{(row.totalPaid || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center font-bold">₹{(row.outstanding || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setModalBills(row.bills); setShowModal(true); }}>{row.billCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center">{row.challanNumber || row.id}</td>
                <td className="px-4 py-2 text-center">{row.date || row.challanDate}</td>
                <td className="px-4 py-2 text-center">{row.partyName || row.party || ''}</td>
                <td className="px-4 py-2 text-center">₹{(row.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
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
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center">{row.quotationNumber || row.id}</td>
                <td className="px-4 py-2 text-center">{row.date || row.quotationDate}</td>
                <td className="px-4 py-2 text-center">{row.partyName || row.party || ''}</td>
                <td className="px-4 py-2 text-center">₹{(row.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
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
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center">{row.orderNumber || row.id}</td>
                <td className="px-4 py-2 text-center">{row.date || row.orderDate}</td>
                <td className="px-4 py-2 text-center">{row.partyName || row.party || ''}</td>
                <td className="px-4 py-2 text-center">₹{(row.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
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
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center">Type</th>
                <th className="px-4 py-2 text-center">Invoice No.</th>
                <th className="px-4 py-2 text-center">Date</th>
                <th className="px-4 py-2 text-center">Amount</th>
              </tr>
            </thead>
            <tbody>
              {modalBills.map((bill, idx) => (
                <tr key={idx} className="hover:bg-blue-50">
                  <td className="px-4 py-2 text-center">{bill._billType}</td>
                  <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setSelectedBillSummary(bill); setShowBillSummaryModal(true); }}>{bill.invoiceNumber || bill.number || bill.id}</td>
                  <td className="px-4 py-2 text-center">{bill.invoiceDate || bill.billDate || bill.date || ''}</td>
                  <td className="px-4 py-2 text-center">₹{(bill.totalAmount || bill.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    const sortFns = getSortFns('outstanding');
    const config = sortConfigs['outstanding'] || { key: '', direction: 'asc' };
    let sortedData = [...data];
    if (config.key && sortFns && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
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
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center">{row.partyName}</td>
                <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{(row.paid || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center font-bold">₹{(row.outstanding || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Partywise Purchase table
  const renderPartywisePurchase = () => {
    const preparedData = data.map(row => {
      const totalPaid = (row.bills || []).reduce((sum, bill) => sum + ((bill.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), 0);
      const outstanding = (row.total || 0) - totalPaid;
      return { ...row, totalPaid, outstanding };
    });
    const sortFns = getSortFns('partywise-purchase');
    const config = sortConfigs['partywise-purchase'] || { key: '', direction: 'asc' };
    let sortedData = [...preparedData];
    if (config.key && sortFns[config.key]) {
      sortedData.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
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
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-blue-50">
                <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
                <td className="px-4 py-2 text-center">{row.partyType}</td>
                <td className="px-4 py-2 text-center">{row.gstin}</td>
                <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{(row.totalPaid || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center font-bold">₹{(row.outstanding || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setModalBills(row.bills); setShowModal(true); }}>{row.billCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            {sortedResult.map(row => (
              <tr key={row.itemId}>
                <td className="px-4 py-2 text-center">{row.itemName}</td>
                <td className="px-4 py-2 text-center">{row.hsn}</td>
                <td className="px-4 py-2 text-center">₹{(row.totalSales || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">₹{(row.totalPurchases || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center font-bold {row.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}">₹{(row.profitLoss || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-center">
                  <a href="#" onClick={() => handleViewBills(row.itemId)} className="text-blue-700 underline cursor-pointer">
                    {row.salesBills} / {row.purchaseBills}
                  </a>
                </td>
              </tr>
            ))}
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
    const sortFns = getSortFns('stock');
    const config = sortConfigs['stock'] || { key: '', direction: 'asc' };
    let sortedResult = [...result];
    if (config.key && sortFns[config.key]) {
      sortedResult.sort((a, b) => {
        const res = sortFns[config.key](a, b);
        return config.direction === 'asc' ? res : -res;
      });
    }
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
            {sortedResult.map(row => (
              <tr key={row.itemId}>
                <td className="px-4 py-2 text-center">{row.itemName}</td>
                <td className="px-4 py-2 text-center">{row.hsn}</td>
                <td className="px-4 py-2 text-center">{row.openingStock}</td>
                <td className="px-4 py-2 text-center">{row.purchased}</td>
                <td className="px-4 py-2 text-center">{row.totalQty}</td>
                <td className="px-4 py-2 text-center">{row.sold}</td>
                <td className="px-4 py-2 text-center">{row.stock}</td>
                <td className="px-4 py-2 text-center">
                  <a href="#" onClick={() => handleViewBills(row.itemId)} className="text-blue-700 underline cursor-pointer">
                    {row.salesBills} / {row.purchaseBills}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Add this function below renderItemwiseReport
  const renderGSTSummaryRegular = () => {
    // 1. Sales/Outward GST Table (Invoice-wise, multi-rate per invoice)
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
    // 2. Purchase/Inward GST Table (Invoice-wise, multi-rate per invoice)
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
    // 3. Item-wise GST summary (replaces HSN-wise summary)
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
    // Calculate overall net payable
    const totalNetCGST = itemSummaryArr.reduce((sum, row) => sum + (row.outputCGST - row.inputCGST), 0);
    const totalNetSGST = itemSummaryArr.reduce((sum, row) => sum + (row.outputSGST - row.inputSGST), 0);
    const totalNetIGST = itemSummaryArr.reduce((sum, row) => sum + (row.outputIGST - row.inputIGST), 0);
    // After mapping salesRows and purchaseRows:
    const totalSalesNet = salesRows.reduce((sum, row) => sum + (row.net || 0), 0);
    const totalPurchaseNet = purchaseRows.reduce((sum, row) => sum + (row.net || 0), 0);
    // In renderGSTSummaryRegular, add sorting for Item-wise GST Summary table
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
                  <td className="px-4 py-2 text-center">
                    {row.showButton ? <button className="text-blue-700 underline cursor-pointer" onClick={() => setSelectedBillSummary(row.bill) || setShowBillSummaryModal(true)}>{row.invoiceNumber}</button> : ''}
                  </td>
                  <td className="px-4 py-2 text-center">{row.showButton ? row.partyName : ''}</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxable || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.cgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.sgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.igst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.net || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {/* Total row for Sales */}
              <tr className="font-bold bg-gray-100">
                <td className="px-4 py-2 text-center">Total</td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center font-bold">₹{totalSalesNet.toLocaleString('en-IN')}</td>
              </tr>
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
                  <td className="px-4 py-2 text-center">
                    {row.showButton ? <button className="text-blue-700 underline cursor-pointer" onClick={() => setSelectedBillSummary(row.bill) || setShowBillSummaryModal(true)}>{row.invoiceNumber}</button> : ''}
                  </td>
                  <td className="px-4 py-2 text-center">{row.showButton ? row.partyName : ''}</td>
                  <td className="px-4 py-2 text-center">₹{(row.taxable || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">{row.gstPercent}%</td>
                  <td className="px-4 py-2 text-center">₹{(row.cgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.sgst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center">₹{(row.igst || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{(row.net || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {/* Total row for Purchase */}
              <tr className="font-bold bg-gray-100">
                <td className="px-4 py-2 text-center">Total</td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center"></td>
                <td className="px-4 py-2 text-center font-bold">₹{totalPurchaseNet.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* 3. Item-wise GST summary table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
          <div className="font-bold text-lg p-2">Item-wise GST Summary</div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'itemName')}>Item Name{config.key === 'itemName' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th className="px-4 py-2 text-center cursor-pointer select-none" onClick={() => handleTableSort('itemwise-report', 'hsn')}>HSN{config.key === 'hsn' ? (config.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th className="px-4 py-2 text-center">GST %</th>
                <th className="px-4 py-2 text-center">Taxable Outward</th>
                <th className="px-4 py-2 text-center">Output CGST</th>
                <th className="px-4 py-2 text-center">Output SGST</th>
                <th className="px-4 py-2 text-center">Output IGST</th>
                <th className="px-4 py-2 text-center">Taxable Inward</th>
                <th className="px-4 py-2 text-center">Input CGST</th>
                <th className="px-4 py-2 text-center">Input SGST</th>
                <th className="px-4 py-2 text-center">Input IGST</th>
                <th className="px-4 py-2 text-center">Net CGST</th>
                <th className="px-4 py-2 text-center">Net SGST</th>
                <th className="px-4 py-2 text-center">Net IGST</th>
              </tr>
            </thead>
            <tbody>
              {sortedItemSummaryArr.map((row, idx) => (
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
                  <td className="px-4 py-2 text-center font-bold">₹{((row.outputCGST - row.inputCGST) || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{((row.outputSGST - row.inputSGST) || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-center font-bold">₹{((row.outputIGST - row.inputIGST) || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-bold text-right p-2">Overall Net Payable: CGST ₹{totalNetCGST.toLocaleString('en-IN')}, SGST ₹{totalNetSGST.toLocaleString('en-IN')}, IGST ₹{totalNetIGST.toLocaleString('en-IN')}</div>
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
                  <td className="px-4 py-2 text-center">{row.billNo}</td>
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
  const renderBillRegister = () => (
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
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="px-4 py-2 text-center">{row.invoiceNumber || row.number || row.id}</td>
              <td className="px-4 py-2 text-center">{row.invoiceDate || row.date || ''}</td>
              <td className="px-4 py-2 text-center">{partyList.find(p => p.id === (row.party || row.customerId))?.firmName || row.party || row.customerId || ''}</td>
              <td className="px-4 py-2 text-center">₹{(row.totalAmount || row.amount || 0).toLocaleString('en-IN')}</td>
              <td className="px-4 py-2 text-center font-bold">{row.paymentStatus || 'Unpaid'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Add a new modal for bill summary preview:
  const renderBillSummaryModal = () => (
    showBillSummaryModal && selectedBillSummary && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
          <button onClick={() => setShowBillSummaryModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
          <h3 className="text-xl font-bold mb-4 text-center">{selectedBillSummary._billType === 'Purchase' ? 'Purchase Bill Summary' : 'Sales Bill Summary'}</h3>
          <div className="mb-2 flex flex-col gap-1">
            <div><span className="font-semibold">{selectedBillSummary._billType === 'Purchase' ? 'Bill Number' : 'Invoice Number'}:</span> {selectedBillSummary.number || selectedBillSummary.invoiceNumber}</div>
            <div><span className="font-semibold">Date:</span> {(() => { const d = selectedBillSummary.invoiceDate || selectedBillSummary.billDate || selectedBillSummary.date || ''; if (d && d.includes('-')) { const [yyyy, mm, dd] = d.split('-'); return `${dd}/${mm}/${yyyy}`; } return d; })()}</div>
            <div><span className="font-semibold">Party:</span> {(() => { const p = partyList.find(pt => pt.id === selectedBillSummary.party); return p ? p.firmName : (selectedBillSummary.party || 'Unknown'); })()}</div>
            <div><span className="font-semibold">Amount:</span> ₹{(selectedBillSummary.totalAmount || selectedBillSummary.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
            {selectedBillSummary.notes && <div><span className="font-semibold">Notes:</span> {selectedBillSummary.notes}</div>}
          </div>
          <div className="mt-4">
            <div className="font-semibold mb-1">Items {selectedBillSummary._billType === 'Purchase' ? 'Purchased' : 'Sold'}:</div>
            <ul className="list-disc list-inside text-sm">
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

  // Helper: get available financial years from itemwiseSalesArr, itemwisePurchaseArr, data
  function getAvailableFinancialYears() {
    const years = new Set();
    const allDates = [
      ...itemwiseSalesArr.map(b => b.invoiceDate),
      ...itemwisePurchaseArr.map(b => b.billDate),
      ...data.map(b => b.invoiceDate || b.billDate || b.date)
    ].filter(Boolean);
    allDates.forEach(dateStr => {
      const year = parseInt(dateStr?.slice(0, 4));
      if (!isNaN(year)) {
        const fy = dateStr.slice(5, 7) >= '04' ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
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
      {/* TODO: Add more report renderers here */}
    </div>
  );
};

export default Reports; 