import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, setDoc, deleteDoc, getDocs, query } from 'firebase/firestore';

import BillTemplates from './BillTemplates';
import InvoiceTemplate from './BillTemplates/InvoiceTemplate';
import ChallanTemplate from './BillTemplates/ChallanTemplate';
import QuotationTemplate from './BillTemplates/QuotationTemplate';
import ReceiptTemplate from './BillTemplates/ReceiptTemplate';
import ActionButtons from './ActionButtons';

import { useLocation } from 'react-router-dom';
import ShareButton from './Reports/ShareButton';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../firebase.config';
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
import imageManager from '../utils/imageManager';

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
// Order: Receipt Modal → Payment Details Modal → Payment Modal → Invoice Modal → View Modal → Success Modal → Add Item Modal
function Sales({ db, userId, isAuthReady, appId }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState(Array.from({ length: 5 }, () => ({ ...initialItemRow })));
  // Local text for item combobox per row (do NOT persist)
  const [itemSearchTextByRow, setItemSearchTextByRow] = useState({});

  // Modal management
  const { modals, openModal, closeModal, closeTopModal } = useModalManager();

  // Live data states
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [salesBills, setSalesBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [company, setCompany] = useState({});
  const [bills, setBills] = useState([]);



  // Remove template selection, always use SunriseTemplate
  // Remove print-related state and function
  // Remove: const [showPrint, setShowPrint] = useState(false);
  // Remove: const handlePrint = () => { ... }
  // Remove print area and print button from the return JSX
  
  // ADD ITEM Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  
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
  
  // Image management states
  const [selectedImages, setSelectedImages] = useState({
    logo: null,
    seal: null,
    signature: null,
    qr: null
  });
  
  // Payment Details Modal states (for multiple receipts)
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedBillForReceipts, setSelectedBillForReceipts] = useState(null);
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
  const [showFilters, setShowFilters] = useState(false);
  
  // Add state for document type (Invoice, Challan, Quotation)
  const [docType, setDocType] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const t = params.get('type');
      return ['invoice','challan','quotation'].includes(t) ? t : 'invoice';
    } catch { return 'invoice'; }
  }); // 'invoice', 'challan', 'quotation'
  const docTypeOptions = [
    { value: 'invoice', label: 'INVOICE', collection: 'salesBills', numberLabel: 'Invoice Number' },
    { value: 'challan', label: 'CHALLAN', collection: 'challans', numberLabel: 'Challan Number' },
    { value: 'quotation', label: 'QUOTATION', collection: 'quotations', numberLabel: 'Quotation Number' },
  ];



  // Add state to track GST type for each row (for UI feedback)
  const [gstTypes, setGstTypes] = useState(rows.map(() => ''));

  // Add state for editing bill
  const [editingBillId, setEditingBillId] = useState(null);

  // Sync docType and view bill to URL for deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (params.get('type') !== docType) params.set('type', docType);
    if (editingBillId) params.set('edit', editingBillId); else params.delete('edit');
    const base = window.location.hash.split('?')[0];
    const next = `${base}?${params.toString()}`;
    if (window.location.hash !== next) window.location.hash = next;
  }, [docType, editingBillId]);

  // On mount, open view/edit if URL has ids
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const viewId = params.get('view');
    const editId = params.get('edit');
    if (viewId) {
      const selected = docTypeOptions.find(opt => opt.value === docType);
      if (selected) {
        getDoc(doc(db, `artifacts/${appId}/users/${userId}/${selected.collection}`, viewId)).then(snap => {
          if (snap.exists()) { setViewBill({ id: snap.id, ...snap.data() }); setShowViewModal(true); }
        }).catch(() => {});
      }
    }
    if (editId) setEditingBillId(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add state for custom fields
  const [customFields, setCustomFields] = useState({ ewayBillNo: '', ewayQr: '', ewayDate: '' });

  // Add at the top:
  const [errorMessage, setErrorMessage] = useState('');

  // Legacy bill-level discount (kept for backward compatibility in saved bills)
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');

  const [quotationTermsOverride, setQuotationTermsOverride] = useState('');

  // Table sorting hook with default sort by bill number descending (LIFO)
  const { sortConfig, handleSort, getSortedData } = useTableSort([], { key: 'number', direction: 'desc' });

  const location = useLocation();

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

  // Generate receipt number for sales payments
  const generateReceiptNumber = async () => {
    const currentYear = new Date().getFullYear();
    const financialYear = `${currentYear.toString().slice(-2)}-${(currentYear + 1).toString().slice(-2)}`;
    const paymentType = docType === 'invoice' ? 'I' : docType === 'challan' ? 'C' : 'Q';
    
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
      p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === docType)
    );
    
    const totalPaid = billPayments.reduce((sum, payment) => {
      const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === docType);
      return sum + (allocation ? allocation.allocatedAmount : 0);
    }, 0);
    
    const totalAmount = parseFloat(bill.totalAmount || bill.amount) || 0;
    return totalAmount - totalPaid;
  };

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
        // LIFO sorting is now handled by the pagination utility
        setBills(arr);
      }, (error) => {
        console.error('Error fetching bills:', error);
        setBills([]);
      });
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, appId, docType]);

  // Auto-generate number for the selected type
  useEffect(() => {
    if (editingBillId) return; // Do not auto-generate when editing
    const prefixMap = { invoice: 'INV', challan: 'CHA', quotation: 'QUO' };
    const prefix = prefixMap[docType] || 'INV';
    const fy = getFinancialYear(invoiceDate);
    const fyShort = fy.split('-').map(y => y.slice(-2)).join('-');
    const serials = bills
      .filter(bill => (bill.number || '').startsWith(prefix + fyShort))
      .map(bill => parseInt((bill.number || '').split('/')[1], 10))
      .filter(n => !isNaN(n));
    const nextSerial = (serials.length ? Math.max(...serials) : 0) + 1;
    setInvoiceNumber(`${prefix}${fyShort}/${nextSerial}`);
  }, [invoiceDate, bills, docType, editingBillId]);

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
    setRows(currentRows => {
      const updatedRows = currentRows.map((row, i) => {
        if (i !== idx) return row;
        let updated = { ...row, [field]: value };

        // If editing an existing bill, never map GST fields from item master, even if other fields change
        if (editingBillId && field !== 'item') {
          // Only update the changed field and recalculate total using current GST values
          let itemObj = items.find(it => it.id === row.item);
          const unit = itemObj ? itemObj.quantityMeasurement : '';
          // Compute quantity from qtyExpr if present/valid; else fallback to Nos×Length×Height
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
          // Keep nos in sync for legacy stock logic
          updated.nos = computedQty;
          updated.amount = (parseFloat(updated.qty) || 0) * (parseFloat(updated.rate) || 0);
          // Compute effective amount after per-line discount
          const rawAmount = (parseFloat(updated.qty) || 0) * (parseFloat(updated.rate) || 0);
          let lineDiscAmt = 0;
          if ((updated.lineDiscountType || 'amount') === 'percent') {
            lineDiscAmt = rawAmount * ((parseFloat(updated.lineDiscountValue) || 0) / 100);
          } else {
            lineDiscAmt = parseFloat(updated.lineDiscountValue) || 0;
          }
          lineDiscAmt = Math.min(Math.max(lineDiscAmt, 0), rawAmount);
          updated.amount = round2(rawAmount - lineDiscAmt);

          // Always use the GST values already present in the row
          updated.sgst = row.sgst;
          updated.cgst = row.cgst;
          updated.igst = row.igst;
          const sgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(row.sgst) || 0) / 100;
          const cgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(row.cgst) || 0) / 100;
          const igstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(row.igst) || 0) / 100;
          updated.total = (parseFloat(updated.amount) || 0) + sgstAmt + cgstAmt + igstAmt;
          return updated;
        }

        // If user edits SGST, CGST, or IGST directly, update only that field and recalculate total
        if (["sgst", "cgst", "igst"].includes(field)) {
          const sgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.sgst) || 0) / 100;
          const cgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.cgst) || 0) / 100;
          const igstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.igst) || 0) / 100;
          updated.total = (parseFloat(updated.amount) || 0) + sgstAmt + cgstAmt + igstAmt;
          return updated;
        }

        // If item is changed (new bill or edit), fetch GST from item master
        if (field === 'item') {
          let itemObj = items.find(it => it.id === value);
          updated.gstPercent = itemObj ? (itemObj.gstPercentage || 0) : 0;
          // Default qty and rate on item select
          if (!updated.nos) updated.nos = 1;
          // Prefer last party-wise rate, else item sale price
          const partyId = party;
          let defaultRate = 0;
          try {
            // Search latest sales bill for this party and item
            for (let bIndex = salesBills.length - 1; bIndex >= 0; bIndex -= 1) {
              const bill = salesBills[bIndex];
              if ((bill.partyId || bill.party) !== partyId) continue;
              const foundRow = (bill.rows || []).find(r => r.item === value);
              if (foundRow && foundRow.rate) { defaultRate = parseFloat(foundRow.rate) || 0; break; }
            }
          } catch (e) { /* no-op */ }
          if (!defaultRate && itemObj) {
            defaultRate = parseFloat(itemObj.salePrice || itemObj.rate || 0) || 0;
          }
          if (!updated.rate || updated.rate === 0) {
            updated.rate = defaultRate;
          }
          const sellerGstin = company.gstin || '';
          const partyObj = parties.find(p => p.id === party);
          const buyerGstin = partyObj ? (partyObj.gstin || '') : '';
          if (sellerGstin && buyerGstin && sellerGstin.length >= 2 && buyerGstin.length >= 2) {
            if (sellerGstin.substring(0, 2) === buyerGstin.substring(0, 2)) {
              updated.sgst = updated.gstPercent / 2;
              updated.cgst = updated.gstPercent / 2;
              updated.igst = 0;
            } else {
              updated.sgst = 0;
              updated.cgst = 0;
              updated.igst = updated.gstPercent;
            }
          } else {
            updated.sgst = updated.gstPercent / 2;
            updated.cgst = updated.gstPercent / 2;
            updated.igst = 0;
          }
        }

        // For all other fields (new bill), preserve GST values and just recalculate total
        let itemObj = items.find(it => it.id === (field === 'item' ? value : row.item));
        const unit = itemObj ? itemObj.quantityMeasurement : '';
        // Compute quantity from qtyExpr if present/valid; else fallback to Nos×Length×Height
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
        // Keep nos in sync for legacy stock logic
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

      // Auto-add trailing row when user fills the last visible row
      const isRowNonEmpty = (r) => {
        return !!(r.item || (parseFloat(r.rate) || 0) || (r.qtyExpr && String(r.qtyExpr).trim()) || (parseFloat(r.qty) || 0) > 0 || (parseFloat(r.nos) || 0) > 1 || (parseFloat(r.length) || 0) || (parseFloat(r.height) || 0) || (parseFloat(r.lineDiscountValue) || 0));
      };
      const last = updatedRows[updatedRows.length - 1];
      if (isRowNonEmpty(last)) {
        updatedRows.push({ ...initialItemRow });
      }
      // Ensure at least 5 rows visible
      while (updatedRows.length < 5) updatedRows.push({ ...initialItemRow });

      return updatedRows;
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
        (filterAmount === '' || billAmount.includes(filterAmount))
      );
    });
  };

  // Table pagination hook - placed after function definitions
  const sortedBills = getSortedData(getFilteredBills().map((bill, idx) => {
    const partyName = getPartyName(bill.party);
    const outstanding = getBillOutstanding(bill);
    const totalAmount = parseFloat(bill.amount) || 0;
    const paid = totalAmount - outstanding;
    return {
      ...bill,
      partyName,
      paid: Math.max(0, paid),
      outstanding: Math.max(0, outstanding)
    };
  }));
  const pagination = useTablePagination(sortedBills, 10);

  // GST calculation logic
  const getRowsForCalculation = () => {
    if (company.gstinType !== 'Regular') {
      // For Composition and Unregistered, set all GST to 0
      return rows.map(row => ({ ...row, sgst: 0, cgst: 0, igst: 0 }));
    }
    return rows;
  };

  // With per-line discounts, subtotalBeforeDiscount is sum of line net amounts, and overall discount is derived
  const subtotalBeforeDiscount = getRowsForCalculation().reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const derivedDiscount = getRowsForCalculation().reduce((sum, row) => {
    const qty = parseFloat(row.qty) || 0;
    const rate = parseFloat(row.rate) || 0;
    const rawAmount = qty * rate;
    let disc = 0;
    if ((row.lineDiscountType || 'amount') === 'percent') {
      disc = rawAmount * ((parseFloat(row.lineDiscountValue) || 0) / 100);
    } else {
      disc = parseFloat(row.lineDiscountValue) || 0;
    }
    disc = Math.min(Math.max(disc, 0), rawAmount);
    return sum + disc;
  }, 0);
  const discount = derivedDiscount; // for display
  const discountedSubtotal = Math.max(0, subtotalBeforeDiscount);
  // No proportional adjustment needed; amounts are already net of line discounts
  const discountRatio = 0;
  const totalSGST = company.gstinType === 'Regular' ? round2(getRowsForCalculation().reduce((sum, row) => {
    const amt = parseFloat(row.amount) || 0;
    const effAmt = amt - (amt * discountRatio);
    return sum + (effAmt * (parseFloat(row.sgst) || 0) / 100);
  }, 0)) : 0;
  const totalCGST = company.gstinType === 'Regular' ? round2(getRowsForCalculation().reduce((sum, row) => {
    const amt = parseFloat(row.amount) || 0;
    const effAmt = amt - (amt * discountRatio);
    return sum + (effAmt * (parseFloat(row.cgst) || 0) / 100);
  }, 0)) : 0;
  const totalIGST = company.gstinType === 'Regular' ? round2(getRowsForCalculation().reduce((sum, row) => {
    const amt = parseFloat(row.amount) || 0;
    const effAmt = amt - (amt * discountRatio);
    return sum + (effAmt * (parseFloat(row.igst) || 0) / 100);
  }, 0)) : 0;
  const grandTotal = discountedSubtotal + totalSGST + totalCGST + totalIGST;

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
    // Remove empty placeholder rows before validation/save
    const cleanedRows = rows.filter((r) => {
      const hasItem = !!(r.item && String(r.item).trim());
      const hasNumbers = (parseFloat(r.qty) || 0) > 0 || (parseFloat(r.rate) || 0) > 0 || (parseFloat(r.amount) || 0) > 0 || (parseFloat(r.total) || 0) > 0 || (parseFloat(r.length) || 0) > 0 || (parseFloat(r.height) || 0) > 0 || ((parseFloat(r.nos) || 0) > 1);
      return hasItem || hasNumbers;
    });
    if (!party || cleanedRows.length === 0) {
      alert("Please select a party and add at least one item.");
      return;
    }
    // Validation logic for duplicate number and date/number order
    const allBillCollections = ['salesBills', 'challans', 'quotations', 'purchaseBills', 'purchaseOrders'];
    let allBills = [];
    for (const coll of allBillCollections) {
      const billsSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/${coll}`));
      billsSnap.forEach(doc => allBills.push({ ...doc.data(), id: doc.id, collection: coll }));
    }
    // 1. Check for duplicate number
    if (allBills.some(b => b.number === invoiceNumber && (editingBillId ? b.id !== editingBillId : true))) {
      setErrorMessage('Bill number already exists in another document. Please use a unique number.');
      return;
    }
    // 2. Gap/date check: allow if any bill in FY has the same date (match current doc type and FY)
    const fy = getFinancialYear(invoiceDate);
    const fyShort = String(fy)
      .split('-')
      .map(y => String(y).slice(-2))
      .join('-');
    const prefixMap = { invoice: 'INV', challan: 'CHA', quotation: 'QUO' };
    const typePrefix = prefixMap[docType] || 'INV';
    const fyBills = allBills.filter(b => (b.number || '').startsWith(typePrefix + fyShort));
    const thisSerial = parseInt((invoiceNumber || '').split('/')[1], 10);
    const thisDate = new Date(invoiceDate);
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
        return;
      }
      if (next && thisDate.getTime() > next.date.getTime()) {
        setErrorMessage(`Date must be on or before next bill (${next.serial}) date: ${next.date.toLocaleDateString()}`);
        return;
      }
    }
    // 2. Block if any lower bill number exists with a later date
    for (const b of fyBills) {
      if (!b.number || (!b.invoiceDate && !b.billDate)) continue;
      if (b.id === editingBillId) continue;
      const serial = parseInt((b.number || '').split('/')[1], 10);
      const date = new Date(b.invoiceDate || b.billDate);
      if (serial < thisSerial && date.getTime() > thisDate.getTime()) {
        setErrorMessage('A lower bill number exists with a later date. Please correct the date or number.');
        return;
      }
    }
    // 3. Block if any higher bill number exists with an earlier date
    for (const b of fyBills) {
      if (!b.number || (!b.invoiceDate && !b.billDate)) continue;
      if (b.id === editingBillId) continue;
      const serial = parseInt((b.number || '').split('/')[1], 10);
      const date = new Date(b.invoiceDate || b.billDate);
      if (serial > thisSerial && date.getTime() < thisDate.getTime()) {
        setErrorMessage('A higher bill number exists with an earlier date. Please correct the date or number.');
        return;
      }
    }
    const selected = docTypeOptions.find(opt => opt.value === docType);
    if (!selected) return;
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${selected.collection}`);
    const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
    const billData = {
      number: invoiceNumber,
      invoiceDate,
      party,
      notes,
      rows: cleanedRows,
      amount: grandTotal,
      createdAt: serverTimestamp(),
      customFields,
      discountType,
      discountValue,
    };
    if (docType === 'quotation') billData.quotationTermsOverride = quotationTermsOverride;
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
      // Only allocate advance for invoices (not quotations, etc.)
      if (docType === 'invoice') {
        const availableAdvance = getPartyAdvance(party, payments);
        if (availableAdvance > 0) {
          const { allocatedAdvance, advanceAllocations, remainingBillAmount } = allocateAdvanceToBill(party, grandTotal, payments);
          if (allocatedAdvance > 0) {
            // Mark advances as used
            await markAdvanceUsed(advanceAllocations, db, appId, userId, payments);
            // Optionally, create a payment record for advance allocation
            const paymentsRef = collection(db, `artifacts/${appId}/users/${userId}/payments`);
            await addDoc(paymentsRef, {
              receiptNumber: `ADV-${invoiceNumber}`,
              paymentDate: new Date().toISOString().split('T')[0],
              partyId: party,
              partyName: parties.find(p => p.id === party)?.firmName || '',
              totalAmount: allocatedAdvance,
              paymentMode: 'Advance Allocation',
              reference: 'Auto-advance',
              notes: 'Advance automatically allocated to new invoice',
              type: 'invoice',
              paymentType: 'advance-allocation',
              billId: savedBill.id,
              billNumber: invoiceNumber,
              allocations: [{
                billType: 'invoice',
                billId: savedBill.id,
                billNumber: invoiceNumber,
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

      // Update stock for each sold item
      if (docType === 'invoice') {
        for (const row of cleanedRows) {
          if (!row.item) continue;
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
      // Reset form and show 5 fresh rows
      setInvoiceNumber('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setParty('');
      setNotes('');
      setRows(Array.from({ length: 5 }, () => ({ ...initialItemRow })));
      setEditingBillId(null);
    } catch (err) {
      alert("Error saving invoice: " + err.message);
    }
  };

  // Modal and action state for View/Edit/Delete
  const [viewBill, setViewBill] = useState(null); // Bill to view in modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState(null); // Bill id being deleted
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Add import for BillTemplates and modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceBill, setInvoiceBill] = useState(null);

  // ESC Key Functionality: Press ESC key to close modals in LIFO order (Last In, First Out)
  // Order: Receipt Modal → Payment Details Modal → Payment Modal → Invoice Modal → View Modal → Success Modal → Add Item Modal
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
        } else if (showAddItemModal) {
          setShowAddItemModal(false);
          clearAddItemForm();
        }
      }
    };
    
    // Add event listener if any modal is open
    if (showReceiptModal || showPaymentDetailsModal || showPaymentModal || showInvoiceModal || showViewModal || showSuccessModal || showAddItemModal) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showReceiptModal, showPaymentDetailsModal, showPaymentModal, showInvoiceModal, showViewModal, showSuccessModal, showAddItemModal]);

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
    setNotes(bill.notes || '');
    // Always use GST values from bill.rows when editing
    setRows((bill.rows && bill.rows.length > 0) ? bill.rows.map(row => ({ ...row })) : [{ ...initialItemRow }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (bill.quotationTermsOverride !== undefined) setQuotationTermsOverride(bill.quotationTermsOverride);
    else setQuotationTermsOverride('');
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

  // Payment handling functions
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
        // Extract invoice number from advance receipt (e.g., ADV-INV25-26/12 -> INV25-26/12)
        const targetInvoiceNo = payment.receiptNumber.replace('ADV-', '');
        const currentInvoiceNo = bill.number || bill.invoiceNumber || bill.id;
        return targetInvoiceNo === currentInvoiceNo;
      }
      
      // Check if payment has allocations for this invoice
      if (payment.allocations && Array.isArray(payment.allocations)) {
        return payment.allocations.some(allocation => 
          allocation.billId === bill.id && allocation.billType === docType
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

  // Image management functions
  const handleImageSelect = (image) => {
    setSelectedImages(prev => ({
      ...prev,
      [image.category]: image.data
    }));
  };

  const loadSavedImages = async () => {
    try {
      const logoImages = await imageManager.getImagesByCategory('logo', userId);
      const sealImages = await imageManager.getImagesByCategory('seal', userId);
      const signatureImages = await imageManager.getImagesByCategory('signature', userId);
      const qrImages = await imageManager.getImagesByCategory('qr', userId);

      setSelectedImages({
        logo: logoImages.length > 0 ? logoImages[0].data : null,
        seal: sealImages.length > 0 ? sealImages[0].data : null,
        signature: signatureImages.length > 0 ? signatureImages[0].data : null,
        qr: qrImages.length > 0 ? qrImages[0].data : null
      });
    } catch (error) {
      console.error('Error loading saved images:', error);
    }
  };

  // Load saved images on component mount
  useEffect(() => {
    if (userId) {
      loadSavedImages();
    }
  }, [userId]);

  // Print receipt
  const printReceipt = () => {
    if (!selectedPaymentForReceipt) {
      alert('No receipt selected for printing');
      return;
    }

    if (!receiptRef.current) {
      alert('Receipt content not available');
      return;
    }

    const printContents = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'height=800,width=1000');
    
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt</title>
          <meta charset="utf-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .print-content { 
                width: 210mm; 
                height: 297mm; 
                margin: 0 auto; 
                background: white; 
                padding: 20mm;
                box-sizing: border-box;
              }
              .no-print { display: none !important; }
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #f5f5f5; 
            }
            .print-content { 
              background: white; 
              padding: 40px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 800px;
              margin: 0 auto;
            }
            .receipt-header { text-align: center; margin-bottom: 30px; }
            .receipt-title { font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
            .receipt-number { font-size: 18px; color: #2563eb; font-family: monospace; }
            .company-info { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #d1d5db; }
            .company-name { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 5px; }
            .company-details { font-size: 14px; color: #6b7280; }
            .receipt-details { margin-bottom: 30px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .detail-label { font-weight: 600; color: #374151; }
            .detail-value { font-size: 16px; }
            .amount { font-size: 24px; font-weight: bold; color: #16a34a; }
            .allocation-section { margin-top: 30px; }
            .allocation-title { font-weight: 600; color: #2563eb; margin-bottom: 15px; }
            .allocation-item { border: 1px solid #e5e7eb; border-radius: 4px; padding: 15px; margin-bottom: 10px; background: #f9fafb; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; align-items: flex-end; }
            .footer-left { font-size: 12px; color: #6b7280; }
            .signature { text-align: center; }
            .signature-line { border-top: 2px solid #9ca3af; width: 120px; margin: 0 auto 10px; }
            .signature-text { font-weight: 600; color: #374151; }
          </style>
        </head>
        <body>
          <div class="print-content">
            ${printContents}
          </div>
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Print</button>
            <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Close</button>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  };

  // Generate PDF receipt
  const generatePDFReceipt = async () => {
    if (!selectedPaymentForReceipt) {
      alert('No receipt selected for PDF generation');
      return;
    }
    
    // Check for jsPDF library
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF generation library not available. Please refresh the page and try again.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;
    
    // Helper function to get company name safely
    const getCompanyName = () => {
      if (company?.firmName) return company.firmName;
      if (company?.name) return company.name;
      if (company?.companyName) return company.companyName;
      return 'Company Name';
    };
    
    // Helper function to get party name safely
    const getPartyName = () => {
      if (selectedPaymentForReceipt?.partyName) return selectedPaymentForReceipt.partyName;
      if (selectedPaymentForReceipt?.party?.firmName) return selectedPaymentForReceipt.party.firmName;
      if (selectedPaymentForReceipt?.party?.name) return selectedPaymentForReceipt.party.name;
      return 'Party Name';
    };
    
    // Helper function to format date
    const formatDate = (dateField) => {
      if (!dateField) return 'Unknown date';
      if (typeof dateField === 'string') return dateField;
      if (dateField && typeof dateField === 'object' && dateField.seconds) {
        return new Date(dateField.seconds * 1000).toISOString().split('T')[0];
      } else if (dateField) {
        return new Date(dateField).toISOString().split('T')[0];
      }
      return 'Unknown date';
    };
    
    // Company details
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(getCompanyName(), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    // Add company logo if available
    if (selectedImages.logo) {
      try {
        const logoImg = new Image();
        logoImg.src = selectedImages.logo;
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        
        const logoWidth = 40;
        const logoHeight = 30;
        const logoX = (pageWidth - logoWidth) / 2;
        const logoY = yPosition - 35;
        
        doc.addImage(logoImg, 'JPEG', logoX, logoY, logoWidth, logoHeight);
        yPosition += 5;
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (company?.address) {
      doc.text(company.address, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    if (company?.gstin) {
      doc.text(`GSTIN: ${company.gstin}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    
    yPosition += 10;
    
    // Receipt title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('PAYMENT RECEIPT', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Receipt details
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    
    const receiptNumber = selectedPaymentForReceipt?.receiptNumber || 'N/A';
    const paymentDate = formatDate(selectedPaymentForReceipt?.date || selectedPaymentForReceipt?.paymentDate);
    const partyName = getPartyName();
    const paymentMode = selectedPaymentForReceipt?.mode || selectedPaymentForReceipt?.paymentMode || 'Cash';
    const amount = selectedPaymentForReceipt?.totalAmount || selectedPaymentForReceipt?.amount || 0;
    const reference = selectedPaymentForReceipt?.reference || '-';
    
    const receiptData = [
      ['Receipt Number:', receiptNumber],
      ['Date:', paymentDate],
      ['Party Name:', partyName],
      ['Payment Mode:', paymentMode],
      ['Amount:', `₹${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
      ['Reference:', reference],
    ];
    
    receiptData.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, margin, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(value, margin + 60, yPosition);
      yPosition += 8;
    });
    
    // Payment Allocations
    const allocations = selectedPaymentForReceipt?.allocations || [];
    if (allocations.length > 0) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Payment Allocations:', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      allocations.forEach((allocation, index) => {
        const billType = allocation?.billType?.toUpperCase() || 'INVOICE';
        const billNumber = allocation?.billNumber || allocation?.billId || 'N/A';
        const allocatedAmount = allocation?.allocatedAmount || 0;
        doc.text(`${index + 1}. ${billType} ${billNumber}: ₹${parseFloat(allocatedAmount).toLocaleString('en-IN')}`, margin + 5, yPosition);
        yPosition += 6;
      });
    }
    
    // Advance allocations
    const advanceAllocations = selectedPaymentForReceipt?.advanceAllocations || [];
    if (advanceAllocations.length > 0) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Advance Allocations:', margin, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      advanceAllocations.forEach((advance, index) => {
        const amountUsed = advance?.amountUsed || 0;
        doc.text(`${index + 1}. Advance Payment: ₹${parseFloat(amountUsed).toLocaleString('en-IN')}`, margin + 5, yPosition);
        yPosition += 6;
      });
    }
    
    // Footer
    yPosition = pageHeight - 40;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, margin, yPosition);
    
    // Signature area
    yPosition = pageHeight - 30;
    doc.text('Authorized Signatory', pageWidth - margin - 50, yPosition, { align: 'right' });
    
      // Save PDF with initials and compact date
      const fmt = (d) => {
        try { const x = new Date(d); const day = String(x.getDate()); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]; const yr = x.getFullYear(); return `${day}${mon}${yr}`; } catch { return d; }
      };
      const fileName = `REC_${receiptNumber.replace(/[^a-zA-Z0-9/]/g, '_')}_${fmt(paymentDate)}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
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
        type: docType,
        paymentType: 'bill',
        billId: selectedBillForPayment.id,
        billNumber: selectedBillForPayment.number,
        allocations: [{
          billType: docType,
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



  // For SunriseTemplate, ensure A4 size and fixed layout
  // Remove a4Style

  const [invoiceZoom, setInvoiceZoom] = useState(1);
  const invoiceRef = useRef();

  // Update handleInvoicePrint and handleInvoiceDownload to properly handle print:hidden elements:
  const handleInvoicePrint = () => {
    if (invoiceRef.current) {
      const temp = document.createElement('div');
      temp.innerHTML = invoiceRef.current.innerHTML;
      const inlineImages = async (root) => {
        const imgs = Array.from(root.querySelectorAll('img'));
        await Promise.all(imgs.map(async (img) => {
          try {
            const src = img.getAttribute('src');
            if (!src || src.startsWith('data:')) return;
            const proxied = src.startsWith('/img?') || src.includes('/img?') ? src : `${window.location.origin}/img?u=${encodeURIComponent(src)}`;
            const resp = await fetch(proxied, { mode: 'cors' });
            const blob = await resp.blob();
            const dataUrl = await new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
            img.setAttribute('src', dataUrl); img.removeAttribute('crossorigin');
          } catch (_) {}
        }));
      };
      // Inline images to avoid CORS issues during print
      // Note: printing will proceed after images are inlined
      // eslint-disable-next-line no-void
      void inlineImages(temp);
      const printContents = temp.innerHTML;
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
      printWindow.document.write('@media print { img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }');
      printWindow.document.write('</style>');
      printWindow.document.write('</head><body style="background:white;">');
      printWindow.document.write(printContents);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      // Ensure images are loaded before printing
      const ensureImages = () => {
        try {
          const imgs = Array.from(printWindow.document.images || []);
          imgs.forEach(img => { try { img.setAttribute('crossorigin', 'anonymous'); } catch (_) {} });
          if (imgs.length === 0) return Promise.resolve();
          return Promise.all(imgs.map(img => new Promise(resolve => {
            if (img.complete) return resolve();
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          })));
        } catch (_) {
          return Promise.resolve();
        }
      };
      printWindow.onload = async () => {
        await ensureImages();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 100);
      };
    }
  };

  const handleInvoiceDownload = () => {
    if (invoiceRef.current) {
      import('html2pdf.js').then(async html2pdf => {
        // Create a temporary container to clone the content and hide print:hidden elements
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = invoiceRef.current.innerHTML;
        
        // Hide elements with print:hidden class
        const hiddenElements = tempContainer.querySelectorAll('.print\\:hidden, [class*="print:hidden"]');
        hiddenElements.forEach(el => {
          el.style.display = 'none';
        });

        // Inline images to data URLs to bypass CORS
        const imgs = Array.from(tempContainer.querySelectorAll('img'));
        for (const img of imgs) {
          try {
            const src = img.getAttribute('src'); if (!src) continue;
            const proxied = src.startsWith('/img?') || src.includes('/img?') ? src : `${window.location.origin}/img?u=${encodeURIComponent(src)}`;
            const resp = await fetch(proxied, { mode: 'cors' }); const blob = await resp.blob();
            const dataUrl = await new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
            img.setAttribute('src', dataUrl); img.removeAttribute('crossorigin');
          } catch (_) {}
        }
        
        const fmt = (d) => { try { const x = new Date(d); const day = String(x.getDate()); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]; const yr = x.getFullYear(); return `${day}${mon}${yr}`; } catch { return d; } };
        const fy = (()=>{ try { const d = new Date(invoiceBill?.invoiceDate || invoiceBill?.date || new Date()); let y = d.getFullYear(); if (d.getMonth()<3) y-=1; return `${String(y).slice(-2)}-${String(y+1).slice(-2)}`; } catch { return ''; }})();
        const worker = html2pdf.default().from(tempContainer).set({
          margin: 0.5,
          filename: `${(docTypeOptions.find(opt => opt.value === docType)?.label || 'Invoice').toUpperCase()}_${invoiceBill?.number || 'Bill'}_${fmt(invoiceBill?.invoiceDate || invoiceBill?.date)}.pdf`,
          html2canvas: { scale: 2, useCORS: true, allowTaint: false },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        });
        // Generate blob for sharing
        const pdfBlob = await worker.outputPdf('blob');
        const shared = await shareBlobViaSystem(pdfBlob, `${(docTypeOptions.find(opt => opt.value === docType)?.label || 'Invoice')}_${invoiceBill?.number || 'Bill'}.pdf`, 'application/pdf');
        if (!shared) {
          // Fallback to saving locally as before
          await worker.save();
        }
      });
    }
  };

  // Share: link to open this bill directly in preview (same as reports flow)
  const handleInvoiceShareLink = async () => {
    try {
      if (!invoiceBill || !invoiceRef.current) return;
      // Render a static HTML for public viewing (no app chrome)
      const container = document.createElement('html');
      const head = document.createElement('head');
      head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Document</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss/dist/tailwind.min.css">';
      const body = document.createElement('body');
      const doc = document.createElement('div');
      doc.style.background = 'white';
      doc.style.margin = '0 auto';
      doc.style.padding = '0';
      doc.innerHTML = invoiceRef.current.innerHTML;
      // Strip interactive controls
      Array.from(doc.querySelectorAll('button')).forEach(b => b.remove());
      // Keep images as-is (reports flow keeps minimal HTML and uploads)
      body.appendChild(doc);
      container.appendChild(head);
      container.appendChild(body);

      const blob = new Blob([container.outerHTML || container.innerHTML], { type: 'text/html' });
      const storage = getStorage(app);
      const token = Math.random().toString(36).slice(2);
      const path = `publicDocs/${userId || 'anon'}/${invoiceBill.id}-${token}.html`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, blob, { contentType: 'text/html' });
      const storageUrl = await getDownloadURL(sref);
      const hostingBase = 'https://acctoo.com';
      const wrapped = `${hostingBase}/doc-viewer.html?u=${encodeURIComponent(storageUrl)}`;
      if (navigator.share) {
        await navigator.share({ title: (docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'), text: (docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'), url: wrapped });
      } else {
        await navigator.clipboard.writeText(wrapped);
        alert('Public link copied to clipboard');
      }
    } catch (e) {
      console.error('Share link failed:', e);
    }
  };

  // Share: Image (PNG attachment) same behavior as reports
  const handleInvoiceShareImage = async () => {
    try {
      if (!invoiceBill || !invoiceRef.current) return;
      const html2canvas = await import('html2canvas');
      const canvas = await html2canvas.default(invoiceRef.current, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const label = (docTypeOptions.find(opt => opt.value === docType)?.label || 'Document');
      const shared = await shareBlobViaSystem(blob, `${label}_${invoiceBill?.number || 'Bill'}.png`, 'image/png');
      if (!shared) {
        // fallback download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${label}_${invoiceBill?.number || 'Bill'}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Share image failed:', e);
    }
  };

  // Share: Excel (CSV attachment) same behavior as reports
  const handleInvoiceShareExcel = async () => {
    try {
      if (!invoiceBill) return;
      const label = (docTypeOptions.find(opt => opt.value === docType)?.label || 'Document');
      let csv = '';
      if (company?.firmName) csv += `${company.firmName}\n`;
      if (company?.address) csv += `${company.address}\n`;
      if (company?.gstin) csv += `GSTIN: ${company.gstin}\n`;
      csv += `\n${label},${invoiceBill?.number || ''}\n`;
      csv += `Date,${invoiceBill?.invoiceDate || invoiceBill?.date || ''}\n`;
      csv += '\nItems\n';
      const rows = (invoiceBill?.rows || invoiceBill?.items || []);
      csv += 'S.No,Item,Qty,Rate,Amount\n';
      rows.forEach((r, idx) => {
        const qty = r.quantity ?? r.qty ?? '';
        const rate = r.rate ?? r.price ?? '';
        const amount = r.amount ?? r.total ?? '';
        const name = r.description ?? r.itemName ?? '';
        csv += `${idx+1},"${String(name).replace(/"/g,'""')}",${qty},${rate},${amount}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const shared = await shareBlobViaSystem(blob, `${label}_${invoiceBill?.number || 'Bill'}.csv`, 'text/csv');
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${label}_${invoiceBill?.number || 'Bill'}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Share CSV failed:', e);
    }
  };

  const shareBlobViaSystem = async (blob, suggestedName, mime) => {
    try {
      const file = new File([blob], suggestedName, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: suggestedName, text: 'Sharing document' });
        return true;
      }
    } catch (_) {}
    return false;
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



  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const previewId = params.get('preview');
    if (previewId && bills.length > 0) {
      const bill = bills.find(b => b.id === previewId);
      if (bill) {
        setViewBill(bill); // or whatever state triggers your preview modal
        setShowViewModal(true);
      }
    }
  }, [location.search, bills]);





    return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-4 sm:py-8">
      {errorMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 sm:px-6 py-3 rounded shadow-lg z-50 flex items-center gap-4 max-w-[90vw]">
          <span className="text-sm sm:text-base">{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="ml-4 text-red-700 font-bold text-lg min-w-[44px] min-h-[44px] flex items-center justify-center">&times;</button>
        </div>
      )}
      <div className="w-full max-w-5xl mb-4 sm:mb-6 px-4 sm:px-0">
        <div className="flex flex-wrap gap-1 sm:gap-2 justify-center mb-4">
          {docTypeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDocType(opt.value)}
              className={`px-3 sm:px-6 py-2 rounded-t-lg font-bold text-sm sm:text-lg border-b-4 transition-all duration-200 min-h-[44px] ${
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
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 w-full max-w-5xl mx-4 sm:mx-0">
        <h2 id="sales-tabs" className="text-xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 uppercase">{docTypeOptions.find(opt => opt.value === docType)?.label || 'INVOICE'}</h2>
        {/* Remove print area (SunriseTemplate for printing) */}
        {/* Remove print button from the form actions */}
        {/* Hide form/table UI when printing - not needed */}
                    <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    <div>
              <label className="block text-sm font-medium text-gray-700">{numberLabel}</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 sm:p-2 text-base" />
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 sm:p-2 text-base" />
                    </div>
                    <div>
              <label className="block text-sm font-medium text-gray-700">Party (Buyer)</label>
              <select value={party} onChange={e => setParty(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 sm:p-2 text-base">
                <option value="">Select Party</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.firmName}</option>)}
                        </select>
                    </div>
                    {/* Remove Payment Status dropdown from the top form section */}
                    </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
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
          <h3 id="invoice-items-title" className="text-xl font-bold text-gray-800 mb-2">Invoice Items</h3>
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
                  {company.gstinType === 'Regular' && <th className="px-2 py-1">SGST</th>}
                  {company.gstinType === 'Regular' && <th className="px-2 py-1">CGST</th>}
                  {company.gstinType === 'Regular' && <th className="px-2 py-1">IGST</th>}
                  {company.gstinType === 'Regular' && <th className="px-2 py-1">TOTAL</th>}
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
                      <div className="relative">
                        <input
                          type="text"
                          list={`items-list-${idx}`}
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
                            // Try to match exactly by name/code/hsn
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
                        <datalist id={`items-list-${idx}`}>
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
                    {/* Line Discount controls */}
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
                    {company.gstinType === 'Regular' && (
                      <td className="px-2 py-1">
                        <input type="number" value={row.sgst} min={0} onChange={e => handleRowChange(idx, 'sgst', e.target.value)}
                          className="border border-gray-300 rounded-md p-1 w-14" />
                        {gstType === 'intra' && <div className="text-xs text-green-600">Auto: Intra-state (SGST)</div>}
                        {gstType === 'inter' && <div className="text-xs text-gray-400">(Not used for Inter-state)</div>}
                      </td>
                    )}
                    {company.gstinType === 'Regular' && (
                      <td className="px-2 py-1">
                        <input type="number" value={row.cgst} min={0} onChange={e => handleRowChange(idx, 'cgst', e.target.value)}
                          className="border border-gray-300 rounded-md p-1 w-14" />
                        {gstType === 'intra' && <div className="text-xs text-green-600">Auto: Intra-state (CGST)</div>}
                        {gstType === 'inter' && <div className="text-xs text-gray-400">(Not used for Inter-state)</div>}
                      </td>
                    )}
                    {company.gstinType === 'Regular' && (
                      <td className="px-2 py-1">
                        <input type="number" value={row.igst} min={0} onChange={e => handleRowChange(idx, 'igst', e.target.value)}
                          className="border border-gray-300 rounded-md p-1 w-14" />
                        {gstType === 'inter' && <div className="text-xs text-blue-600">Auto: Inter-state (IGST)</div>}
                        {gstType === 'intra' && <div className="text-xs text-gray-400">(Not used for Intra-state)</div>}
                      </td>
                    )}
                    {company.gstinType === 'Regular' && (
                      <td className="px-2 py-1">
                        <input type="number" value={row.total} min={0} readOnly
                          className="border border-gray-300 rounded-md p-1 w-20 bg-green-50 font-semibold" />
                      </td>
                    )}
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => removeRow(idx)} className="text-red-600 font-bold px-2 py-1 rounded hover:bg-red-100">X</button>
                                            </td>
                                        </tr>
                                    );
                 })}
                 {/* Removed bill-level discount row in table; discount handled per line */}
                                </tbody>
                            </table>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6">
            <div className="flex flex-col md:flex-row gap-2 mb-4 md:mb-0">
              <button onClick={addRow} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Add Item Row</button>
              <button data-tour="new-invoice" onClick={() => setShowAddItemModal(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">ADD ITEM</button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-full md:w-80">
              <div className="flex justify-between mb-1"><span>Subtotal (Excl. GST):</span><span>₹{rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)}</span></div>
              <div className="flex justify-between mb-1"><span>Discount:</span><span>-₹{round2(discount)}</span></div>
              <div className="flex justify-between mb-1 font-semibold"><span>Net Subtotal:</span><span>₹{discountedSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between mb-1"><span>Total SGST:</span><span>₹{totalSGST}</span></div>
              <div className="flex justify-between mb-1"><span>Total CGST:</span><span>₹{totalCGST}</span></div>
              <div className="flex justify-between mb-1"><span>Total IGST:</span><span>₹{totalIGST}</span></div>
              <div className="flex justify-between mt-2 font-bold text-lg"><span>Grand Total (Incl. GST):</span><span className="text-blue-700">₹{grandTotal}</span></div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <button
              id="save-invoice-button"
              onClick={handleSaveInvoice}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 print:hidden"
            >
              Save {docTypeOptions.find(opt => opt.value === docType)?.label || 'Invoice'}
            </button>
            {editingBillId && (
              <button
                onClick={() => handleAddPayment(bills.find(b => b.id === editingBillId))}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 print:hidden"
              >
                Add Payment
              </button>
            )}
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
                  


                  {/* Removed document type filter as it's now part of the collection */}
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
              <table id="sales-table" className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                    <SortableHeader columnKey="number" label={numberLabel.split(' ')[0] + ' No.'} onSort={handleSort} sortConfig={sortConfig} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                    <SortableHeader columnKey="invoiceDate" label="Date" onSort={handleSort} sortConfig={sortConfig} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                    <SortableHeader columnKey="party" label="Party" onSort={handleSort} sortConfig={sortConfig} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                    <SortableHeader columnKey="amount" label="Amount" onSort={handleSort} sortConfig={sortConfig} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                    <SortableHeader columnKey="paid" label="Paid" onSort={handleSort} sortConfig={sortConfig} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                    <SortableHeader columnKey="outstanding" label="Outstanding" onSort={handleSort} sortConfig={sortConfig} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                <tbody>
                  {pagination.currentData.map((bill, idx) => {
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
                      <tr key={idx} data-bill-id={bill.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{bill.number || bill.invoiceNumber}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{date}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{bill.partyName}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 text-center">{amount}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-green-600 text-center font-medium">
                          ₹{(bill.paid || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600 text-center font-medium">
                          ₹{(bill.outstanding || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
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
                                type: docType === 'invoice' ? 'invoice' : docType === 'challan' ? 'challan' : 'quotation',
                                onClick: () => {
                                  setInvoiceBill({
                            ...bill,
                            companyDetails: company,
                            partyDetails: parties.find(p => p.id === bill.party) || {},
                            items: items,
                                    docType: docType
                                  });
                                  setShowInvoiceModal(true);
                                }
                              }
                            ]}
                          />
                        </td>
                    </tr>
                  );
                })}
                            </tbody>
                        </table>
                        
                                                {/* Pagination Controls */}
                        <PaginationControls {...pagination} />
            </div>
          </div>
        </div>
      </div>
      {/* View Bill Modal */}
      {showViewModal && viewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <div className="absolute top-2 right-2 flex items-center space-x-2">
              <span className="text-xs text-gray-500">Press ESC to close</span>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-800 text-xl">&times;</button>
            </div>
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
                    <li key={i}>{itemName} (Qty: {row.qty}, Rate: ₹{row.rate})</li>
                  );
                })}
              </ul>
            </div>
          </div>
                    </div>
                )}
             {/* Delete Confirmation Modal */}
       <ConfirmationModal
         isOpen={showDeleteConfirm}
         onClose={cancelDeleteBill}
         title="Confirm Delete"
         message="Are you sure you want to delete this sales bill?"
         onConfirm={confirmDeleteBill}
         confirmText="Delete"
         cancelText="Cancel"
         variant="danger"
       />
             {/* Invoice Preview Modal */}
       <PreviewModal
         isOpen={showInvoiceModal && invoiceBill}
         onClose={() => setShowInvoiceModal(false)}
         title={`${docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'} Preview`}
         showPrintButton={true}
         onPrint={handleInvoicePrint}
         showPdfButton={true}
         onPdf={handleInvoiceDownload}
         extraActions={
           <ShareButton
             onExportPDF={handleInvoiceDownload}
             onExportExcel={handleInvoiceShareExcel}
             onExportImage={handleInvoiceShareImage}
             onShareLink={handleInvoiceShareLink}
             disabled={!invoiceBill}
           />
         }
         showZoomControls={true}
         zoom={invoiceZoom}
         onZoomIn={() => setInvoiceZoom(z => Math.min(2, z + 0.1))}
         onZoomOut={() => setInvoiceZoom(z => Math.max(0.5, z - 0.1))}
         onZoomReset={() => setInvoiceZoom(1)}
         maxWidth="max-w-full"
         maxHeight="max-h-[98vh]"
         zIndex="z-50"
       >
         <div className="flex-1 overflow-auto flex justify-center items-start bg-gray-50 print:bg-white" onWheel={handleInvoiceWheel} style={{ minHeight: 0 }}>
           <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
             <div style={{ width: '80vw', display: 'flex', justifyContent: 'center' }}>
               <div ref={invoiceRef} style={{ transform: `scale(${invoiceZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s', background: 'white', boxShadow: '0 0 8px #ccc', margin: '0 auto', width: '210mm', minHeight: '297mm', maxWidth: '100%', padding: 0 }} className="print:shadow-none print:bg-white print:transform-none print:p-0 print:m-0 print:max-w-none print:w-[210mm] print:min-h-[297mm]">
                 {invoiceBill?.docType === 'challan' ? (
                   <ChallanTemplate
                     billData={{
                       ...invoiceBill,
                       challanNumber: invoiceBill?.number || invoiceBill?.challanNumber || '',
                       challanDate: invoiceBill?.invoiceDate || invoiceBill?.date || '',
                       items: (invoiceBill?.rows || invoiceBill?.items || []).map(row => {
                         const itemMaster = items.find(it => it.id === row.item);
                         return {
                           ...row,
                           description: itemMaster?.itemName || '',
                           hsn: itemMaster?.hsnCode || '',
                         };
                       }),
                     }}
                     companyDetails={{ ...company, gstinType: company.gstinType || company.gstinType || '' }}
                     partyDetails={{
                       ...parties.find(p => p.id === invoiceBill?.party) || {},
                       name: (parties.find(p => p.id === invoiceBill?.party)?.firmName || parties.find(p => p.id === invoiceBill?.party)?.name || ''),
                     }}
                     bankDetails={{
                       name: company.bankName,
                       account: company.bankAccount,
                       ifsc: company.bankIfsc,
                       upi: company.upiId,
                       upiQrUrl: company.upiQrUrl,
                       paymentGatewayLink: company.paymentGatewayLink,
                       sealUrl: company.sealUrl,
                       signUrl: company.signUrl,
                     }}
                     payments={invoiceBill?.payments || []}
                     pageSize={'a4'}
                     orientation={'portrait'}
                     previewMode={false}
                   />
                 ) : invoiceBill?.docType === 'quotation' ? (
                   <QuotationTemplate
                     billData={{
                       ...invoiceBill,
                       quotationNumber: invoiceBill?.number || invoiceBill?.quotationNumber || '',
                       date: invoiceBill?.invoiceDate || invoiceBill?.date || '',
                       items: (invoiceBill?.rows || invoiceBill?.items || []).map(row => {
                         const itemMaster = items.find(it => it.id === row.item);
                         return {
                           ...row,
                           description: itemMaster?.itemName || '',
                         };
                       }),
                     }}
                     companyDetails={{ ...company, gstinType: company.gstinType || company.gstinType || '' }}
                     partyDetails={{
                       ...parties.find(p => p.id === invoiceBill?.party) || {},
                       name: (parties.find(p => p.id === invoiceBill?.party)?.firmName || parties.find(p => p.id === invoiceBill?.party)?.name || ''),
                     }}
                     bankDetails={{
                       name: company.bankName,
                       account: company.bankAccount,
                       ifsc: company.bankIfsc,
                       upi: company.upiId,
                       upiQrUrl: company.upiQrUrl,
                       paymentGatewayLink: company.paymentGatewayLink,
                       sealUrl: company.sealUrl,
                       signUrl: company.signUrl,
                     }}
                     payments={invoiceBill?.payments || []}
                     pageSize={'a4'}
                     orientation={'portrait'}
                     previewMode={false}
                   />
                 ) : (
                   <InvoiceTemplate
                     billData={{
                       ...invoiceBill,
                       invoiceNumber: invoiceBill?.number || invoiceBill?.invoiceNumber || '',
                       date: invoiceBill?.invoiceDate || invoiceBill?.date || '',
                       items: (invoiceBill?.rows || invoiceBill?.items || []).map(row => {
                         const itemMaster = items.find(it => it.id === row.item);
                         return {
                           ...row,
                           description: itemMaster?.itemName || '',
                           hsn: itemMaster?.hsnCode || '',
                         };
                       }),
                     }}
                     companyDetails={{ ...company, gstinType: company.gstinType || company.gstinType || '' }}
                     partyDetails={{
                       ...parties.find(p => p.id === invoiceBill?.party) || {},
                       name: (parties.find(p => p.id === invoiceBill?.party)?.firmName || parties.find(p => p.id === invoiceBill?.party)?.name || ''),
                     }}
                     bankDetails={{
                       name: company.bankName,
                       account: company.bankAccount,
                       ifsc: company.bankIfsc,
                       upi: company.upiId,
                       upiQrUrl: company.upiQrUrl,
                       paymentGatewayLink: company.paymentGatewayLink,
                       sealUrl: company.sealUrl,
                       signUrl: company.signUrl,
                     }}
                     payments={invoiceBill?.payments || []}
                     pageSize={'a4'}
                     orientation={'portrait'}
                     previewMode={false}
                   />
                 )}
                 <style>{`
                   @media print {
                     html, body, #root, .print\\:w-[210mm] { width: 210mm !important; }
                     .print\\:min-h-[297mm] { min-height: 297mm !important; }
                     .print\\:max-w-none { max-width: none !important; }
                     .print\\:p-0 { padding: 0 !important; }
                     .print\\:m-0 { margin: 0 !important; }
                   }
                 `}</style>
               </div>
             </div>
           </div>
         </div>
       </PreviewModal>
      
             {/* ADD ITEM Modal */}
       <FormModal
         isOpen={showAddItemModal}
         onClose={() => { setShowAddItemModal(false); clearAddItemForm(); }}
         title="Add New Item"
         size="2xl"
         onSubmit={(e) => {
           e.preventDefault();
           handleAddItem();
         }}
         submitText="Add Item"
         cancelText="Cancel"
         submitVariant="success"
       >
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
               required
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
               required
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
       </FormModal>
             {/* Success Modal */}
       <StandardModal
         isOpen={showSuccessModal}
         onClose={() => setShowSuccessModal(false)}
         title=""
         size="md"
         showCloseButton={false}
       >
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
           <StandardButton
             variant="primary"
             onClick={() => {
               const bill = bills.find(b => b.id === savedBillId);
               if (bill) {
                 setInvoiceBill({
                   ...bill,
                   companyDetails: company,
                   partyDetails: parties.find(p => p.id === bill.party) || {},
                   items: items,
                   docType: docType // Ensure docType is set for correct template
                 });
                 setShowInvoiceModal(true);
               }
               setShowSuccessModal(false);
             }}
             className="w-full flex items-center justify-center gap-2"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
             </svg>
             Print {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}
           </StandardButton>
           
            <StandardButton
              variant="light"
              onClick={() => {
                // Prepare a new blank document without full refresh
                setShowSuccessModal(false);
                setEditingBillId(null);
                setParty('');
                setNotes('');
                setCustomFields({ ewayBillNo: '', ewayQr: '', ewayDate: '' });
                setRows(Array.from({ length: 5 }, () => ({ ...initialItemRow })));
                // Recompute next invoice number based on current date and latest bills
                const prefixMap = { invoice: 'INV', challan: 'CHA', quotation: 'QUO' };
                const prefix = prefixMap[docType] || 'INV';
                const fy = getFinancialYear(new Date());
                const fyShort = fy.split('-').map(y => y.slice(-2)).join('-');
                const serials = bills
                  .filter(bill => (bill.number || '').startsWith(`${prefix}${fyShort}/`))
                  .map(bill => parseInt((bill.number || '').split('/')[1], 10))
                  .filter(n => !isNaN(n));
                const nextSerial = (serials.length ? Math.max(...serials) : 0) + 1;
                setInvoiceNumber(`${prefix}${fyShort}/${nextSerial}`);
              }}
              className="w-full"
            >
              Create New {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}
            </StandardButton>
           
           <StandardButton
             variant="light"
             onClick={() => {
               const bill = bills.find(b => b.id === savedBillId);
               if (bill) {
                 handleEditBill(bill);
               }
               setShowSuccessModal(false);
             }}
             className="w-full"
           >
             Edit This {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}
           </StandardButton>
         </div>
       </StandardModal>
      {docType === 'quotation' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Terms and Conditions (Override)</label>
          <textarea
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Enter terms and conditions for this quotation (leave blank to use company default)"
            value={quotationTermsOverride}
            onChange={e => setQuotationTermsOverride(e.target.value)}
          />
          <div className="text-xs text-gray-500 mt-1">If left blank, the company's default Quotation Terms and Conditions will be used.</div>
        </div>
      )}

             {/* Payment Modal */}
       <FormModal
         isOpen={showPaymentModal}
         onClose={() => {
           setShowPaymentModal(false);
           setSelectedBillForPayment(null);
         }}
         title="Add Payment"
         size="md"
         onSubmit={(e) => {
           e.preventDefault();
           handleSavePayment();
         }}
         submitText="Save Payment"
         cancelText="Cancel"
         submitVariant="success"
       >
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
               required
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
               required
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
               required
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
       </FormModal>

             {/* Payment Details Modal */}
       <StandardModal
         isOpen={showPaymentDetailsModal && selectedBillForReceipts}
         onClose={() => setShowPaymentDetailsModal(false)}
         title="Payment Receipts"
         size="4xl"
       >
         <div className="mb-4">
           <p className="text-sm text-gray-600">
             {docTypeOptions.find(opt => opt.value === docType)?.label || 'Document'}: {selectedBillForReceipts?.number} | 
             Party: {getPartyName(selectedBillForReceipts?.party)} | 
             Total Amount: ₹{(selectedBillForReceipts?.amount || 0).toLocaleString('en-IN')}
           </p>
         </div>
         
         {/* Payment Summary */}
         <div className="bg-gray-50 p-4 rounded-lg mb-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
             <div>
               <span className="font-medium text-gray-700">Total Bill Amount:</span>
               <span className="ml-2 text-lg font-semibold">₹{(selectedBillForReceipts?.amount || 0).toLocaleString('en-IN')}</span>
             </div>
             <div>
               <span className="font-medium text-gray-700">Total Paid:</span>
               <span className="ml-2 text-lg font-semibold text-green-600">₹{(selectedBillForReceipts?.paid || 0).toLocaleString('en-IN')}</span>
             </div>
             <div>
               <span className="font-medium text-gray-700">Outstanding:</span>
               <span className="ml-2 text-lg font-semibold text-red-600">₹{(selectedBillForReceipts?.outstanding || 0).toLocaleString('en-IN')}</span>
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
                   AGAINST {docType.toUpperCase()}
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
               {selectedBillForReceipts && getBillPayments(selectedBillForReceipts).map((payment) => {
                 const allocation = payment.allocations.find(a => a.billId === selectedBillForReceipts.id && a.billType === docType);
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
                         <StandardButton
                           variant="info"
                           size="sm"
                           onClick={() => {
                             setSelectedPaymentForReceipt(payment);
                             setShowReceiptModal(true);
                             setShowPaymentDetailsModal(false);
                           }}
                         >
                           Preview
                         </StandardButton>
                       </div>
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>
       </StandardModal>

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



    </div>
    );
}

export default Sales; 