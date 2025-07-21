import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
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

// Predefined units for new items
const predefinedUnits = [
  'Pieces', 'Piece', 'Kg', 'Gram', 'Ton', 'Quintal', 'Meter', 'Centimeter', 'Millimeter', 'Yard', 'Foot', 'Inch',
  'Litre', 'ML', 'Gallon', 'Drum', 'Cylinder',
  'Box', 'Packet', 'Carton', 'Bag', 'Bottle', 'Can', 'Jar', 'Tube',
  'Sheet', 'Strip', 'Roll', 'Ream', 'Bundle', 'Panel', 'Board', 'Plate', 'Slab', 'Block',
  'Sq. Ft.', 'Sq. Inch', 'Sq. Yard', 'Square Meter', 'Cubic Feet', 'Cubic Meter', 'Cu. Inch', 'Cu. Yard',
  'Hour', 'Day', 'Month', 'Year',
  'Lot', 'Job', 'Impression', 'Run',
  'Set', 'Pair',
  'Other'
];

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

// Utility function to determine GST split type
function getGstTypeAndSplit(sellerGstin, buyerGstin, gstPercent) {
  if (!sellerGstin || !buyerGstin || sellerGstin.length < 2 || buyerGstin.length < 2) {
    return { type: 'CGST_SGST', cgst: gstPercent / 2, sgst: gstPercent / 2, igst: 0 };
  }
  const sellerState = sellerGstin.substring(0, 2);
  const buyerState = buyerGstin.substring(0, 2);
  if (sellerState === buyerState) {
    return { type: 'CGST_SGST', cgst: gstPercent / 2, sgst: gstPercent / 2, igst: 0 };
  } else {
    return { type: 'IGST', cgst: 0, sgst: 0, igst: gstPercent };
  }
}

// Utility for rounding to 2 decimal places
function round2(val) {
  return Math.round((parseFloat(val) + Number.EPSILON) * 100) / 100;
}

function Sales({ db, userId, isAuthReady, appId }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ ...initialItemRow }]);
  // Remove template selection, always use SunriseTemplate
  // Remove print-related state and function
  // Remove: const [showPrint, setShowPrint] = useState(false);
  // Remove: const handlePrint = () => { ... }
  // Remove print area and print button from the return JSX

  // Live data states
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
    const [salesBills, setSalesBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [company, setCompany] = useState({});
  
  // ADD ITEM Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemMeasurement, setNewItemMeasurement] = useState('');
  const [newItemRate, setNewItemRate] = useState('');
  const [newItemType, setNewItemType] = useState('Service');
  const [newItemHsnCode, setNewItemHsnCode] = useState('');
  const [newItemGstPercentage, setNewItemGstPercentage] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState('0');
  const [newItemSalePrice, setNewItemSalePrice] = useState('0');
  const [newItemCurrentStock, setNewItemCurrentStock] = useState('0');
  const [newItemIsActive, setNewItemIsActive] = useState(true);
  const [newItemCustomUnit, setNewItemCustomUnit] = useState('');
  const [addItemMessage, setAddItemMessage] = useState('');
  
  // Filter states for sales bill list
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [filterAmount, setFilterAmount] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Add state for document type (Invoice, Challan, Quotation)
  const [docType, setDocType] = useState('invoice'); // 'invoice', 'challan', 'quotation'
  const docTypeOptions = [
    { value: 'invoice', label: 'INVOICE', collection: 'salesBills', numberLabel: 'Invoice Number' },
    { value: 'challan', label: 'CHALLAN', collection: 'challans', numberLabel: 'Challan Number' },
    { value: 'quotation', label: 'QUOTATION', collection: 'quotations', numberLabel: 'Quotation Number' },
  ];

  // State for bills of the selected type
  const [bills, setBills] = useState([]);

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
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId]);

  // Fetch purchases for stock calculation
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const purchasesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
      const unsubscribe = onSnapshot(purchasesCollectionRef, (snapshot) => {
        const bills = [];
        snapshot.forEach((doc) => {
          bills.push({ id: doc.id, ...doc.data() });
        });
        setPurchases(bills);
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
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId]);

  // Fetch bills for the selected type
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const selected = docTypeOptions.find(opt => opt.value === docType);
      if (!selected) return;
      const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${selected.collection}`);
      const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
        const arr = [];
        snapshot.forEach((doc) => {
          arr.push({ id: doc.id, ...doc.data() });
        });
        // LIFO sort by number (descending)
        arr.sort((a, b) => {
          const aNum = a.number || '';
          const bNum = b.number || '';
          return bNum.localeCompare(aNum);
        });
        setBills(arr);
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId, docType]);

  // Auto-generate number for the selected type
  useEffect(() => {
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const fy = getFinancialYear(invoiceDate);
    // Find max serial for this FY in bills
    const serials = bills
      .filter(bill => (bill.number || '').startsWith(fy))
      .map(bill => parseInt((bill.number || '').split('/')[1], 10))
      .filter(n => !isNaN(n));
    const nextSerial = (serials.length ? Math.max(...serials) : 0) + 1;
    const paddedSerial = nextSerial.toString().padStart(4, '0');
    setInvoiceNumber(`${fy}/${paddedSerial}`);
  }, [invoiceDate, bills, docType]);

  // Add state to track GST type for each row (for UI feedback)
  const [gstTypes, setGstTypes] = useState(rows.map(() => ''));

  // When party changes, update GST for all rows
  useEffect(() => {
    // Recalculate GST split for all rows when party changes
    const updatedRows = rows.map((row, idx) => {
      let itemObj = items.find(it => it.id === row.item);
      const gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
      const sellerGstin = company.gstin || '';
      const partyObj = parties.find(p => p.id === party);
      const buyerGstin = partyObj ? (partyObj.gstin || '') : '';
      const split = getGstTypeAndSplit(sellerGstin, buyerGstin, gstPercent);
      return {
        ...row,
        sgst: split.sgst,
        cgst: split.cgst,
        igst: split.igst,
      };
    });
    // Update GST type for UI feedback
    const updatedGstTypes = rows.map((row, idx) => {
      let itemObj = items.find(it => it.id === row.item);
      const gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
      const sellerGstin = company.gstin || '';
      const partyObj = parties.find(p => p.id === party);
      const buyerGstin = partyObj ? (partyObj.gstin || '') : '';
      const split = getGstTypeAndSplit(sellerGstin, buyerGstin, gstPercent);
      return split.type;
    });
    setRows(updatedRows);
    setGstTypes(updatedGstTypes);
    // eslint-disable-next-line
  }, [party]);

  // Calculate area, amount, GST, and total for each row
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
  
  // ADD ITEM Modal functions
  const clearAddItemForm = () => {
    setNewItemName('');
    setNewItemMeasurement('');
    setNewItemRate('');
    setNewItemType('Service');
    setNewItemHsnCode('');
    setNewItemGstPercentage('');
    setNewItemDescription('');
    setNewItemPurchasePrice('0');
    setNewItemSalePrice('0');
    setNewItemCurrentStock('0');
    setNewItemIsActive(true);
    setNewItemCustomUnit('');
    setAddItemMessage('');
  };

  const handleAddItem = async () => {
    if (!db || !userId) {
      setAddItemMessage("Firebase not initialized or user not authenticated.");
      return;
    }
    if (!newItemName) {
      setAddItemMessage("Item Name is required.");
      return;
    }
    if (!newItemMeasurement) {
      setAddItemMessage("Quantity Measurement is required.");
      return;
    }

    try {
      const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
      const itemData = {
        itemName: newItemName,
        quantityMeasurement: newItemCustomUnit || newItemMeasurement,
        defaultRate: parseFloat(newItemRate) || 0,
        itemType: newItemType,
        hsnCode: newItemHsnCode,
        gstPercentage: parseFloat(newItemGstPercentage) || 0,
        description: newItemDescription,
        purchasePrice: parseFloat(newItemPurchasePrice) || 0,
        salePrice: parseFloat(newItemSalePrice) || 0,
        currentStock: parseFloat(newItemCurrentStock) || 0,
        sgstRate: 0,
        cgstRate: 0,
        isActive: newItemIsActive,
        timestamp: serverTimestamp()
      };

      await addDoc(itemsCollectionRef, itemData);
      setAddItemMessage("Item added successfully!");
      clearAddItemForm();
      setShowAddItemModal(false);
    } catch (error) {
      console.error("Error adding item:", error);
      setAddItemMessage("Error adding item. Please try again.");
    }
  };

  const removeRow = idx => setRows(rows.filter((_, i) => i !== idx));

  // Filter functions for sales bill list
  const clearFilters = () => {
    setFilterInvoiceNumber('');
    setFilterDate('');
    setFilterParty('');
    setFilterAmount('');
    setFilterPaymentStatus('');
  };

  // Get the number label for the current document type
  const numberLabel = docTypeOptions.find(opt => opt.value === docType)?.numberLabel || 'Invoice Number';

  // Update bill list and filters to use bills state
  const getFilteredBills = () => {
    return bills.filter(bill => {
      const p = parties.find(pt => pt.id === bill.party);
      const partyName = p ? p.firmName : (bill.party || "Unknown");
      let billDate = bill.invoiceDate || bill.date || "";
      if (billDate && billDate.includes("-")) {
        const [yyyy, mm, dd] = billDate.split("-");
        billDate = `${dd}/${mm}/${yyyy}`;
      }
      const billAmount = typeof bill.amount === "number" ? bill.amount.toFixed(2) : bill.amount?.toString() || '';
      return (
        (filterInvoiceNumber === '' || (bill.number || '').toLowerCase().includes(filterInvoiceNumber.toLowerCase())) &&
        (filterDate === '' || billDate.includes(filterDate)) &&
        (filterParty === '' || partyName.toLowerCase().includes(filterParty.toLowerCase())) &&
        (filterAmount === '' || billAmount.includes(filterAmount)) &&
        (filterPaymentStatus === '' || (bill.paymentStatus || '').toLowerCase().includes(filterPaymentStatus.toLowerCase()))
      );
    });
  };

  const subtotal = round2(rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0));
  const totalSGST = round2(rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0));
  const totalCGST = round2(rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0));
  const totalIGST = round2(rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0));
  const grandTotal = round2(subtotal + totalSGST + totalCGST + totalIGST);

  // Seller details from company
  const seller = {
    name: company.firmName || '',
    address: `${company.address || ''}${company.city ? ', ' + company.city : ''}${company.pincode ? ' - ' + company.pincode : ''}`,
    contact: company.contactNumber || '',
    gstin: company.gstin || '',
    state: company.state || '',
    jurisdiction: company.city || '',
    bankName: company.bankName || '',
    bankAccount: company.bankAccount || '',
    bankIfsc: company.bankIfsc || '',
    upiId: company.upiId || '',
  };
  // Amount in words utility
  function numToWords(num) {
    // Simple INR words (for demo, can be replaced with a library)
    const a = [ '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen' ];
    const b = [ '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety' ];
    function inWords(n) {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' ' + a[n%10] : '');
      if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and ' + inWords(n%100) : '');
      if (n < 100000) return inWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + inWords(n%1000) : '');
      if (n < 10000000) return inWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + inWords(n%100000) : '');
      return inWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + inWords(n%10000000) : '');
    }
    return inWords(Math.floor(num)) + ' Rupees Only';
  }

  // Remove handlePrint function

  // Add new state for success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedBillId, setSavedBillId] = useState(null);

  // Update handleSaveInvoice function
  const handleSaveInvoice = async () => {
    if (!db || !userId || !appId) return;
    if (!party || rows.length === 0) {
      alert("Please select a party and add at least one item.");
      return;
    }
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${selected.collection}`);
    const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
    const billData = {
      number: invoiceNumber,
      invoiceDate,
      party,
      paymentStatus,
      notes,
      rows,
      amount: grandTotal,
      createdAt: serverTimestamp(),
    };
    try {
      let savedBill;
      if (editingBillId) {
        const billRef = doc(db, `artifacts/${appId}/users/${userId}/${selected.collection}`, editingBillId);
        await setDoc(billRef, billData, { merge: true });
        savedBill = { id: editingBillId, ...billData };
      } else {
        const docRef = await addDoc(collectionRef, billData);
        savedBill = { id: docRef.id, ...billData };
      }
      // Update stock for each sold item
      if (docType === 'invoice') {
        for (const row of rows) {
          const stockDocRef = doc(stockCollectionRef, row.item);
          const stockDocSnap = await getDoc(stockDocRef);
          let currentStock = 0;
          if (stockDocSnap.exists()) {
            currentStock = stockDocSnap.data().itemQuantity || 0;
          }
          const updatedStock = currentStock - (parseFloat(row.nos) || 0);
          await setDoc(stockDocRef, {
            itemQuantity: updatedStock,
            lastSaleDate: invoiceDate,
          }, { merge: true });
        }
      }
      // Show success modal
      setSavedBillId(savedBill.id);
      setShowSuccessModal(true);
      // Reset form
      setInvoiceNumber('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setParty('');
      setPaymentStatus('Pending');
      setNotes('');
      setRows([{ ...initialItemRow }]);
      setEditingBillId(null);
    } catch (err) {
      alert("Error saving invoice: " + err.message);
    }
  };

  // Modal and action state for View/Edit/Delete
  const [viewBill, setViewBill] = useState(null); // Bill to view in modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null); // Bill id being edited
  const [deletingBillId, setDeletingBillId] = useState(null); // Bill id being deleted
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Add import for BillTemplates and modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceBill, setInvoiceBill] = useState(null);

  // Handler to view bill details
  const handleViewBill = (bill) => {
    setViewBill(bill);
    setShowViewModal(true);
  };
  // Handler to edit bill (load into form)
  const handleEditBill = (bill) => {
    setEditingBillId(bill.id);
    setInvoiceNumber(bill.number || '');
    setInvoiceDate(bill.invoiceDate || '');
    setParty(bill.party || '');
    setPaymentStatus(bill.paymentStatus || 'Pending');
    setNotes(bill.notes || '');
    setRows(bill.rows || [{ ...initialItemRow }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Handler to delete bill
  const handleDeleteBill = (billId) => {
    setDeletingBillId(billId);
    setShowDeleteConfirm(true);
  };
  // Confirm delete
  const confirmDeleteBill = async () => {
    if (!db || !userId || !appId || !deletingBillId) return;
    try {
      const selected = docTypeOptions.find(opt => opt.value === docType);
      if (!selected) return;
      const billRef = doc(db, `artifacts/${appId}/users/${userId}/${selected.collection}`, deletingBillId);
      await deleteDoc(billRef);
      setShowDeleteConfirm(false);
      setDeletingBillId(null);
    } catch (err) {
      alert('Error deleting bill: ' + err.message);
    }
  };
  // Cancel delete
  const cancelDeleteBill = () => {
    setShowDeleteConfirm(false);
    setDeletingBillId(null);
  };

  // For SunriseTemplate, ensure A4 size and fixed layout
  // Remove a4Style

  const [invoiceZoom, setInvoiceZoom] = useState(1);
  const invoiceRef = useRef();

  // Update handleInvoicePrint and handleInvoiceDownload to properly handle print:hidden elements:
  const handleInvoicePrint = () => {
    if (invoiceRef.current) {
      const printContents = invoiceRef.current.innerHTML;
      const printWindow = window.open('', '', 'height=800,width=1000');
      printWindow.document.write('<html><head><title>Invoice</title>');
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
        // Create a temporary container to clone the content and hide print:hidden elements
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = invoiceRef.current.innerHTML;
        
        // Hide elements with print:hidden class
        const hiddenElements = tempContainer.querySelectorAll('.print\\:hidden, [class*="print:hidden"]');
        hiddenElements.forEach(el => {
          el.style.display = 'none';
        });
        
        html2pdf.default().from(tempContainer).set({
          margin: 0.5,
          filename: `${docTypeOptions.find(opt => opt.value === docType)?.label || 'Invoice'}_${invoiceBill?.number || 'Bill'}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).save();
      });
    }
  };

  const handleInvoiceWheel = (e) => {
    if (e.ctrlKey) return; // Let browser handle ctrl+wheel (native zoom)
    if (showInvoiceModal) {
      e.preventDefault();
      setInvoiceZoom(z => {
        let next = z + (e.deltaY < 0 ? 0.1 : -0.1);
        next = Math.max(0.5, Math.min(2, next));
        return Math.round(next * 100) / 100;
      });
    }
  };

    return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
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
        <h2 className="text-3xl font-bold text-center mb-6 uppercase">{docTypeOptions.find(opt => opt.value === docType)?.label || 'INVOICE'}</h2>
        {/* Remove print area (SunriseTemplate for printing) */}
        {/* Remove print button from the form actions */}
        {/* Hide form/table UI when printing - not needed */}
                    <div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
              <label className="block text-sm font-medium text-gray-700">{numberLabel}</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">Party (Buyer)</label>
              <select value={party} onChange={e => setParty(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                <option value="">Select Party</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.firmName}</option>)}
                        </select>
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">Payment Status</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                <option>Pending</option>
                <option>Paid</option>
                <option>Partial</option>
                        </select>
                    </div>
                    </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Invoice Items</h3>
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
                {rows.map((row, idx) => {
  // Determine GST type for helper text
  const itemObj = items.find(it => it.id === row.item);
  const gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
  const sellerGstin = company.gstin || '';
  const partyObj = parties.find(p => p.id === party);
  const buyerGstin = partyObj ? (partyObj.gstin || '') : '';
  let gstType = '';
  if (sellerGstin && buyerGstin && sellerGstin.length >= 2 && buyerGstin.length >= 2) {
    if (sellerGstin.substring(0, 2) === buyerGstin.substring(0, 2)) {
      gstType = 'intra';
    } else {
      gstType = 'inter';
    }
  }
  return (
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
                      {gstType === 'intra' && <div className="text-xs text-green-600">Auto: Intra-state (SGST)</div>}
                      {gstType === 'inter' && <div className="text-xs text-gray-400">(Not used for Inter-state)</div>}
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" value={row.cgst} min={0} onChange={e => handleRowChange(idx, 'cgst', e.target.value)}
                        className="border border-gray-300 rounded-md p-1 w-14" />
                      {gstType === 'intra' && <div className="text-xs text-green-600">Auto: Intra-state (CGST)</div>}
                      {gstType === 'inter' && <div className="text-xs text-gray-400">(Not used for Inter-state)</div>}
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" value={row.igst} min={0} onChange={e => handleRowChange(idx, 'igst', e.target.value)}
                        className="border border-gray-300 rounded-md p-1 w-14" />
                      {gstType === 'inter' && <div className="text-xs text-blue-600">Auto: Inter-state (IGST)</div>}
                      {gstType === 'intra' && <div className="text-xs text-gray-400">(Not used for Intra-state)</div>}
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" value={row.total} min={0} readOnly
                        className="border border-gray-300 rounded-md p-1 w-20 bg-green-50 font-semibold" />
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => removeRow(idx)} className="text-red-600 font-bold px-2 py-1 rounded hover:bg-red-100">X</button>
                                            </td>
                                        </tr>
                                    );
                                  })}
                                </tbody>
                            </table>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6">
            <div className="flex flex-col md:flex-row gap-2 mb-4 md:mb-0">
              <button onClick={addRow} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Add Item Row</button>
              <button onClick={() => setShowAddItemModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">ADD ITEM</button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-full md:w-80">
              <div className="flex justify-between mb-1"><span>Subtotal (Excl. GST):</span><span>₹{subtotal}</span></div>
              <div className="flex justify-between mb-1"><span>Total SGST:</span><span>₹{totalSGST}</span></div>
              <div className="flex justify-between mb-1"><span>Total CGST:</span><span>₹{totalCGST}</span></div>
              <div className="flex justify-between mb-1"><span>Total IGST:</span><span>₹{totalIGST}</span></div>
              <div className="flex justify-between mt-2 font-bold text-lg"><span>Grand Total (Incl. GST):</span><span className="text-blue-700">₹{grandTotal}</span></div>
                        </div>
                    </div>
          <div className="flex flex-col md:flex-row gap-4">
                    <button
              onClick={handleSaveInvoice}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 print:hidden"
            >
              Save {docTypeOptions.find(opt => opt.value === docType)?.label || 'Invoice'}
                        </button>
                </div>
          {/* Sales Bill List Section */}
          <div className="mt-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Sales Bill List</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"
                >
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
                {showFilters && (
                  <button
                    onClick={clearFilters}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
            
            {/* Filter Section */}
            {showFilters && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-lg font-semibold mb-3">Filter Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={filterInvoiceNumber}
                      onChange={(e) => setFilterInvoiceNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="Filter by invoice number"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="text"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="DD/MM/YYYY or partial"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
                    <input
                      type="text"
                      value={filterParty}
                      onChange={(e) => setFilterParty(e.target.value)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="Filter by party name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input
                      type="text"
                      value={filterAmount}
                      onChange={(e) => setFilterAmount(e.target.value)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="Filter by amount"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                    <select
                      value={filterPaymentStatus}
                      onChange={(e) => setFilterPaymentStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                    >
                      <option value="">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Partial">Partial</option>
                    </select>
                  </div>

                  {/* Removed document type filter as it's now part of the collection */}
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{numberLabel.split(' ')[0]} No.</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                <tbody>
                  {getFilteredBills().map((bill, idx) => {
                    const p = parties.find(pt => pt.id === bill.party);
                    const partyName = p ? p.firmName : (bill.party || "Unknown");
                    // Format date as DD/MM/YYYY
                    let date = bill.invoiceDate || bill.date || "";
                    if (date && date.includes("-")) {
                      const [yyyy, mm, dd] = date.split("-");
                      date = `${dd}/${mm}/${yyyy}`;
                    }
                    // Format amount with currency and right alignment
                    const amount = typeof bill.amount === "number"
                      ? bill.amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
                      : bill.amount;
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{bill.number || bill.invoiceNumber}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{date}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{partyName}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{amount}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (bill.paymentStatus || 'Pending') === 'Paid' 
                              ? 'bg-green-100 text-green-800' 
                              : (bill.paymentStatus || 'Pending') === 'Partial' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {bill.paymentStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                          <button onClick={() => handleViewBill(bill)} className="text-blue-600 hover:text-blue-900 font-medium mr-2">View</button>
                          <button onClick={() => handleEditBill(bill)} className="text-indigo-600 hover:text-indigo-900 font-medium mr-2">Edit</button>
                          <button onClick={() => handleDeleteBill(bill.id)} className="text-red-600 hover:text-red-900 font-medium mr-4">Delete</button>
                          <button onClick={() => { setInvoiceBill({
                            ...bill,
                            companyDetails: company,
                            partyDetails: parties.find(p => p.id === bill.party) || {},
                            items: items
                          }); setShowInvoiceModal(true); }} className="text-blue-600 hover:text-blue-900 font-medium">
                            {docTypeOptions.find(opt => opt.value === docType)?.label || 'Invoice'}
                          </button>
                        </td>
                    </tr>
                  );
                })}
                            </tbody>
                        </table>
            </div>
          </div>
        </div>
      </div>
      {/* View Bill Modal */}
      {showViewModal && viewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <button onClick={() => setShowViewModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            <h3 className="text-xl font-bold mb-4 text-center">Sales Bill Summary</h3>
            <div className="mb-2 flex flex-col gap-1">
              <div><span className="font-semibold">{numberLabel}:</span> {viewBill.number}</div>
              <div><span className="font-semibold">Date:</span> {(() => { const d = viewBill.invoiceDate || viewBill.date || ''; if (d && d.includes('-')) { const [yyyy, mm, dd] = d.split('-'); return `${dd}/${mm}/${yyyy}`; } return d; })()}</div>
              <div><span className="font-semibold">Party:</span> {(parties.find(p => p.id === viewBill.party)?.firmName) || viewBill.party || 'Unknown'}</div>
              <div><span className="font-semibold">Amount:</span> {typeof viewBill.amount === 'number' ? viewBill.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }) : viewBill.amount}</div>
              {viewBill.notes && <div><span className="font-semibold">Notes:</span> {viewBill.notes}</div>}
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-1">Items Sold:</div>
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
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full relative">
            <h3 className="text-lg font-bold mb-4 text-center">Confirm Delete</h3>
            <p className="mb-6 text-center">Are you sure you want to delete this sales bill?</p>
            <div className="flex justify-center gap-4">
              <button onClick={confirmDeleteBill} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Delete</button>
              <button onClick={cancelDeleteBill} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
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
                  <BillTemplates db={db} userId={userId} isAuthReady={isAuthReady} appId={appId} billOverride={invoiceBill} onClose={() => setShowInvoiceModal(false)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ADD ITEM Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => { setShowAddItemModal(false); clearAddItemForm(); }} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            <h3 className="text-xl font-bold mb-4 text-center">Add New Item</h3>
            
            {addItemMessage && (
              <div className={`mb-4 p-3 rounded ${addItemMessage.includes('successfully') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {addItemMessage}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter item name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="Service">Service</option>
                  <option value="Goods">Goods</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Measurement *</label>
                <select
                  value={newItemMeasurement}
                  onChange={(e) => setNewItemMeasurement(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="">Select Unit</option>
                  {predefinedUnits.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Unit (if not in list)</label>
                <input
                  type="text"
                  value={newItemCustomUnit}
                  onChange={(e) => setNewItemCustomUnit(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter custom unit"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Rate</label>
                <input
                  type="number"
                  value={newItemRate}
                  onChange={(e) => setNewItemRate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Percentage</label>
                <input
                  type="number"
                  value={newItemGstPercentage}
                  onChange={(e) => setNewItemGstPercentage(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                <input
                  type="text"
                  value={newItemHsnCode}
                  onChange={(e) => setNewItemHsnCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter HSN code"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                <input
                  type="number"
                  value={newItemPurchasePrice}
                  onChange={(e) => setNewItemPurchasePrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                <input
                  type="number"
                  value={newItemSalePrice}
                  onChange={(e) => setNewItemSalePrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                <input
                  type="number"
                  value={newItemCurrentStock}
                  onChange={(e) => setNewItemCurrentStock(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newItemIsActive}
                  onChange={(e) => setNewItemIsActive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active Item
                </label>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows="3"
                placeholder="Enter item description"
              />
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddItemModal(false); clearAddItemForm(); }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'} Saved Successfully!
              </h3>
              <p className="text-gray-600">What would you like to do next?</p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const bill = bills.find(b => b.id === savedBillId);
                  if (bill) {
                    setInvoiceBill({
                      ...bill,
                      companyDetails: company,
                      partyDetails: parties.find(p => p.id === bill.party) || {},
                      items: items
                    });
                    setShowInvoiceModal(true);
                  }
                  setShowSuccessModal(false);
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                </svg>
                Print {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}
              </button>
              
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                }}
                className="w-full bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Create New {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}
              </button>
              
              <button
                onClick={() => {
                  const bill = bills.find(b => b.id === savedBillId);
                  if (bill) {
                    handleEditBill(bill);
                  }
                  setShowSuccessModal(false);
                }}
                className="w-full bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Edit This {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    );
}

export default Sales; 