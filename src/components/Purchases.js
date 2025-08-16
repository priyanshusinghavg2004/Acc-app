import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, setDoc, deleteDoc, getDocs, query } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import BillTemplates from './BillTemplates';
import PurchaseBillTemplate from './BillTemplates/PurchaseBillTemplate';
import PurchaseOrderTemplate from './BillTemplates/PurchaseOrderTemplate';
import ReceiptTemplate from './BillTemplates/ReceiptTemplate';
import ActionButtons from './ActionButtons';
import ImageManager from './ImageManager';
import imageManager from '../utils/imageManager';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useTableSort, SortableHeader } from '../utils/tableSort';
import { useTablePagination } from '../utils/tablePagination';
import PaginationControls from '../utils/PaginationControls';
import { 
  getPartyAdvance, 
  allocateAdvanceToBill, 
  markAdvanceUsed 
} from '../utils/advanceUtils';
import { 
  StandardModal, 
  StandardButton, 
  ActionBar, 
  PreviewModal, 
  ConfirmationModal, 
  FormModal, 
  globalModalManager, 
  useModalManager 
} from './Modal';

const initialItemRow = {
  item: '',
  nos: 1,
  length: 0,
  height: 0,
  qty: 0,
  qtyExpr: '',
  qtyDisplay: '',
  lineDiscountType: 'amount',
  lineDiscountValue: 0,
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

// Utility for rounding to 2 decimal places
function round2(val) {
  return Math.round((parseFloat(val) + Number.EPSILON) * 100) / 100;
}

// Parse a quantity expression like "5x3x2" or "10*2" into a numeric product and a normalized display string
function parseQtyExpression(input) {
  const s = String(input || '').trim().replace(/\s+/g, '');
  if (!s) return { ok: false, value: 0, display: '' };
  const parts = s.split(/[xX\*]/).filter(Boolean);
  if (parts.length === 0) return { ok: false, value: 0, display: '' };
  let product = 1;
  for (const p of parts) {
    const n = Number(p);
    if (!isFinite(n) || n <= 0) return { ok: false, value: 0, display: '' };
    product *= n;
  }
  return { ok: true, value: product, display: parts.join('×') };
}

// ESC Key Functionality: Press ESC key to close modals in LIFO order (Last In, First Out)
// Order: Receipt Modal → Payment Details Modal → Payment Modal → Invoice Modal → View Modal → Success Modal → Image Manager
function Purchases({ db, userId, isAuthReady, appId }) {
  // Modal manager hook
  const { modals, openModal, closeModal, closeTopModal } = useModalManager();
  
  // URL parameter handling for document type selection
  const location = useLocation();
  
  // Document type: purchaseBill or purchaseOrder
  const [docType, setDocType] = useState(() => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const tabParam = urlParams.get('tab');
    if (tabParam === 'orders') return 'purchaseOrder';
    return 'purchaseBill';
  });
  const docTypeOptions = [
    { value: 'purchaseBill', label: 'PURCHASE BILL', collection: 'purchaseBills', numberLabel: 'Purchase Bill Number' },
    { value: 'purchaseOrder', label: 'PURCHASE ORDER', collection: 'purchaseOrders', numberLabel: 'Purchase Order Number' },
  ];

  // Bill state
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState(Array.from({ length: 5 }, () => ({ ...initialItemRow })));
  const [itemSearchTextByRow, setItemSearchTextByRow] = useState({});
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const escListenerRef = useRef();

  // Keep docType and edit/view ids in URL for deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const desiredTab = docType === 'purchaseOrder' ? 'orders' : 'bills';
    if (params.get('tab') !== desiredTab) params.set('tab', desiredTab);
    if (editingBillId) params.set('edit', editingBillId); else params.delete('edit');
    const base = window.location.hash.split('?')[0] || '#/purchases';
    const next = `${base}?${params.toString()}`;
    if (window.location.hash !== next) window.location.hash = next;
  }, [docType, editingBillId]);

  // On first load, if view/edit present open it
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const viewId = params.get('view');
    const editId = params.get('edit');
    if (viewId) {
      const collectionName = docType === 'purchaseOrder' ? 'purchaseOrders' : 'purchaseBills';
      getDoc(doc(db, `artifacts/${appId}/users/${userId}/${collectionName}`, viewId)).then(snap => {
        if (snap.exists()) { setViewBill({ id: snap.id, ...snap.data() }); setShowViewModal(true); }
      }).catch(() => {});
    }
    if (editId) setEditingBillId(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Payment Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [payments, setPayments] = useState([]);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState(null);

  // Payment Receipt Preview states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [receiptZoom, setReceiptZoom] = useState(1);
  const receiptRef = useRef();
  
  // Payment Details Modal states (for multiple receipts)
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedBillForReceipts, setSelectedBillForReceipts] = useState(null);
  
  // Image Management states
  const [showImageManager, setShowImageManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState({});

  // Table sorting hook with default sort by bill number descending (LIFO)
  const { sortConfig, handleSort, getSortedData } = useTableSort([], { key: 'billNumber', direction: 'desc' });
  const { currentPage, totalPages, handlePageChange, getPaginatedData } = useTablePagination(getSortedData(bills), 10);
  
  // Image management functions
  const handleImageSelect = (image) => {
    setSelectedImages(prev => ({
      ...prev,
      [image.category]: image
    }));
    setShowImageManager(false);
  };
  
  const loadSavedImages = async () => {
    try {
      const logo = await imageManager.getImagesByCategory('logo', userId);
      const seal = await imageManager.getImagesByCategory('seal', userId);
      const signature = await imageManager.getImagesByCategory('signature', userId);
      const qr = await imageManager.getImagesByCategory('qr', userId);
      
      setSelectedImages({
        logo: logo[0] || null,
        seal: seal[0] || null,
        signature: signature[0] || null,
        qr: qr[0] || null
      });
    } catch (error) {
      console.error('Error loading saved images:', error);
    }
  };
  
  // ESC Key Functionality: Press ESC key to close modals in LIFO order (Last In, First Out)
  // Order: Receipt Modal → Payment Details Modal → Payment Modal → Invoice Modal → View Modal → Success Modal → Image Manager
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        if (showReceiptModal) {
          setShowReceiptModal(false);
        } else if (showPaymentDetailsModal) {
          setShowPaymentDetailsModal(false);
        } else if (showPaymentModal) {
          setShowPaymentModal(false);
        } else if (showInvoiceModal) {
          setShowInvoiceModal(false);
        } else if (showViewModal) {
          setShowViewModal(false);
        } else if (showSuccessModal) {
          setShowSuccessModal(false);
        } else if (showImageManager) {
          setShowImageManager(false);
        }
      }
    };
    
    // Add event listener if any modal is open
    if (showReceiptModal || showPaymentDetailsModal || showPaymentModal || showInvoiceModal || showViewModal || showSuccessModal || showImageManager) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showReceiptModal, showPaymentDetailsModal, showPaymentModal, showInvoiceModal, showViewModal, showSuccessModal, showImageManager]);

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

  // Fetch payments
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const paymentsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/payments`));
      const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
        const paymentsData = [];
        snapshot.forEach((doc) => {
          paymentsData.push({ id: doc.id, ...doc.data() });
        });
        setPayments(paymentsData);
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId]);
  
  // Load saved images on component mount
  useEffect(() => {
    if (userId) {
      loadSavedImages();
    }
  }, [userId]);

  // Generate receipt number for purchase payments
  const generateReceiptNumber = async () => {
    const currentYear = new Date().getFullYear();
    const financialYear = `${currentYear.toString().slice(-2)}-${(currentYear + 1).toString().slice(-2)}`;
    const paymentType = 'P'; // Purchase payments
    
    try {
      const paymentsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/payments`));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      let highestSequence = 0;
      
      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data();
        if (payment.receiptNumber) {
          const regexPattern = new RegExp(`PR${paymentType}${financialYear.replace('-', '\\-')}\\/(\\d+)`);
          const match = payment.receiptNumber.match(regexPattern);
          
          if (match) {
            const sequence = parseInt(match[1]);
            if (sequence > highestSequence) {
              highestSequence = sequence;
            }
          }
        }
      });
      
      const nextSequence = highestSequence + 1;
      return `PR${paymentType}${financialYear}/${nextSequence}`;
    } catch (error) {
      console.error('Error generating receipt number:', error);
      return `PR${paymentType}${financialYear}/1`;
    }
  };

  // Get party name by ID
  const getPartyName = (partyId) => {
    const party = parties.find(p => p.id === partyId);
    return party ? (party.firmName || party.name) : 'Unknown Party';
  };

  // Calculate outstanding amount for a bill
  const getBillOutstanding = (bill) => {
    const billPayments = payments.filter(p => 
      p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
    );
    
    const totalPaid = billPayments.reduce((sum, payment) => {
      const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
      return sum + (allocation ? allocation.allocatedAmount : 0);
    }, 0);
    
    const totalAmount = parseFloat(bill.totalAmount || bill.amount) || 0;
    return totalAmount - totalPaid;
  };

  // Table pagination hook - placed after function definitions
  const sortedBills = getSortedData(bills.map((bill) => {
    const partyName = getPartyName(bill.party);
    const outstanding = getBillOutstanding(bill);
    const totalAmount = parseFloat(bill.totalAmount || bill.amount) || 0;
    const paid = totalAmount - outstanding;
    return {
      ...bill,
      partyName,
      paid: Math.max(0, paid),
      outstanding: Math.max(0, outstanding)
    };
  }));
  const pagination = useTablePagination(sortedBills, 10);

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
        // LIFO sorting is now handled by the pagination utility
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
    const prefixMap = { purchaseBill: 'PRB', purchaseOrder: 'PRO' };
    const prefix = prefixMap[docType] || 'PRB';
    const fy = getFinancialYear(billDate);
    const fyShort = fy.split('-').map(y => y.slice(-2)).join('-');
    const serials = bills
      .filter(bill => (bill.number || '').startsWith(prefix + fyShort))
      .map(bill => parseInt((bill.number || '').split('/')[1], 10))
      .filter(n => !isNaN(n));
    const nextSerial = (serials.length ? Math.max(...serials) : 0) + 1;
    setBillNumber(`${prefix}${fyShort}/${nextSerial}`);
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
    setRows(currentRows => {
      const updatedRows = currentRows.map((row, i) => {
        if (i !== idx) return row;
        let updated = { ...row, [field]: value };

        // Always keep gstPercent from item
        if (field === 'item') {
          let itemObj = items.find(it => it.id === value);
          updated.gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
          if (!updated.nos) updated.nos = 1;
          // Prefer last party-wise rate from purchase bills; fallback to item.purchasePrice
          const partyId = party;
          let defaultRate = 0;
          try {
            for (let bIndex = bills.length - 1; bIndex >= 0; bIndex -= 1) {
              const bill = bills[bIndex];
              if ((bill.partyId || bill.party) !== partyId) continue;
              const foundRow = (bill.rows || []).find(r => r.item === value);
              if (foundRow && foundRow.rate) { defaultRate = parseFloat(foundRow.rate) || 0; break; }
            }
          } catch (e) { /* no-op */ }
          if (!defaultRate && itemObj) {
            defaultRate = parseFloat(itemObj.purchasePrice || itemObj.rate || 0) || 0;
          }
          if (!updated.rate || updated.rate === 0) {
            updated.rate = defaultRate;
          }
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

        // Quantity calculation: prefer qty expression; fallback to Nos×Length×Height
        let itemObj = items.find(it => it.id === (field === 'item' ? value : row.item));
        const unit = itemObj ? itemObj.quantityMeasurement : '';
        const parsed = parseQtyExpression(updated.qtyExpr);
        let computedQty;
        if (parsed.ok) {
          computedQty = parsed.value;
          updated.qtyDisplay = parsed.display;
        } else {
          computedQty = (parseFloat(updated.nos) || 0) * (parseFloat(updated.length) || 1) * (parseFloat(updated.height) || 1);
          if (!updated.qtyExpr) {
            const a = parseFloat(updated.nos) || 0; const b = parseFloat(updated.length) || 1; const c = parseFloat(updated.height) || 1;
            updated.qtyDisplay = `${a}×${b}×${c}`;
          }
        }
        updated.qty = computedQty;
        // Keep nos in sync for legacy logic
        updated.nos = computedQty;
        // Apply per-line discount to amount
        const rawAmount = (parseFloat(updated.qty) || 0) * (parseFloat(updated.rate) || 0);
        let lineDiscAmt = 0;
        if ((updated.lineDiscountType || 'amount') === 'percent') {
          lineDiscAmt = rawAmount * ((parseFloat(updated.lineDiscountValue) || 0) / 100);
        } else {
          lineDiscAmt = parseFloat(updated.lineDiscountValue) || 0;
        }
        lineDiscAmt = Math.min(Math.max(lineDiscAmt, 0), rawAmount);
        updated.amount = round2(rawAmount - lineDiscAmt);
        // GST and total calculation
        const sgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.sgst) || 0) / 100;
        const cgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.cgst) || 0) / 100;
        const igstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.igst) || 0) / 100;
        updated.total = (parseFloat(updated.amount) || 0) + sgstAmt + cgstAmt + igstAmt;
        return updated;
      });

      // Auto-add trailing row logic
      const isRowNonEmpty = (r) => !!(r.item || (parseFloat(r.rate) || 0) || (r.qtyExpr && String(r.qtyExpr).trim()) || (parseFloat(r.qty) || 0) > 0 || (parseFloat(r.lineDiscountValue) || 0));
      const last = updatedRows[updatedRows.length - 1];
      if (isRowNonEmpty(last)) {
        updatedRows.push({ ...initialItemRow });
      }
      while (updatedRows.length < 5) updatedRows.push({ ...initialItemRow });
      return updatedRows;
    });
  };
  const addRow = () => setRows([...rows, { ...initialItemRow }]);
  const removeRow = idx => setRows(rows.filter((_, i) => i !== idx));



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
  const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
  const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
  const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
  const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;
    const billData = {
      number: billNumber,
      billDate,
      party,
      notes,
      rows,
      customFields,
      amount: grandTotal,
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
      let savedBill;
      if (editingBillId) {
        const billRef = doc(db, `artifacts/${appId}/users/${userId}/${selected.collection}`, editingBillId);
        await setDoc(billRef, billData, { merge: true });
        savedBill = { id: editingBillId, ...billData };
      } else {
        const docRef = await addDoc(collectionRef, billData);
        savedBill = { id: docRef.id, ...billData };
      }

      // --- ADVANCE ALLOCATION LOGIC ---
      // Only allocate advance for purchase bills (not purchase orders)
      if (docType === 'purchaseBill') {
        const availableAdvance = getPartyAdvance(party, payments);
        if (availableAdvance > 0) {
          const { allocatedAdvance, advanceAllocations, remainingBillAmount } = allocateAdvanceToBill(party, grandTotal, payments);
          if (allocatedAdvance > 0) {
            // Mark advances as used
            await markAdvanceUsed(advanceAllocations, db, appId, userId, payments);
            // Optionally, create a payment record for advance allocation
            const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
            await addDoc(paymentsRef, {
              receiptNumber: `ADV-${billNumber}`,
              paymentDate: new Date().toISOString().split('T')[0],
              partyId: party,
              partyName: parties.find(p => p.id === party)?.firmName || '',
              totalAmount: allocatedAdvance,
              paymentMode: 'Advance Allocation',
              reference: 'Auto-advance',
              notes: 'Advance automatically allocated to new purchase bill',
              type: 'purchase',
              paymentType: 'advance-allocation',
              billId: savedBill.id,
              billNumber: billNumber,
              allocations: [{
                billType: 'purchase',
                billId: savedBill.id,
                billNumber: billNumber,
                allocatedAmount: allocatedAdvance,
                billOutstanding: grandTotal,
                isFullPayment: allocatedAdvance >= grandTotal
              }],
              advanceAllocations,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      setBillNumber('');
      setBillDate(new Date().toISOString().split('T')[0]);
      setParty('');
      setNotes('');
      setRows(Array.from({ length: 5 }, () => ({ ...initialItemRow })));
      setCustomFields({ ewayBillNo: '', ewayQr: '', ewayDate: '' });
      setEditingBillId(null);
      setMessage('Bill saved successfully!');
      setShowSuccessModal(true);
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

  // Payment handling functions
  // Get bill payments for receipt preview
  const getBillPayments = (bill) => {
    return payments.filter(payment => {
      // Check if payment is for the same party
      const paymentPartyId = payment.partyId || payment.party;
      if (paymentPartyId !== bill.party) {
        return false;
      }
      
      // Special handling for advance receipts
      if (payment.receiptNumber && payment.receiptNumber.startsWith('ADV-')) {
        // Extract invoice number from advance receipt (e.g., ADV-PUR25-26/12 -> PUR25-26/12)
        const targetInvoiceNo = payment.receiptNumber.replace('ADV-', '');
        const currentInvoiceNo = bill.number || bill.invoiceNumber || bill.id;
        return targetInvoiceNo === currentInvoiceNo;
      }
      
      // Check if payment has allocations for this invoice
      if (payment.allocations && Array.isArray(payment.allocations)) {
        return payment.allocations.some(allocation => 
          allocation.billId === bill.id && allocation.billType === 'purchase'
        );
      }
      
      // Check if payment has advance allocations for this invoice
      if (payment.advanceAllocations && Array.isArray(payment.advanceAllocations)) {
        return payment.advanceAllocations.some(allocation => 
          allocation.billId === bill.id
        );
      }
      
      // Check direct billId match
      if (payment.billId === bill.id) {
        return true;
      }
      
      return false;
    });
  };

  // Handle payment receipt preview
  const handlePreviewReceipt = (payment) => {
    setSelectedPaymentForReceipt(payment);
    setShowReceiptModal(true);
  };

  // Handle payment receipt preview from bill
  const handleViewPaymentReceipts = (bill) => {
    const billPayments = getBillPayments(bill);
    if (billPayments.length > 0) {
      setSelectedBillForReceipts(bill);
      setShowPaymentDetailsModal(true);
    }
  };

  // Print receipt
  const printReceipt = () => {
    if (receiptRef.current) {
      const printContents = receiptRef.current.innerHTML;
      const printWindow = window.open('', '', 'height=800,width=1000');
      printWindow.document.write('<html><head><title>Payment Receipt</title>');
      printWindow.document.write('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss/dist/tailwind.min.css">');
      printWindow.document.write('<style>');
      printWindow.document.write('.print\\:hidden { display: none !important; }');
      printWindow.document.write('@media print { .print\\:hidden { display: none !important; } }');
      printWindow.document.write('.print\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }');
      printWindow.document.write('.print\\:bg-white { background-color: white !important; }');
      printWindow.document.write('.print\\:border { border-width: 1px !important; }');
      printWindow.document.write('.print\\:border-gray-300 { border-color: #d1d5db !important; }');
      printWindow.document.write('.print\\:flex-row { flex-direction: row !important; }');
      printWindow.document.write('.print\\:text-sm { font-size: 0.875rem !important; }');
      printWindow.document.write('.print\\:text-xs { font-size: 0.75rem !important; }');
      printWindow.document.write('.print\\:text-lg { font-size: 1.125rem !important; }');
      printWindow.document.write('.print\\:text-xl { font-size: 1.25rem !important; }');
      printWindow.document.write('.print\\:text-2xl { font-size: 1.5rem !important; }');
      printWindow.document.write('.print\\:font-bold { font-weight: 700 !important; }');
      printWindow.document.write('.print\\:font-semibold { font-weight: 600 !important; }');
      printWindow.document.write('.print\\:text-center { text-align: center !important; }');
      printWindow.document.write('.print\\:text-right { text-align: right !important; }');
      printWindow.document.write('.print\\:text-left { text-align: left !important; }');
      printWindow.document.write('.print\\:p-4 { padding: 1rem !important; }');
      printWindow.document.write('.print\\:p-2 { padding: 0.5rem !important; }');
      printWindow.document.write('.print\\:p-1 { padding: 0.25rem !important; }');
      printWindow.document.write('.print\\:m-4 { margin: 1rem !important; }');
      printWindow.document.write('.print\\:m-2 { margin: 0.5rem !important; }');
      printWindow.document.write('.print\\:m-1 { margin: 0.25rem !important; }');
      printWindow.document.write('.print\\:border-b { border-bottom-width: 1px !important; }');
      printWindow.document.write('.print\\:border-gray-300 { border-color: #d1d5db !important; }');
      printWindow.document.write('.print\\:w-full { width: 100% !important; }');
      printWindow.document.write('.print\\:h-auto { height: auto !important; }');
      printWindow.document.write('.print\\:max-w-none { max-width: none !important; }');
      printWindow.document.write('.print\\:shadow-none { box-shadow: none !important; }');
      printWindow.document.write('.print\\:bg-white { background-color: white !important; }');
      printWindow.document.write('.print\\:text-black { color: black !important; }');
      printWindow.document.write('.print\\:text-gray-800 { color: #1f2937 !important; }');
      printWindow.document.write('.print\\:text-gray-600 { color: #4b5563 !important; }');
      printWindow.document.write('.print\\:text-gray-500 { color: #6b7280 !important; }');
      printWindow.document.write('.print\\:text-blue-600 { color: #2563eb !important; }');
      printWindow.document.write('.print\\:text-green-600 { color: #16a34a !important; }');
      printWindow.document.write('.print\\:text-red-600 { color: #dc2626 !important; }');
      printWindow.document.write('.print\\:text-yellow-600 { color: #ca8a04 !important; }');
      printWindow.document.write('.print\\:text-purple-600 { color: #9333ea !important; }');
      printWindow.document.write('.print\\:text-pink-600 { color: #db2777 !important; }');
      printWindow.document.write('.print\\:text-indigo-600 { color: #4f46e5 !important; }');
      printWindow.document.write('.print\\:text-teal-600 { color: #0d9488 !important; }');
      printWindow.document.write('.print\\:text-orange-600 { color: #ea580c !important; }');
      printWindow.document.write('.print\\:text-cyan-600 { color: #0891b2 !important; }');
      printWindow.document.write('.print\\:text-lime-600 { color: #65a30d !important; }');
      printWindow.document.write('.print\\:text-emerald-600 { color: #059669 !important; }');
      printWindow.document.write('.print\\:text-rose-600 { color: #e11d48 !important; }');
      printWindow.document.write('.print\\:text-violet-600 { color: #7c3aed !important; }');
      printWindow.document.write('.print\\:text-fuchsia-600 { color: #c026d3 !important; }');
      printWindow.document.write('.print\\:text-sky-600 { color: #0284c7 !important; }');
      printWindow.document.write('.print\\:text-slate-600 { color: #475569 !important; }');
      printWindow.document.write('.print\\:text-zinc-600 { color: #52525b !important; }');
      printWindow.document.write('.print\\:text-neutral-600 { color: #525252 !important; }');
      printWindow.document.write('.print\\:text-stone-600 { color: #57534e !important; }');
      printWindow.document.write('.print\\:text-red-500 { color: #ef4444 !important; }');
      printWindow.document.write('.print\\:text-green-500 { color: #22c55e !important; }');
      printWindow.document.write('.print\\:text-blue-500 { color: #3b82f6 !important; }');
      printWindow.document.write('.print\\:text-yellow-500 { color: #eab308 !important; }');
      printWindow.document.write('.print\\:text-purple-500 { color: #a855f7 !important; }');
      printWindow.document.write('.print\\:text-pink-500 { color: #ec4899 !important; }');
      printWindow.document.write('.print\\:text-indigo-500 { color: #6366f1 !important; }');
      printWindow.document.write('.print\\:text-teal-500 { color: #14b8a6 !important; }');
      printWindow.document.write('.print\\:text-orange-500 { color: #f97316 !important; }');
      printWindow.document.write('.print\\:text-cyan-500 { color: #06b6d4 !important; }');
      printWindow.document.write('.print\\:text-lime-500 { color: #84cc16 !important; }');
      printWindow.document.write('.print\\:text-emerald-500 { color: #10b981 !important; }');
      printWindow.document.write('.print\\:text-rose-500 { color: #f43f5e !important; }');
      printWindow.document.write('.print\\:text-violet-500 { color: #8b5cf6 !important; }');
      printWindow.document.write('.print\\:text-fuchsia-500 { color: #d946ef !important; }');
      printWindow.document.write('.print\\:text-sky-500 { color: #0ea5e9 !important; }');
      printWindow.document.write('.print\\:text-slate-500 { color: #64748b !important; }');
      printWindow.document.write('.print\\:text-zinc-500 { color: #71717a !important; }');
      printWindow.document.write('.print\\:text-neutral-500 { color: #737373 !important; }');
      printWindow.document.write('.print\\:text-stone-500 { color: #78716c !important; }');
      printWindow.document.write('</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContents);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    }
  };

  // Generate PDF receipt
  const generatePDFReceipt = async () => {
    if (!selectedPaymentForReceipt) return;
    
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      alert('PDF generation library not available');
      return;
    }
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (2 * margin);
      let yPosition = margin;
      
      // Helper function to safely get text
      const safeText = (text) => text || '';
      
      // Add company logo if available
      if (selectedImages.logo && selectedImages.logo.data) {
        try {
          const logoImg = new Image();
          logoImg.src = selectedImages.logo.data;
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
          });
          
          const logoWidth = 30;
          const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
          const logoX = margin;
          const logoY = yPosition - 5;
          
          doc.addImage(selectedImages.logo.data, 'JPEG', logoX, logoY, logoWidth, logoHeight);
          yPosition += logoHeight + 5;
        } catch (error) {
          console.error('Error adding logo to PDF:', error);
        }
      }
      
      // Company details
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(safeText(company.firmName) || 'Company Name', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      if (safeText(company.address)) {
        doc.text(safeText(company.address), pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
      }
      if (safeText(company.city)) {
        doc.text(safeText(company.city), pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
      }
      if (safeText(company.gstin)) {
        doc.text(`GSTIN: ${safeText(company.gstin)}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
      }
      
      yPosition += 10;
      
      // Receipt title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('PAYMENT RECEIPT', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Receipt details
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      
      const receiptData = [
        ['Receipt Number:', safeText(selectedPaymentForReceipt.receiptNumber)],
        ['Date:', safeText(selectedPaymentForReceipt.paymentDate)],
        ['Party Name:', safeText(selectedPaymentForReceipt.partyName)],
        ['Payment Mode:', safeText(selectedPaymentForReceipt.paymentMode)],
        ['Amount:', `₹${(selectedPaymentForReceipt.totalAmount || 0).toLocaleString()}`],
      ];
      
      if (safeText(selectedPaymentForReceipt.reference)) {
        receiptData.push(['Reference:', safeText(selectedPaymentForReceipt.reference)]);
      }
      if (safeText(selectedPaymentForReceipt.notes)) {
        receiptData.push(['Notes:', safeText(selectedPaymentForReceipt.notes)]);
      }
      
      receiptData.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 50, yPosition);
        yPosition += 8;
      });
      
      // Allocations
      if (selectedPaymentForReceipt.allocations && selectedPaymentForReceipt.allocations.length > 0) {
        yPosition += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Payment Allocations:', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        selectedPaymentForReceipt.allocations.forEach((allocation, index) => {
          const billType = safeText(allocation.billType).toUpperCase();
          const billNumber = safeText(allocation.billNumber);
          const allocatedAmount = allocation.allocatedAmount || 0;
          doc.text(`${index + 1}. ${billType} ${billNumber}: ₹${allocatedAmount.toLocaleString()}`, margin + 5, yPosition);
          yPosition += 6;
        });
      }
      
      // Advance allocations
      if (selectedPaymentForReceipt.advanceAllocations && selectedPaymentForReceipt.advanceAllocations.length > 0) {
        yPosition += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Advance Allocations:', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        selectedPaymentForReceipt.advanceAllocations.forEach((advance, index) => {
          const amountUsed = advance.amountUsed || 0;
          doc.text(`${index + 1}. Advance Payment: ₹${amountUsed.toLocaleString()}`, margin + 5, yPosition);
          yPosition += 6;
        });
      }
      
      // Footer
      yPosition = pageHeight - 30;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Thank you for your payment!', pageWidth / 2, yPosition, { align: 'center' });
      
      // Save PDF with initials and compact date
      const fmt = (d) => {
        try { const x = new Date(d); const day = String(x.getDate()); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]; const yr = x.getFullYear(); return `${day}${mon}${yr}`; } catch { return d; }
      };
      const fileName = `REC_${safeText(selectedPaymentForReceipt.receiptNumber)}_${fmt(selectedPaymentForReceipt.paymentDate)}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleAddPayment = async (bill) => {
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('Cash');
    setPaymentReference('');
    setPaymentNotes('');
    setReceiptNumber('');
    
    // Generate receipt number
    const receiptNum = await generateReceiptNumber();
    setReceiptNumber(receiptNum);
    
    // Pre-fill with bill details
    setPaymentAmount(getBillOutstanding(bill).toString());
    
    // Store the bill information for payment
    setSelectedBillForPayment(bill);
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!selectedBillForPayment || !paymentAmount) {
      alert('Please fill in amount field.');
      return;
    }

    try {
      const paymentAmountNum = parseFloat(paymentAmount);
      const billOutstanding = getBillOutstanding(selectedBillForPayment);
      
      // Check if payment amount exceeds bill outstanding
      if (paymentAmountNum > billOutstanding) {
        alert(`Payment amount (₹${paymentAmountNum.toLocaleString('en-IN')}) cannot exceed the bill's outstanding amount (₹${billOutstanding.toLocaleString('en-IN')}). Please use the Payments page for amounts greater than the bill outstanding.`);
        return;
      }
      
      // First, try to allocate available advance
      const availableAdvance = getPartyAdvance(selectedBillForPayment.party, payments);
      let advanceAllocations = [];
      let advanceUsed = 0;
      let remainingPaymentAmount = paymentAmountNum;
      
      if (availableAdvance > 0) {
        // Allocate advance to this bill
        const advanceResult = allocateAdvanceToBill(selectedBillForPayment.party, billOutstanding, payments);
        if (advanceResult.allocatedAdvance > 0) {
          advanceAllocations = advanceResult.advanceAllocations;
          advanceUsed = advanceResult.allocatedAdvance;
          remainingPaymentAmount = paymentAmountNum - advanceUsed;
          
          // Mark advances as used
          if (Array.isArray(advanceResult.advanceAllocations) && advanceResult.advanceAllocations.length > 0) {
            await markAdvanceUsed(advanceResult.advanceAllocations, db, appId, userId, payments);
          }
        }
      }
      
      // Simple bill payment - no excess amount handling since it's restricted above
      const paymentData = {
        receiptNumber: receiptNumber,
        paymentDate: paymentDate,
        partyId: selectedBillForPayment.party,
        partyName: getPartyName(selectedBillForPayment.party),
        totalAmount: paymentAmountNum,
        paymentMode: paymentMode,
        reference: paymentReference,
        notes: paymentNotes,
        type: 'purchase',
        paymentType: 'bill',
        billId: selectedBillForPayment.id,
        billNumber: selectedBillForPayment.number,
        allocations: [{
          billType: 'purchase',
          billId: selectedBillForPayment.id,
          billNumber: selectedBillForPayment.number,
          allocatedAmount: paymentAmountNum,
          billOutstanding: billOutstanding,
          isFullPayment: paymentAmountNum >= billOutstanding
        }],
        remainingAmount: 0, // No remaining amount since payment cannot exceed bill outstanding
        fifoAllocationUsed: 0,
        advanceAllocations: advanceAllocations,
        advanceUsed: advanceUsed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add to payments collection
      const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
      await addDoc(paymentsRef, paymentData);
      
      // Reset payment form
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Cash');
      setPaymentReference('');
      setPaymentNotes('');
      setReceiptNumber('');
      setSelectedBillForPayment(null);
      setShowPaymentModal(false);
      
      alert('Payment added successfully!');
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment. Please try again.');
    }
  };

  // Totals
  const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
  const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
      const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
    const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;

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
        const fmt = (d) => { try { const x = new Date(d); const day = String(x.getDate()); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]; const yr = x.getFullYear(); return `${day}${mon}${yr}`; } catch { return d; } };
        html2pdf.default().from(tempContainer).set({
          margin: 0.5,
          filename: `PURCHASE_${invoiceBill?.number || 'Bill'}_${fmt(invoiceBill?.billDate || invoiceBill?.date)}.pdf`,
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold uppercase">{docTypeOptions.find(opt => opt.value === docType)?.label || 'PURCHASE BILL'}</h2>
          <button
            onClick={() => setShowImageManager(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all duration-200"
          >
            Manage Images
          </button>
        </div>
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
        <h3 id="purchase-items-title" className="text-xl font-bold text-gray-800 mb-2">Items</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                <th className="px-2 py-1">ITEM</th>
                <th className="px-2 py-1">MEASUREMENT / NUMBERS</th>
                <th className="px-2 py-1">QTY</th>
                <th className="px-2 py-1">RATE</th>
                <th className="px-2 py-1">DISCOUNT</th>
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
                      <div className="relative">
                        <input
                          type="text"
                          list={`p-items-list-${idx}`}
                          className="border border-gray-300 rounded-md p-1 w-48"
                          placeholder="Select Item"
                          value={
                            itemSearchTextByRow[idx] !== undefined
                              ? itemSearchTextByRow[idx]
                              : (items.find(it => it.id === row.item)?.itemName || '')
                          }
                          onChange={(e) => {
                            const text = e.target.value;
                            setItemSearchTextByRow(prev => ({ ...prev, [idx]: text }));
                            const lower = text.toLowerCase();
                            const match = items.find(it =>
                              (it.itemName || '').toLowerCase() === lower ||
                              (it.code || '').toLowerCase() === lower ||
                              (it.hsn || it.hsnCode || '').toLowerCase() === lower
                            );
                            if (match) {
                              handleRowChange(idx, 'item', match.id);
                              setItemSearchTextByRow(prev => ({ ...prev, [idx]: match.itemName }));
                            }
                          }}
                          onBlur={(e) => {
                            const text = e.target.value;
                            const lower = text.toLowerCase();
                            const match = items.find(it =>
                              (it.itemName || '').toLowerCase().startsWith(lower) ||
                              (it.code || '').toLowerCase().startsWith(lower) ||
                              (it.hsn || it.hsnCode || '').toLowerCase().startsWith(lower)
                            );
                            if (match) {
                              handleRowChange(idx, 'item', match.id);
                              setItemSearchTextByRow(prev => ({ ...prev, [idx]: match.itemName }));
                            }
                          }}
                        />
                        <datalist id={`p-items-list-${idx}`}>
                          {items.slice(0, 200).map(it => (
                            <option key={it.id} value={it.itemName} />
                          ))}
                        </datalist>
                      </div>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-col">
                      <input
                        type="text"
                        value={row.qtyExpr}
                        onChange={e => handleRowChange(idx, 'qtyExpr', e.target.value)}
                        placeholder="e.g. 5x3x2 or 10*2"
                        className="border border-gray-300 rounded-md p-1 w-40"
                      />
                      {row.qtyDisplay && (
                        <span className="text-xs text-gray-500 mt-1">= {row.qty} ({row.qtyDisplay})</span>
                      )}
                    </div>
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
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={row.lineDiscountValue}
                        onChange={e => handleRowChange(idx, 'lineDiscountValue', e.target.value)}
                        className="border border-gray-300 rounded-md p-1 w-20"
                        placeholder={row.lineDiscountType === 'percent' ? 'Percent' : 'Amount'}
                      />
                      <select
                        value={row.lineDiscountType || 'amount'}
                        onChange={e => handleRowChange(idx, 'lineDiscountType', e.target.value)}
                        className="border border-gray-300 rounded-md p-1"
                      >
                        <option value="amount">₹</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
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

                <div className="flex gap-4 mt-4">
                    <button id="save-purchase-button"
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
                setCustomFields({ ewayBillNo: '', ewayQr: '', ewayDate: '' });
              }}
                            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Cancel Edit
                        </button>
                    )}
          {editingBillId && (
                        <button
              onClick={() => handleAddPayment(bills.find(b => b.id === editingBillId))}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Add Payment
                        </button>
                    )}
                </div>
        <h3 id="purchases-list-title" className="text-xl font-bold text-gray-800 mt-8 mb-4">Recent Bills</h3>
        {bills.length === 0 ? (
          <div className="text-center text-gray-500 py-4">No bills yet. Create your first bill above!</div>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortableHeader columnKey="number" label="Invoice Number" onSort={handleSort} sortConfig={sortConfig} />
                                    <SortableHeader columnKey="billDate" label="Date" onSort={handleSort} sortConfig={sortConfig} />
                                    <SortableHeader columnKey="party" label="Party" onSort={handleSort} sortConfig={sortConfig} />
                                    <SortableHeader columnKey="amount" label="Total Amount" onSort={handleSort} sortConfig={sortConfig} />
                                    <SortableHeader columnKey="paid" label="Paid" onSort={handleSort} sortConfig={sortConfig} />
                                    <SortableHeader columnKey="outstanding" label="Outstanding" onSort={handleSort} sortConfig={sortConfig} />
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                {pagination.currentData.map((bill) => (
                                    <tr key={bill.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.number}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.billDate}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.partyName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.amount}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-green-600 font-medium">₹{(bill.paid || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600 font-medium">₹{(bill.outstanding || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <ActionButtons
                        actions={[
                          { type: 'view', onClick: () => handleViewBill(bill) },
                          { type: 'edit', onClick: () => handleEditBill(bill) },
                          { type: 'delete', onClick: () => handleDeleteBill(bill.id) },
                          { type: 'payment', onClick: () => handleAddPayment(bill) },
                          {
                            type: 'receipts',
                            onClick: () => handleViewPaymentReceipts(bill),
                            count: getBillPayments(bill).length,
                            receiptNumbers: getBillPayments(bill).map(payment => payment.receiptNumber)
                          },
                          {
                            type: docType === 'purchaseBill' ? 'purchaseBill' : 'purchaseOrder',
                            onClick: () => {
                          setInvoiceBill({
                            ...bill,
                            companyDetails: company,
                            partyDetails: parties.find(p => p.id === bill.party) || {},
                            items: (bill.rows || bill.items || []).map(row => {
                              const itemMaster = items.find(it => it.id === row.item);
                              return {
                                ...row,
                                description: itemMaster?.itemName || '',
                                hsn: itemMaster?.hsnCode || '',
                              };
                            }),
                            date: bill.billDate || bill.date || '',
                            logoUrl: company.logoUrl || '',
                          });
                          setShowInvoiceModal(true);
                            }
                          }
                        ]}
                      />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* Pagination Controls */}
                        <PaginationControls {...pagination} />
                    </div>
                )}
            </div>
            {showInvoiceModal && invoiceBill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-0 max-w-full w-[98vw] h-[98vh] flex flex-col relative overflow-hidden">
            <div className="flex-1 overflow-auto flex justify-center items-center bg-gray-50 print:bg-white" onWheel={handleInvoiceWheel} style={{ minHeight: 0, paddingTop: invoiceZoom < 1 ? `${(1-invoiceZoom)*120}px` : '0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
                <div ref={invoiceRef} style={{ transform: `scale(${invoiceZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s', background: 'white', boxShadow: '0 0 8px #ccc', margin: '0 auto' }} className="print:shadow-none print:bg-white print:transform-none">
                  {docType === 'purchaseBill' ? (
                    <PurchaseBillTemplate
                      billData={invoiceBill}
                      companyDetails={{ ...company, gstinType: company.gstinType || '', logoUrl: company.logoUrl || '' }}
                      partyDetails={parties.find(p => p.id === invoiceBill.party) || {}}
                      payments={invoiceBill.payments || []}
                    />
                  ) : docType === 'purchaseOrder' ? (
                    <PurchaseOrderTemplate
                      billData={invoiceBill}
                      companyDetails={{ ...company, gstinType: company.gstinType || '', logoUrl: company.logoUrl || '' }}
                      partyDetails={parties.find(p => p.id === invoiceBill.party) || {}}
                      payments={invoiceBill.payments || []}
                    />
                  ) : (
                    <BillTemplates db={db} userId={userId} isAuthReady={isAuthReady} appId={appId} billOverride={invoiceBill} companyDetails={{ ...company, gstinType: company.gstinType || '' }} />
                  )}
                </div>
              </div>
            </div>
            <div className="w-full flex justify-center print:hidden mt-4">
              <div className="flex flex-row items-center gap-3 bg-white rounded-lg shadow-md px-4 py-2">
                <button className="bg-blue-600 text-white px-3 py-1 rounded print:hidden" onClick={handleInvoicePrint}>Print</button>
                <button className="bg-green-600 text-white px-3 py-1 rounded print:hidden" onClick={handleInvoiceDownload}>Save as PDF</button>
                <button className="bg-gray-400 text-white px-3 py-1 rounded print:hidden" onClick={() => setShowInvoiceModal(false)}>Close</button>
                <button className="bg-gray-200 text-gray-800 px-2 py-1 rounded ml-4 print:hidden" onClick={() => setInvoiceZoom(z => Math.max(0.5, z - 0.1))}>-</button>
                <span className="px-2 print:hidden">{Math.round(invoiceZoom * 100)}%</span>
                <button className="bg-gray-200 text-gray-800 px-2 py-1 rounded print:hidden" onClick={() => setInvoiceZoom(z => Math.min(2, z + 0.1))}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showViewModal && viewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <div className="absolute top-2 right-2 flex items-center space-x-2">
              <span className="text-xs text-gray-500">Press ESC to close</span>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            </div>
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
                    <li key={i}>{itemName} (Qty: {row.qty}, Rate: ₹{row.rate})</li>
                  );
                })}
              </ul>
            </div>
                    </div>
                </div>
            )}
            {showSuccessModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
                  <div className="absolute top-2 right-2 flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Press ESC to close</span>
                    <button onClick={() => setShowSuccessModal(false)} className="text-gray-500 hover:text-gray-800 text-xl">&times;</button>
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-center">Success!</h3>
                  <p className="text-center text-gray-700 mb-4">Your {docType} has been saved successfully.</p>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowSuccessModal(false)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <div className="absolute top-2 right-2 flex items-center space-x-2">
              <span className="text-xs text-gray-500">Press ESC to close</span>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="text-gray-500 hover:text-gray-800 text-xl"
              >
                &times;
              </button>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Payment</h3>
            
            {/* Bill Information */}
            {selectedBillForPayment && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-2">Bill Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Bill Number:</span> {selectedBillForPayment.number}</div>
                  <div><span className="font-medium">Party:</span> {getPartyName(selectedBillForPayment.party)}</div>
                  <div><span className="font-medium">Total Amount:</span> ₹{selectedBillForPayment.amount?.toLocaleString()}</div>
                  <div><span className="font-medium">Outstanding:</span> ₹{getBillOutstanding(selectedBillForPayment).toLocaleString()}</div>
                </div>
              </div>
            )}
            
            {/* Advance Information */}
            {selectedBillForPayment && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-green-800 mb-2">Advance Information</h4>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Available Advance:</span> ₹{getPartyAdvance(selectedBillForPayment.party, payments).toLocaleString()}</div>
                  <div className="text-xs text-green-600">
                    Note: If payment amount exceeds bill outstanding, excess will be allocated to other bills using FIFO (First-In, First-Out) method.
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  readOnly
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Enter payment amount"
                  step="0.01"
                  min="0"
                />
                {selectedBillForPayment && paymentAmount && (
                  <div className="mt-1 text-xs text-gray-600">
                    <div>Bill Outstanding: ₹{getBillOutstanding(selectedBillForPayment).toLocaleString()}</div>
                    <div>Available Advance: ₹{getPartyAdvance(selectedBillForPayment.party, payments).toLocaleString()}</div>
                    <div className="font-medium text-blue-600">
                      Actual payment needed: ₹{Math.max(0, getBillOutstanding(selectedBillForPayment) - getPartyAdvance(selectedBillForPayment.party, payments)).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  placeholder="Cheque number, UPI reference, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  rows="3"
                  placeholder="Additional notes"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedBillForPayment(null);
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal && selectedBillForReceipts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Payment Receipts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {docType === 'purchaseBill' ? 'Purchase Bill' : 'Purchase Order'}: {selectedBillForReceipts.number} | 
                  Party: {getPartyName(selectedBillForReceipts.party)} | 
                  Total Amount: ₹{(selectedBillForReceipts.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Press ESC to close</span>
                <button
                  onClick={() => setShowPaymentDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Payment Summary */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Total Bill Amount:</span>
                  <span className="ml-2 text-lg font-semibold">₹{(selectedBillForReceipts.amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Total Paid:</span>
                  <span className="ml-2 text-lg font-semibold text-green-600">₹{(selectedBillForReceipts.paid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Outstanding:</span>
                  <span className="ml-2 text-lg font-semibold text-red-600">₹{(selectedBillForReceipts.outstanding || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PAYMENT RECEIPT NO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AGAINST {docType === 'purchaseBill' ? 'PURCHASE BILL' : 'PURCHASE ORDER'}
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
                  {getBillPayments(selectedBillForReceipts).map((payment) => {
                    const allocation = payment.allocations.find(a => a.billId === selectedBillForReceipts.id && a.billType === 'purchase');
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
                          {payment.paymentDate}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.paymentMode}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedPaymentForReceipt(payment);
                                setShowReceiptModal(true);
                                setShowPaymentDetailsModal(false);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Preview
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

      {/* Payment Receipt Preview Modal */}
      <PreviewModal
        isOpen={showReceiptModal && selectedPaymentForReceipt}
        onClose={() => setShowReceiptModal(false)}
        title="Payment Receipt Preview"
        showBackButton={true}
        onBack={() => {
          setShowReceiptModal(false);
          setShowPaymentDetailsModal(true);
        }}
        showPrintButton={true}
        onPrint={printReceipt}
        showPdfButton={true}
        onPdf={generatePDFReceipt}
        maxWidth="max-w-4xl"
        maxHeight="max-h-[90vh]"
        zIndex="z-50"
      >
        <div ref={receiptRef} className="flex justify-center">
          <ReceiptTemplate
            receipt={{
              totalAmount: selectedPaymentForReceipt?.totalAmount,
              date: selectedPaymentForReceipt?.paymentDate,
              mode: selectedPaymentForReceipt?.paymentMode,
              reference: selectedPaymentForReceipt?.reference,
              notes: selectedPaymentForReceipt?.notes,
              billReference: selectedPaymentForReceipt?.billId,
              allocations: selectedPaymentForReceipt?.allocations,
              advanceAllocations: selectedPaymentForReceipt?.advanceAllocations,
              fifoAllocationUsed: selectedPaymentForReceipt?.fifoAllocationUsed,
              remainingAmount: selectedPaymentForReceipt?.remainingAmount
            }}
            bill={{
              number: selectedPaymentForReceipt?.billNumber,
              invoiceNumber: selectedPaymentForReceipt?.billNumber,
              billNumber: selectedPaymentForReceipt?.billNumber
            }}
            company={company}
            party={{ firmName: selectedPaymentForReceipt?.partyName }}
            receiptNumber={selectedPaymentForReceipt?.receiptNumber}
            fifoAllocation={selectedPaymentForReceipt?.allocations}
            customImages={selectedImages}
          />
        </div>
      </PreviewModal>

      {/* Image Manager Modal */}
      <ImageManager
        userId={userId}
        onImageSelect={handleImageSelect}
        showModal={showImageManager}
        onClose={() => setShowImageManager(false)}
      />

    </div>
    );
}

export default Purchases; 