import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import InvoiceTemplate from './BillTemplates/InvoiceTemplate';
import { useNavigate } from 'react-router-dom';

const REPORT_TYPES = [
  { value: 'partywise-sales', label: 'Partywise Sales' },
  { value: 'partywise-purchase', label: 'Partywise Purchase' },
  { value: 'itemwise-report', label: 'Itemwise Report' },
  { value: 'stock', label: 'Stock/Inventory' },
  { value: 'gst-summary', label: 'GST Summary' },
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
            const openingStock = typeof item?.currentStock === 'number' ? item.currentStock : parseFloat(item?.currentStock) || 0;
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
              sold: g.sold,
              purchased: g.purchased,
              stock: openingStock + allPurchases - allSales,
              totalQty: openingStock + periodPurchases,
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
  const renderPartywiseSales = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Party Name</th>
            <th className="px-4 py-2 text-center">Party Type</th>
            <th className="px-4 py-2 text-center">GSTIN</th>
            <th className="px-4 py-2 text-center">Total Sales</th>
            <th className="px-4 py-2 text-center">Total Paid</th>
            <th className="px-4 py-2 text-center">Outstanding</th>
            <th className="px-4 py-2 text-center">No. of Bills</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
              <td className="px-4 py-2 text-center">{row.partyType}</td>
              <td className="px-4 py-2 text-center">{row.gstin}</td>
              <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
              <td className="px-4 py-2 text-center">{
                (() => {
                  // Sum all payments for this party
                  const paid = (row.bills || []).reduce((sum, bill) => sum + ((bill.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), 0);
                  return `₹${(paid || 0).toLocaleString('en-IN')}`;
                })()
              }</td>
              <td className="px-4 py-2 text-center font-bold">{
                (() => {
                  const paid = (row.bills || []).reduce((sum, bill) => sum + ((bill.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), 0);
                  const outstanding = (row.total || 0) - paid;
                  return `₹${(outstanding || 0).toLocaleString('en-IN')}`;
                })()
              }</td>
              <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setModalBills(row.bills); setShowModal(true); }}>{row.billCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Table for Challan
  const renderChallan = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Challan No.</th>
            <th className="px-4 py-2 text-center">Date</th>
            <th className="px-4 py-2 text-center">Party</th>
            <th className="px-4 py-2 text-center">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
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

  // Table for Quotation
  const renderQuotation = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Quotation No.</th>
            <th className="px-4 py-2 text-center">Date</th>
            <th className="px-4 py-2 text-center">Party</th>
            <th className="px-4 py-2 text-center">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
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

  // Table for Purchase Orders
  const renderPurchaseOrders = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Order No.</th>
            <th className="px-4 py-2 text-center">Date</th>
            <th className="px-4 py-2 text-center">Party</th>
            <th className="px-4 py-2 text-center">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
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
  const renderOutstanding = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Party Name</th>
            <th className="px-4 py-2 text-center">Total Billed</th>
            <th className="px-4 py-2 text-center">Total Paid</th>
            <th className="px-4 py-2 text-center">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
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

  // Render Partywise Purchase table
  const renderPartywisePurchase = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Party Name</th>
            <th className="px-4 py-2 text-center">Party Type</th>
            <th className="px-4 py-2 text-center">GSTIN</th>
            <th className="px-4 py-2 text-center">Total Purchase</th>
            <th className="px-4 py-2 text-center">Total Paid</th>
            <th className="px-4 py-2 text-center">Outstanding</th>
            <th className="px-4 py-2 text-center">No. of Bills</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="px-4 py-2 text-center font-semibold">{row.partyName}</td>
              <td className="px-4 py-2 text-center">{row.partyType}</td>
              <td className="px-4 py-2 text-center">{row.gstin}</td>
              <td className="px-4 py-2 text-center">₹{(row.total || 0).toLocaleString('en-IN')}</td>
              <td className="px-4 py-2 text-center">{
                (() => {
                  // Sum all payments for this party
                  const paid = (row.bills || []).reduce((sum, bill) => sum + ((bill.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), 0);
                  return `₹${(paid || 0).toLocaleString('en-IN')}`;
                })()
              }</td>
              <td className="px-4 py-2 text-center font-bold">{
                (() => {
                  const paid = (row.bills || []).reduce((sum, bill) => sum + ((bill.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), 0);
                  const outstanding = (row.total || 0) - paid;
                  return `₹${(outstanding || 0).toLocaleString('en-IN')}`;
                })()
              }</td>
              <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => { setModalBills(row.bills); setShowModal(true); }}>{row.billCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render Itemwise Report table
  const renderItemwiseReport = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-center">Item Name</th>
            <th className="px-4 py-2 text-center">HSN</th>
            <th className="px-4 py-2 text-center">Quantity Sold</th>
            <th className="px-4 py-2 text-center">Quantity Purchased</th>
            <th className="px-4 py-2 text-center">Quantity in Hand</th>
            <th className="px-4 py-2 text-center">Total Qty (Opening + Purchase)</th>
            <th className="px-4 py-2 text-center">No. of Bills (Sales / Purchase)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="px-4 py-2 text-center font-semibold">{row.itemName}</td>
              <td className="px-4 py-2 text-center">{row.hsn}</td>
              <td className="px-4 py-2 text-center">{row.sold}</td>
              <td className="px-4 py-2 text-center">{row.purchased}</td>
              <td className="px-4 py-2 text-center">{row.stock}</td>
              <td className="px-4 py-2 text-center">{row.totalQty}</td>
              <td className="px-4 py-2 text-center text-blue-700 underline cursor-pointer" onClick={() => {
                const salesBills = itemwiseSalesArr.filter(bill => (bill.rows || []).some(row2 => row2.item === row.itemId)).map(bill => ({ ...bill, _billType: 'Sales' }));
                const purchaseBills = itemwisePurchaseArr.filter(bill => (bill.rows || []).some(row2 => row2.item === row.itemId)).map(bill => ({ ...bill, _billType: 'Purchase' }));
                setModalBills([...salesBills, ...purchaseBills]);
                setShowModal(true);
              }}>{row.salesBills} / {row.purchaseBills}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

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

  // Main render
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Reports</h2>
      {renderFilters()}
      {loading && <div className="text-blue-600">Loading...</div>}
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
      {/* TODO: Add more report renderers here */}
    </div>
  );
};

export default Reports; 