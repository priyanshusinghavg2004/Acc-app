import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import BillTemplates from './BillTemplates';

const initialItemRow = {
  item: '',
  nos: 1,
  length: 0,
  height: 0,
  qty: 0,
  rate: 0,
  amount: 0,
  sgst: 0,
  cgst: 0,
  igst: 0,
  total: 0,
};

const areaUnits = [
  'Sq. Ft.', 'Sq. Inch', 'Sq. Yard', 'Square Meter', 'Cubic Feet', 'Cubic Meter', 'Cu. Inch', 'Cu. Yard'
];

function Purchases({ db, userId, isAuthReady, appId }) {
  // Document type: purchaseBill or purchaseOrder
  const [docType, setDocType] = useState('purchaseBill');
  const docTypeOptions = [
    { value: 'purchaseBill', label: 'PURCHASE BILL', collection: 'purchaseBills', numberLabel: 'Purchase Bill Number' },
    { value: 'purchaseOrder', label: 'PURCHASE ORDER', collection: 'purchaseOrders', numberLabel: 'Purchase Order Number' },
  ];

  // Bill state
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ ...initialItemRow }]);
  const [payments, setPayments] = useState([]);
  const [newPayment, setNewPayment] = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Cash', reference: '' });
  const [customFields, setCustomFields] = useState({ ewayBillNo: '', ewayQr: '', ewayDate: '' });
  const [errorMessage, setErrorMessage] = useState('');

  // Data
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [bills, setBills] = useState([]);
  const [company, setCompany] = useState({});

  // UI
  const [editingBillId, setEditingBillId] = useState(null);
    const [message, setMessage] = useState('');
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceBill, setInvoiceBill] = useState(null);
  const [invoiceZoom, setInvoiceZoom] = useState(1);
  const invoiceRef = useRef();
  const [viewBill, setViewBill] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Define handleViewBill
  const handleViewBill = (bill) => {
    setViewBill(bill);
    setShowViewModal(true);
  };

  // Fetch parties (sellers)
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
        }, (error) => {
          console.error('Error fetching parties:', error);
          setParties([]);
        }
      );
      return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

  // Fetch items
    useEffect(() => {
        if (db && userId && isAuthReady) {
      const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
      const unsubscribe = onSnapshot(itemsCollectionRef, (snapshot) => {
        const itemsArr = [];
                snapshot.forEach((doc) => {
          itemsArr.push({ id: doc.id, ...doc.data() });
        });
        itemsArr.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
        setItems(itemsArr);
      }, (error) => {
        console.error('Error fetching items:', error);
        setItems([]);
      });
            return () => unsubscribe();
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
      }, (error) => {
        console.error('Error fetching company details:', error);
        setCompany({});
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId]);

  // Fetch bills for the selected type
  useEffect(() => {
    if (!db || !userId || !isAuthReady || !appId) return;
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const path = `artifacts/${appId}/users/${userId}/${selected.collection}`;
    console.log('Listening to Firestore path:', path);
    try {
      const collectionRef = collection(db, path);
      const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
        const arr = [];
        snapshot.forEach((doc) => {
          arr.push({ id: doc.id, ...doc.data() });
        });
        arr.sort((a, b) => {
          const aNum = a.number || '';
          const bNum = b.number || '';
          return bNum.localeCompare(aNum);
        });
        setBills(arr);
      }, (error) => {
        console.error('Error fetching bills:', error);
        setBills([]);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error('Firestore listener setup failed:', err);
      setBills([]);
    }
  }, [db, userId, isAuthReady, appId, docType]);

  // Auto-generate number for the selected type
  useEffect(() => {
    if (editingBillId) return;
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const fy = getFinancialYear(billDate);
    const serials = bills
      .filter(bill => (bill.number || '').startsWith(fy))
      .map(bill => parseInt((bill.number || '').split('/')[1], 10))
      .filter(n => !isNaN(n));
    const nextSerial = (serials.length ? Math.max(...serials) : 0) + 1;
    const paddedSerial = nextSerial.toString().padStart(4, '0');
    setBillNumber(`${fy}/${paddedSerial}`);
  }, [billDate, bills, docType, editingBillId]);

  // Helper
  function getFinancialYear(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  // Add/Edit/Delete item rows
  const handleRowChange = (idx, field, value) => {
    setRows(rows => {
      return rows.map((row, i) => {
        if (i !== idx) return row;
        let updated = { ...row, [field]: value };

        // Always keep gstPercent from item
        if (field === 'item') {
          let itemObj = items.find(it => it.id === value);
          updated.gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
        }
        if (updated.gstPercent === undefined) {
          let itemObj = items.find(it => it.id === (field === 'item' ? value : row.item));
          updated.gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
        }

        // Get GSTINs
        const sellerGstin = company.gstin || '';
        const partyObj = parties.find(p => p.id === (field === 'party' ? value : party));
        const buyerGstin = partyObj ? (partyObj.gstin || '') : '';

        // Always auto-calculate GST split if item or party is changed
        if (field === 'item' || field === 'party') {
          if (sellerGstin && buyerGstin && sellerGstin.length >= 2 && buyerGstin.length >= 2) {
            if (sellerGstin.substring(0, 2) === buyerGstin.substring(0, 2)) {
              // Same state: split GST
              updated.sgst = updated.gstPercent / 2;
              updated.cgst = updated.gstPercent / 2;
              updated.igst = 0;
            } else {
              // Different state: IGST only
              updated.sgst = 0;
              updated.cgst = 0;
              updated.igst = updated.gstPercent;
            }
                } else {
            // Fallback: split GST
            updated.sgst = updated.gstPercent / 2;
            updated.cgst = updated.gstPercent / 2;
            updated.igst = 0;
          }
        }

        // QTY calculation for area/calculative units
        let itemObj = items.find(it => it.id === (field === 'item' ? value : row.item));
        const unit = itemObj ? itemObj.quantityMeasurement : '';
        if (areaUnits.includes(unit)) {
          updated.qty = (parseFloat(updated.nos) || 0) * (parseFloat(updated.length) || 1) * (parseFloat(updated.height) || 1);
          updated.amount = (parseFloat(updated.qty) || 0) * (parseFloat(updated.rate) || 0);
        } else {
          updated.qty = (parseFloat(updated.nos) || 0) * (parseFloat(updated.length) || 1) * (parseFloat(updated.height) || 1);
          updated.amount = (parseFloat(updated.qty) || 0) * (parseFloat(updated.rate) || 0);
        }
        // GST and total calculation
        const sgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.sgst) || 0) / 100;
        const cgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.cgst) || 0) / 100;
        const igstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.igst) || 0) / 100;
        updated.total = (parseFloat(updated.amount) || 0) + sgstAmt + cgstAmt + igstAmt;
        return updated;
      });
    });
  };
  const addRow = () => setRows([...rows, { ...initialItemRow }]);
  const removeRow = idx => setRows(rows.filter((_, i) => i !== idx));

  // Payment logic
  const addPayment = () => {
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) return;
    setPayments([...payments, { ...newPayment }]);
    setNewPayment({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Cash', reference: '' });
  };

  // Save/Update bill
  const handleSaveBill = async () => {
    if (!db || !userId || !appId) return;
    if (!party || rows.length === 0) {
      alert("Please select a party and add at least one item.");
            return;
        }
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${selected.collection}`);
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
    const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
    const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
    const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
    const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;
    const paymentStatus = totalPaid >= grandTotal ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Pending';
    const billData = {
      number: billNumber,
      billDate,
      party,
      notes,
      rows,
      payments,
      customFields,
      amount: grandTotal,
      paymentStatus,
      createdAt: serverTimestamp(),
    };

    const allBillCollections = ['salesBills', 'challans', 'quotations', 'purchaseBills', 'purchaseOrders'];
    let allBills = [];
    for (const coll of allBillCollections) {
      const billsSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/${coll}`));
      billsSnap.forEach(doc => allBills.push({ ...doc.data(), id: doc.id, collection: coll }));
    }
    // 1. Check for duplicate number
    if (allBills.some(b => b.number === billNumber && (editingBillId ? b.id !== editingBillId : true))) {
      setErrorMessage('Bill number already exists in another document. Please use a unique number.');
      alert('Bill number already exists in another document. Please use a unique number.');
      return;
    }
    // 2. Gap/date check: allow if any bill in FY has the same date
    const fy = getFinancialYear(billDate);
    const fyBills = allBills.filter(b => (b.number || '').startsWith(fy));
    const thisSerial = parseInt((billNumber || '').split('/')[1], 10);
    const thisDate = new Date(billDate);
    const sameDateExists = fyBills.some(b => {
      if (!b.number || (!b.invoiceDate && !b.billDate)) return false;
      if (b.id === editingBillId) return false;
      const date = new Date(b.invoiceDate || b.billDate);
      return date.getTime() === thisDate.getTime();
    });
    if (!sameDateExists) {
      // Find previous and next serials
      const sortedBills = fyBills
        .filter(b => b.id !== editingBillId && b.number)
        .map(b => ({
          serial: parseInt((b.number || '').split('/')[1], 10),
          date: new Date(b.invoiceDate || b.billDate),
        }))
        .sort((a, b) => a.serial - b.serial);
      let prev = null, next = null;
      for (let i = 0; i < sortedBills.length; i++) {
        if (sortedBills[i].serial < thisSerial) prev = sortedBills[i];
        if (sortedBills[i].serial > thisSerial) { next = sortedBills[i]; break; }
      }
      if (prev && thisDate.getTime() < prev.date.getTime()) {
        setErrorMessage(`Date must be on or after previous bill (${prev.serial}) date: ${prev.date.toLocaleDateString()}`);
        alert(`Date must be on or after previous bill (${prev.serial}) date: ${prev.date.toLocaleDateString()}`);
        return;
      }
      if (next && thisDate.getTime() > next.date.getTime()) {
        setErrorMessage(`Date must be on or before next bill (${next.serial}) date: ${next.date.toLocaleDateString()}`);
        alert(`Date must be on or before next bill (${next.serial}) date: ${next.date.toLocaleDateString()}`);
        return;
      }
    }

    try {
      if (editingBillId) {
        const billRef = doc(db, `artifacts/${appId}/users/${userId}/${selected.collection}`, editingBillId);
        await setDoc(billRef, billData, { merge: true });
                        } else {
        await addDoc(collectionRef, billData);
      }
      setBillNumber('');
      setBillDate(new Date().toISOString().split('T')[0]);
      setParty('');
      setNotes('');
      setRows([{ ...initialItemRow }]);
      setPayments([]);
      setCustomFields({ ewayBillNo: '', ewayQr: '', ewayDate: '' });
      setEditingBillId(null);
      setMessage('Bill saved successfully!');
    } catch (err) {
      alert("Error saving bill: " + err.message);
    }
  };

  // Edit bill
  const handleEditBill = (bill) => {
    setEditingBillId(bill.id);
    setBillNumber(bill.number || '');
    setBillDate(bill.billDate || '');
    setParty(bill.party || '');
    setNotes(bill.notes || '');
    setRows(bill.rows || [{ ...initialItemRow }]);
    setPayments(bill.payments || []);
    setCustomFields(bill.customFields || { ewayBillNo: '', ewayQr: '', ewayDate: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete bill
  const handleDeleteBill = async (billId) => {
    if (!db || !userId || !appId) return;
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const billRef = doc(db, `artifacts/${appId}/users/${userId}/${selected.collection}`, billId);
    await deleteDoc(billRef);
    setMessage('Bill deleted successfully!');
  };

  // Totals
  const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
  const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
  const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
  const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // Add print and PDF download handlers (copied from Sales.js, adapted):
  const handleInvoicePrint = () => {
    if (invoiceRef.current) {
      const printContents = invoiceRef.current.innerHTML;
      const printWindow = window.open('', '', 'height=800,width=1000');
      printWindow.document.write('<html><head><title>Purchase Bill</title>');
      printWindow.document.write('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss/dist/tailwind.min.css">');
      printWindow.document.write('<style>');
      printWindow.document.write('.print\\:hidden { display: none !important; }');
      printWindow.document.write('@media print { .print\\:hidden { display: none !important; } }');
      printWindow.document.write('.print\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }');
      printWindow.document.write('.print\\:bg-white { background-color: white !important; }');
      printWindow.document.write('.print\\:border { border-width: 1px !important; }');
      printWindow.document.write('.print\\:border-gray-300 { border-color: #d1d5db !important; }');
      printWindow.document.write('.print\\:flex-row { flex-direction: row !important; }');
      printWindow.document.write('.print\\:bg-yellow-100 { background-color: #fef3c7 !important; }');
      printWindow.document.write('.print\\:bg-green-100 { background-color: #dcfce7 !important; }');
      printWindow.document.write('.print\\:transform-none { transform: none !important; }');
      printWindow.document.write('@media print { .grid { display: grid !important; } }');
      printWindow.document.write('@media print { .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }');
      printWindow.document.write('@media print { .flex { display: flex !important; } }');
      printWindow.document.write('@media print { .flex-row { flex-direction: row !important; } }');
      printWindow.document.write('@media print { [class*="print:hidden"] { display: none !important; } }');
      printWindow.document.write('@media print { button { display: none !important; } }');
      printWindow.document.write('@media print { .sticky { position: static !important; } }');
      printWindow.document.write('</style>');
      printWindow.document.write('</head><body style="background:white;">');
      printWindow.document.write(printContents);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleInvoiceDownload = () => {
    if (invoiceRef.current) {
      import('html2pdf.js').then(html2pdf => {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = invoiceRef.current.innerHTML;
        const hiddenElements = tempContainer.querySelectorAll('.print\\:hidden, [class*="print:hidden"]');
        hiddenElements.forEach(el => {
          el.style.display = 'none';
        });
        html2pdf.default().from(tempContainer).set({
          margin: 0.5,
          filename: `Purchase_${invoiceBill?.number || 'Bill'}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).save();
      });
    }
  };

  const handleInvoiceWheel = (e) => {
    if (e.ctrlKey) return;
    if (showInvoiceModal) {
      e.preventDefault();
      setInvoiceZoom(z => {
        let next = z + (e.deltaY < 0 ? 0.1 : -0.1);
        next = Math.max(0.5, Math.min(2, next));
        return Math.round(next * 100) / 100;
      });
    }
  };

  // UI rendering (similar to Sales)
    return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      {errorMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded shadow-lg z-50 flex items-center gap-4">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="ml-4 text-red-700 font-bold text-lg">&times;</button>
        </div>
      )}
      <div className="w-full max-w-5xl mb-6">
        <div className="flex gap-2 justify-center mb-4">
          {docTypeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDocType(opt.value)}
              className={`px-6 py-2 rounded-t-lg font-bold text-lg border-b-4 transition-all duration-200 ${
                docType === opt.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                  : 'bg-gray-200 text-gray-700 border-transparent hover:bg-blue-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
                    </div>
                    </div>
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-5xl">
        <h2 className="text-3xl font-bold text-center mb-6 uppercase">{docTypeOptions.find(opt => opt.value === docType)?.label || 'PURCHASE BILL'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
            <label className="block text-sm font-medium text-gray-700">{docTypeOptions.find(opt => opt.value === docType)?.numberLabel || 'Purchase Bill Number'}</label>
            <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
            <label className="block text-sm font-medium text-gray-700">Party (Seller)</label>
            <select value={party} onChange={e => setParty(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
              <option value="">Select Party</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.firmName}</option>)}
                        </select>
                    </div>
                    </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
        {/* Custom Field Group Example */}
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-2">E-way Bill Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
              <label className="block text-sm font-medium text-gray-700">E-way Bill No</label>
              <input type="text" value={customFields.ewayBillNo} onChange={e => setCustomFields(f => ({ ...f, ewayBillNo: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">QR Code URL</label>
              <input type="text" value={customFields.ewayQr} onChange={e => setCustomFields(f => ({ ...f, ewayQr: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">E-way Bill Date</label>
              <input type="date" value={customFields.ewayDate} onChange={e => setCustomFields(f => ({ ...f, ewayDate: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    </div>
                </div>
        {/* Items Table */}
        <h3 className="text-xl font-bold text-gray-800 mb-2">Items</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                <th className="px-2 py-1">ITEM</th>
                <th className="px-2 py-1">NOS</th>
                <th className="px-2 py-1">LENGTH</th>
                <th className="px-2 py-1">HEIGHT</th>
                <th className="px-2 py-1">QTY</th>
                <th className="px-2 py-1">RATE</th>
                <th className="px-2 py-1">AMOUNT</th>
                <th className="px-2 py-1">SGST</th>
                <th className="px-2 py-1">CGST</th>
                <th className="px-2 py-1">IGST</th>
                <th className="px-2 py-1">TOTAL</th>
                <th className="px-2 py-1">REMOVE</th>
                                    </tr>
                                </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1">
                    <select value={row.item} onChange={e => handleRowChange(idx, 'item', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-32">
                      <option value="">Select Item</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.itemName}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.nos} min={1} onChange={e => handleRowChange(idx, 'nos', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-16" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.length} min={0} onChange={e => handleRowChange(idx, 'length', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-16" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.height} min={0} onChange={e => handleRowChange(idx, 'height', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-16" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.qty} min={0} readOnly
                      className="border border-gray-300 rounded-md p-1 w-16 bg-gray-100" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.rate} min={0} onChange={e => handleRowChange(idx, 'rate', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-16" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.amount} min={0} readOnly
                      className="border border-gray-300 rounded-md p-1 w-20 bg-gray-100" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.sgst} min={0} onChange={e => handleRowChange(idx, 'sgst', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-14" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.cgst} min={0} onChange={e => handleRowChange(idx, 'cgst', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-14" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.igst} min={0} onChange={e => handleRowChange(idx, 'igst', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-14" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.total} min={0} readOnly
                      className="border border-gray-300 rounded-md p-1 w-20 bg-green-50 font-semibold" />
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => removeRow(idx)} className="text-red-600 font-bold px-2 py-1 rounded hover:bg-red-100">X</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
          </table>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6">
          <div className="flex flex-col md:flex-row gap-2 mb-4 md:mb-0">
            <button onClick={addRow} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Add Item Row</button>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-full md:w-80">
            <div className="flex justify-between mb-1"><span>Subtotal (Excl. GST):</span><span>₹{subtotal}</span></div>
            <div className="flex justify-between mb-1"><span>Total SGST:</span><span>₹{totalSGST}</span></div>
            <div className="flex justify-between mb-1"><span>Total CGST:</span><span>₹{totalCGST}</span></div>
            <div className="flex justify-between mb-1"><span>Total IGST:</span><span>₹{totalIGST}</span></div>
            <div className="flex justify-between mt-2 font-bold text-lg"><span>Grand Total (Incl. GST):</span><span className="text-blue-700">₹{grandTotal}</span></div>
          </div>
        </div>
        {/* Payment Section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 w-full md:w-2/3 mx-auto">
          <h4 className="text-lg font-semibold mb-2">Payment Details</h4>
          <div className="mb-2">
            <span className="font-medium">Status: </span>
            {totalPaid >= grandTotal ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid'}
            <span className="ml-4 font-medium">Total Paid: </span>₹{totalPaid.toFixed(2)}
            <span className="ml-4 font-medium text-red-600">Remaining Due: </span>₹{(grandTotal - totalPaid).toFixed(2)}
          </div>
          <table className="w-full text-sm mb-2 border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Amount</th>
                <th className="border px-2 py-1">Date</th>
                <th className="border px-2 py-1">Mode</th>
                <th className="border px-2 py-1">Reference/Notes</th>
                <th className="border px-2 py-1">Remove</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1 text-right">₹{parseFloat(p.amount).toFixed(2)}</td>
                  <td className="border px-2 py-1">{p.date}</td>
                  <td className="border px-2 py-1">{p.mode}</td>
                  <td className="border px-2 py-1">{p.reference}</td>
                  <td className="border px-2 py-1 text-center">
                    <button type="button" className="text-red-600 font-bold" onClick={() => setPayments(payments.filter((_, i) => i !== idx))}>X</button>
                                        </td>
                                    </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-2">No payments yet</td></tr>
              )}
            </tbody>
                            </table>
          {/* Add Payment Form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input type="number" min="0" step="0.01" value={newPayment.amount || ''} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={newPayment.date || new Date().toISOString().split('T')[0]} onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mode</label>
              <select value={newPayment.mode || 'Cash'} onChange={e => setNewPayment({ ...newPayment, mode: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                <option>Cash</option>
                <option>Bank</option>
                <option>UPI</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reference/Notes</label>
              <input type="text" value={newPayment.reference || ''} onChange={e => setNewPayment({ ...newPayment, reference: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div className="md:col-span-4 mt-2">
              <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md" onClick={addPayment}>Add Payment</button>
            </div>
                        </div>
                    </div>
                <div className="flex gap-4 mt-4">
                    <button
            onClick={handleSaveBill}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
            {editingBillId ? 'Update Bill' : 'Save Complete Bill'}
                    </button>
          {editingBillId && (
                        <button
              onClick={() => {
                setEditingBillId(null);
                setBillNumber('');
                setBillDate(new Date().toISOString().split('T')[0]);
                setParty('');
                setNotes('');
                setRows([{ ...initialItemRow }]);
                setPayments([]);
                setCustomFields({ ewayBillNo: '', ewayQr: '', ewayDate: '' });
              }}
                            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
        <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">Recent Bills</h3>
        {bills.length === 0 ? (
          <div className="text-center text-gray-500 py-4">No bills yet. Create your first bill above!</div>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                                    <th className="px-4 py-2 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                {bills.map((bill) => (
                                    <tr key={bill.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.billDate}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{(() => {
                      const p = parties.find(pt => pt.id === bill.party);
                      return p ? p.firmName : bill.party || 'Unknown';
                    })()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.amount}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.payments ? bill.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">₹{bill.amount - (bill.payments ? bill.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.paymentStatus}</td>
                    <td className="px-4 py-2 text-sm text-gray-800 max-w-xs overflow-hidden text-ellipsis">{bill.notes}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <button
                        onClick={() => handleViewBill(bill)}
                        className="text-blue-600 hover:text-blue-900 font-medium mr-2"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditBill(bill)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                        onClick={() => handleDeleteBill(bill.id)}
                        className="text-red-600 hover:text-red-900 font-medium mr-2"
                                            >
                                                Delete
                                            </button>
                                            <button
                        onClick={() => { setInvoiceBill({
                          ...bill,
                          companyDetails: company,
                          partyDetails: parties.find(p => p.id === bill.party) || {},
                          items: items,
                          docType: docType
                        }); setShowInvoiceModal(true); }}
                        className="text-green-600 hover:text-green-900 font-medium"
                      >
                        {docType === 'purchaseBill' ? 'Purchase Bill' : docType === 'purchaseOrder' ? 'Purchase Order' : 'Bill'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {showInvoiceModal && invoiceBill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-0 max-w-full w-[98vw] h-[98vh] flex flex-col relative overflow-hidden">
            <div className="flex justify-end gap-2 p-2 print:hidden bg-white sticky top-0 z-10">
              <button className="bg-blue-600 text-white px-3 py-1 rounded print:hidden" onClick={handleInvoicePrint}>Print</button>
              <button className="bg-green-600 text-white px-3 py-1 rounded print:hidden" onClick={handleInvoiceDownload}>Save as PDF</button>
              <button className="bg-gray-400 text-white px-3 py-1 rounded print:hidden" onClick={() => setShowInvoiceModal(false)}>Close</button>
              <button className="bg-gray-200 text-gray-800 px-2 py-1 rounded ml-4 print:hidden" onClick={() => setInvoiceZoom(z => Math.max(0.5, z - 0.1))}>-</button>
              <span className="px-2 print:hidden">{Math.round(invoiceZoom * 100)}%</span>
              <button className="bg-gray-200 text-gray-800 px-2 py-1 rounded print:hidden" onClick={() => setInvoiceZoom(z => Math.min(2, z + 0.1))}>+</button>
            </div>
            <div className="flex-1 overflow-auto flex justify-center items-center bg-gray-50 print:bg-white" onWheel={handleInvoiceWheel} style={{ minHeight: 0, paddingTop: invoiceZoom < 1 ? `${(1-invoiceZoom)*120}px` : '0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
                <div ref={invoiceRef} style={{ transform: `scale(${invoiceZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s', background: 'white', boxShadow: '0 0 8px #ccc', margin: '0 auto' }} className="print:shadow-none print:bg-white print:transform-none">
                  <BillTemplates db={db} userId={userId} isAuthReady={isAuthReady} appId={appId} billOverride={invoiceBill} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showViewModal && viewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <button onClick={() => setShowViewModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            <h3 className="text-xl font-bold mb-4 text-center">{docType === 'purchaseBill' ? 'Purchase Bill' : docType === 'purchaseOrder' ? 'Purchase Order' : 'Bill'} Summary</h3>
            <div className="mb-2 flex flex-col gap-1">
              <div><span className="font-semibold">Number:</span> {viewBill.number}</div>
              <div><span className="font-semibold">Date:</span> {viewBill.billDate}</div>
              <div><span className="font-semibold">Party:</span> {(parties.find(p => p.id === viewBill.party)?.firmName) || viewBill.party || 'Unknown'}</div>
              <div><span className="font-semibold">Amount:</span> ₹{viewBill.amount}</div>
              {viewBill.notes && <div><span className="font-semibold">Notes:</span> {viewBill.notes}</div>}
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-1">Items:</div>
              <ul className="list-disc list-inside text-sm">
                {(viewBill.rows || []).map((row, i) => {
                  const itemObj = (items || []).find(it => it.id === row.item) || {};
                  const itemName = itemObj.itemName || row.item || '?';
                  return (
                    <li key={i}>{itemName} (Qty: {row.nos}, Rate: ₹{row.rate})</li>
                  );
                })}
              </ul>
            </div>
                    </div>
                </div>
            )}
    </div>
    );
}

export default Purchases; 