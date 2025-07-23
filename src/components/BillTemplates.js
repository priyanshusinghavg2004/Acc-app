import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  deleteDoc, 
  getDoc, 
  serverTimestamp,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

// Add at the top with other imports
import { formatNumber, formatCurrency, formatDate, numToWords } from '../utils/numberFormat';

const DOCUMENT_TYPES = [
  { key: "invoice", label: "Invoice" },
  { key: "challan", label: "Challan" },
  { key: "quotation", label: "Quotation" },
  { key: "purchase_bill", label: "Purchase Bill" },
  { key: "purchase_order", label: "Purchase Order" },
];

const PAPER_SIZES = [
  { key: "a4", label: "A4 (210 × 297 mm)", width: 210, height: 297 },
  { key: "letter", label: "Letter (216 × 279 mm)", width: 216, height: 279 },
  { key: "legal", label: "Legal (216 × 356 mm)", width: 216, height: 356 },
  { key: "a5", label: "A5 (148 × 210 mm)", width: 148, height: 210 },
  { key: "a3", label: "A3 (297 × 420 mm)", width: 297, height: 420 },
  { key: "b5", label: "B5 (176 × 250 mm)", width: 176, height: 250 },
  { key: "executive", label: "Executive (184 × 267 mm)", width: 184, height: 267 },
  { key: "tabloid", label: "Tabloid (279 × 432 mm)", width: 279, height: 432 },
];
const ORIENTATIONS = [
  { key: "portrait", label: "Portrait" },
  { key: "landscape", label: "Landscape" },
];

const BLOCK_LIBRARY = [
  { key: "header", label: "Header" },
  { key: "logo", label: "Logo" },
  { key: "billedBy", label: "Billed By" },
  { key: "billedTo", label: "Billed To" },
  { key: "shippedTo", label: "Shipped To" },
  { key: "supplyInfo", label: "Place/Country of Supply" },
  { key: "gstDetails", label: "GST Details" },
  { key: "itemTable", label: "Item Table" },
  { key: "bankDetails", label: "Bank & Payment Details" },
  { key: "totals", label: "Totals" },
  { key: "terms", label: "Terms and Conditions" },
  { key: "notes", label: "Additional Notes" },
  { key: "footer", label: "Footer" },
];

const BlockPreview = ({ block }) => {
  switch (block) {
    case "header":
      return <div className="font-bold text-xl mb-2">Header</div>;
    case "logo":
      return <div className="flex items-center justify-center h-full"><span className="text-gray-400">Logo</span></div>;
    case "billedBy":
      return <div><span className="font-bold">Billed By</span></div>;
    case "billedTo":
      return <div><span className="font-bold">Billed To</span></div>;
    case "shippedTo":
      return <div><span className="font-bold">Shipped To</span></div>;
    case "supplyInfo":
      return <div>Place of Supply</div>;
    case "gstDetails":
      return <div className="font-bold text-center">GST Details</div>;
    case "itemTable":
      return <div className="font-bold">Item Table</div>;
    case "bankDetails":
      return <div><span className="font-bold">Bank & Payment Details</span></div>;
    case "totals":
      return <div><span className="font-bold">Totals</span></div>;
    case "terms":
      return <div><span className="font-bold">Terms and Conditions</span></div>;
    case "notes":
      return <div><span className="font-bold">Additional Notes</span></div>;
    case "footer":
      return <div className="text-xs text-gray-500">Footer</div>;
    default:
      return <div className="text-gray-400">[Empty]</div>;
  }
};

const defaultLayout = [
  { columns: 2, cells: ["header", "logo"], height: 40, width: 190 },
  { columns: 3, cells: ["billedBy", "billedTo", "shippedTo"], height: 60, width: 190 },
  { columns: 1, cells: ["itemTable"], height: 120, width: 190 },
  { columns: 2, cells: ["bankDetails", "totals"], height: 50, width: 190 },
  { columns: 1, cells: ["terms"], height: 30, width: 190 },
  { columns: 1, cells: ["footer"], height: 20, width: 190 }
];

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Roboto", value: "Roboto, Arial, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Georgia", value: "Georgia, serif" },
];
const FONT_WEIGHTS = [
  { label: "Normal", value: "normal" },
  { label: "Bold", value: "bold" },
  { label: "Bolder", value: "bolder" },
  { label: "Lighter", value: "lighter" },
  { label: "100", value: "100" },
  { label: "400", value: "400" },
  { label: "700", value: "700" },
];
const BLOCKS = [
  "header", "logo", "billedBy", "billedTo", "shippedTo", "supplyInfo", "gstDetails", "itemTable", "bankDetails", "totals", "terms", "notes", "footer"
];
// Define sub-lines for each block
const BLOCK_SUBLINES = {
  header: [
    { key: 'mainHead', label: 'Main Head' },
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'date', label: 'Date' },
  ],
  billedBy: [
    { key: 'label', label: 'Label' },
    { key: 'companyName', label: 'Company Name/Details' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'contact', label: 'Contact' },
    { key: 'email', label: 'Email' },
  ],
  billedTo: [
    { key: 'label', label: 'Label' },
    { key: 'companyName', label: 'Company Name/Details' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'contact', label: 'Contact' },
    { key: 'email', label: 'Email' },
  ],
  shippedTo: [
    { key: 'label', label: 'Label' },
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'contact', label: 'Contact' },
    { key: 'email', label: 'Email' },
    { key: 'vehicleNumber', label: 'Vehicle Number' },
    { key: 'ewayBillNumber', label: 'E-way Bill Number' },
  ],
  gstDetails: [
    { key: 'hsn', label: 'HSN' },
    { key: 'taxableAmount', label: 'Taxable Amount' },
    { key: 'cgstRate', label: 'CGST Rate' },
    { key: 'cgstAmount', label: 'CGST Amount' },
    { key: 'sgstRate', label: 'SGST Rate' },
    { key: 'sgstAmount', label: 'SGST Amount' },
    { key: 'totalTaxAmount', label: 'Total Tax Amount' },
  ],
  itemTable: [
    { key: 'serialNo', label: 'Serial No' },
    { key: 'itemDescription', label: 'Item Description/Particular' },
    { key: 'hsn', label: 'HSN' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'rate', label: 'Rate' },
    { key: 'taxableAmount', label: 'Taxable Amount' },
    { key: 'gst', label: 'GST' }, // Grouped column
    { key: 'amount', label: 'Amount' },
  ],
  bankDetails: [
    { key: 'label', label: 'Label' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'ifscCode', label: 'IFSC Code' },
    { key: 'upiId', label: 'UPI ID' },
    { key: 'qrCode', label: 'QR Code' },
  ],
  terms: [
    { key: 'label', label: 'Label' },
    { key: 'termsText', label: 'Terms Text' },
  ],
  footer: [
    { key: 'footerText', label: 'Footer Text' },
  ],
  totals: [
    { key: 'taxableAmount', label: 'Taxable Amount' },
    { key: 'CGST', label: 'CGST' },
    { key: 'SGST', label: 'SGST' },
    { key: 'IGST', label: 'IGST' },
    { key: 'discount', label: 'Discount' },
    { key: 'totalAmount', label: 'Total Amount' },
  ],
};
// Update DEFAULT_FONT_SETTINGS to include all necessary sublines
const DEFAULT_FONT_SETTINGS = BLOCKS.reduce((acc, block) => {
  if (block === "header") {
    acc[block] = {
      mainHead: {
        fontSize: 24,
        fontFamily: "Arial, sans-serif",
        fontWeight: "bold",
        color: "#1a365d",
        visible: true,
        fontStyle: "normal",
        textDecoration: "none",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        lineHeight: 1.2,
      },
      sublines: {
        invoiceNumber: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        invoiceDate: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        }
      },
      customLines: [],
    };
  } else if (block === "billedBy" || block === "billedTo" || block === "shippedTo") {
    acc[block] = {
      sublines: {
        companyName: {
          fontSize: 16,
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        gstin: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        contact: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        email: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        address: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        }
      },
      customLines: [],
    };
  } else if (block === "bankDetails") {
    acc[block] = {
      sublines: {
        bankName: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        accountNumber: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        ifscCode: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        upiId: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        }
      },
      customLines: [],
    };
  } else if (block === "totals") {
    acc[block] = {
      sublines: {
        taxableAmount: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        CGST: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        SGST: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        IGST: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        totalAmount: {
          fontSize: 16,
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          color: "#1a365d",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        },
        amountInWords: {
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#2d3748",
          visible: true,
          fontStyle: "italic",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        }
      },
      customLines: [],
    };
  } else if (block === "terms") {
    acc[block] = {
      sublines: {
        termsText: {
          fontSize: 12,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#4a5568",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        }
      },
      customLines: [],
    };
  } else if (block === "footer") {
    acc[block] = {
      sublines: {
        footerText: {
          fontSize: 12,
          fontFamily: "Arial, sans-serif",
          fontWeight: "normal",
          color: "#718096",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.4,
        }
      },
      customLines: [],
    };
  } else {
    acc[block] = { customLines: [] };
  }
  return acc;
}, {});

const BillTemplates = ({ db, userId, isAuthReady, appId, billOverride }) => {
  const [selectedType, setSelectedType] = useState(DOCUMENT_TYPES[0].key);
  // Refactored: All state is now per-type
  const [layoutsByType, setLayoutsByType] = useState({});
  const [fontSettingsByType, setFontSettingsByType] = useState({});
  const [marginByType, setMarginByType] = useState({});
  const [customSizeByType, setCustomSizeByType] = useState({});
  const [headerMainHeadByType, setHeaderMainHeadByType] = useState({});
  const [headerMainHeadOtherByType, setHeaderMainHeadOtherByType] = useState({});
  const [layoutNameByType, setLayoutNameByType] = useState({});
  const [editingLayoutIdByType, setEditingLayoutIdByType] = useState({});
  const [savedLayoutsByType, setSavedLayoutsByType] = useState({});
  const [defaultTemplateIdByType, setDefaultTemplateIdByType] = useState({});
  const [paperSize, setPaperSize] = useState(PAPER_SIZES[0].key);
  const [orientation, setOrientation] = useState(ORIENTATIONS[0].key);
  const [zoom, setZoom] = useState(2);
  const [layout, setLayout] = useState(defaultLayout);
  const [customSize, setCustomSize] = useState({ width: 210, height: 297 });
  const [companyDetails, setCompanyDetails] = useState(null);
  const [billData, setBillData] = useState(null);
  const [partyDetails, setPartyDetails] = useState(null);

  // Fetch bill data when billOverride changes
  useEffect(() => {
    if (billOverride) {
      setBillData(billOverride);
      // Fetch party details
      if (db && userId && isAuthReady && appId && billOverride.party) {
        const partyRef = doc(db, `artifacts/${appId}/users/${userId}/parties`, billOverride.party);
        getDoc(partyRef).then(docSnap => {
          if (docSnap.exists()) {
            setPartyDetails(docSnap.data());
          }
        });
      }
    }
  }, [billOverride, db, userId, isAuthReady, appId]);

  // Function to format date as DD/MM/YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Function to format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Function to convert number to words
  const numToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if ((num = num.toString()).length > 9) return 'Overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return;
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() + ' Rupees Only';
  };

  // Map data to template blocks
  const mapDataToBlock = (block) => {
    if (!billData || !companyDetails) return {};

    switch (block) {
      case 'header':
        return {
          mainHead: billData.docType === 'challan' ? 'CHALLAN' : billData.docType === 'quotation' ? 'QUOTATION' : 'TAX INVOICE',
          invoiceNumber: billData.number || '',
          invoiceDate: formatDate(billData.invoiceDate) || '',
        };

      case 'billedBy':
        return {
          companyName: companyDetails.firmName || '',
          gstin: `GSTIN: ${companyDetails.gstin || ''}`,
          contact: companyDetails.contactNumber || '',
          email: companyDetails.email || '',
          address: [
            companyDetails.address || '',
            companyDetails.city || '',
            companyDetails.state ? `${companyDetails.state} - ${companyDetails.pincode || ''}` : ''
          ].filter(Boolean).join(', '),
        };

      case 'billedTo':
        return partyDetails ? {
          companyName: partyDetails.firmName || '',
          gstin: `GSTIN: ${partyDetails.gstin || ''}`,
          contact: partyDetails.contactNumber || '',
          email: partyDetails.email || '',
          address: [
            partyDetails.address || '',
            partyDetails.city || '',
            partyDetails.state ? `${partyDetails.state} - ${partyDetails.pincode || ''}` : ''
          ].filter(Boolean).join(', '),
        } : {};

      case 'bankDetails':
        return {
          bankName: companyDetails.bankName || '',
          accountNumber: `A/C: ${companyDetails.bankAccount || ''}`,
          ifscCode: `IFSC: ${companyDetails.bankIfsc || ''}`,
          upiId: companyDetails.upiId ? `UPI: ${companyDetails.upiId}` : '',
        };

      case 'totals':
        const subtotal = billData.rows?.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0) || 0;
        const totalSGST = billData.rows?.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0) || 0;
        const totalCGST = billData.rows?.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0) || 0;
        const totalIGST = billData.rows?.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0) || 0;
        const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;

        return {
          taxableAmount: `Taxable Amount: ${formatCurrency(subtotal)}`,
          CGST: `CGST: ${formatCurrency(totalCGST)}`,
          SGST: `SGST: ${formatCurrency(totalSGST)}`,
          IGST: `IGST: ${formatCurrency(totalIGST)}`,
          totalAmount: `Grand Total: ${formatCurrency(grandTotal)}`,
          amountInWords: numToWords(Math.round(grandTotal)),
        };

      case 'terms':
        return {
          termsText: companyDetails.terms || 'Thank you for your business!',
        };

      case 'footer':
        return {
          footerText: `Generated on ${new Date().toLocaleDateString('en-IN')} | ${companyDetails.firmName || ''}`,
        };

      default:
        return {};
    }
  };

  // Add effect to fetch company details
  useEffect(() => {
    if (!db || !userId || !isAuthReady || !appId) return;
    const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
    const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [db, userId, isAuthReady, appId]);

  useEffect(() => {
    if (!db || !userId || !isAuthReady || !appId) return;
    const fetchLayouts = async () => {
      setLoadingLayouts(true);
      try {
        // 1. Fetch layouts from the correct path
        const layoutsRef = collection(db, `artifacts/${appId}/users/${userId}/billLayouts`);
        const layoutsSnapshot = await getDocs(layoutsRef);
        
        // 2. Group layouts by type
        const layoutsByTypeTemp = {};
        layoutsSnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const type = data.type || 'invoice';
          if (!layoutsByTypeTemp[type]) layoutsByTypeTemp[type] = [];
          layoutsByTypeTemp[type].push({ id: docSnap.id, ...data });
        });
        setSavedLayoutsByType(layoutsByTypeTemp);
        
        // 3. Set current type's layouts
        if (layoutsByTypeTemp[selectedType]) {
          setSavedLayouts(layoutsByTypeTemp[selectedType]);
        }

        // 4. Fetch default template preferences
        const preferencesRef = doc(db, `artifacts/${appId}/users/${userId}/preferences`, 'userPreferences');
        const preferencesSnap = await getDoc(preferencesRef);
        
        if (preferencesSnap.exists()) {
          const prefs = preferencesSnap.data();
          const defaultIds = prefs.defaultTemplateIdByType || {};
          
          // 5. Verify default templates exist
          Object.entries(defaultIds).forEach(([type, defaultId]) => {
            const layoutsOfType = layoutsByTypeTemp[type] || [];
            const templateExists = layoutsOfType.some(l => l.id === defaultId);
            
            if (!templateExists) {
              delete defaultIds[type];
            }
          });
          
          // 6. Set default template IDs
          setDefaultTemplateIdByType(defaultIds);
          
          // 7. Set current type's default template
          if (defaultIds[selectedType]) {
            setDefaultTemplateId(defaultIds[selectedType]);
          }
        }

      } catch (err) {
        console.error('Error fetching layouts:', err);
        setSavedLayoutsByType({});
        setSavedLayouts([]);
        setDefaultTemplateIdByType({});
        setDefaultTemplateId(null);
      }
      setLoadingLayouts(false);
    };

    fetchLayouts();
  }, [db, userId, isAuthReady, appId, selectedType]);

  // Add effect to update current layouts when type changes
  useEffect(() => {
    if (savedLayoutsByType[selectedType]) {
      setSavedLayouts(savedLayoutsByType[selectedType]);
      // Update default template ID for current type
      setDefaultTemplateId(defaultTemplateIdByType[selectedType] || null);
    } else {
      setSavedLayouts([]);
      setDefaultTemplateId(null);
    }
  }, [selectedType, savedLayoutsByType, defaultTemplateIdByType]);

  // Calculate paper dimensions
  const paper = paperSize === 'custom'
    ? { key: 'custom', label: `Custom (${customSize.width} × ${customSize.height} mm)`, width: customSize.width, height: customSize.height }
    : PAPER_SIZES.find(p => p.key === paperSize) || PAPER_SIZES[0];
  const isPortrait = orientation === 'portrait';
  const paperW = isPortrait ? paper.width : paper.height;
  const paperH = isPortrait ? paper.height : paper.width;
  
  // Helper function to convert mm to pixels
  const mmToPx = mm => mm * 3.78;
  
  // Block display names for labels
  const BLOCK_DISPLAY_NAMES = {
    billedBy: 'Billed By',
    billedTo: 'Billed To',
    shippedTo: 'Shipped To',
    gstDetails: 'GST Details',
    bankDetails: 'Bank & Payment Details',
    terms: 'Terms and Conditions',
    notes: 'Additional Notes',
  };

  // Layout management state
  const [layoutName, setLayoutName] = useState("");
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  const [editingLayoutId, setEditingLayoutId] = useState(null);
  const fileInputRef = useRef();

  // Font settings state
  const [fontSettings, setFontSettings] = useState(DEFAULT_FONT_SETTINGS);
  const [fontEditor, setFontEditor] = useState({ open: false, block: null, pos: { x: 0, y: 0 } });
  const fontEditorRef = useRef();

  // Add mainHead state for header
  const MAIN_HEAD_OPTIONS = [
    'Invoice',
    'Challan',
    'Quotation',
    'Purchase Order',
    'Other',
  ];
  const [headerMainHead, setHeaderMainHead] = useState('Invoice');
  const [headerMainHeadOther, setHeaderMainHeadOther] = useState('');

  // Place these at the top level of the BillTemplates component, with other useState declarations
  const [resizingCol, setResizingCol] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Add state for editable sample row values per template
  const [itemTableSampleRow, setItemTableSampleRow] = useState({});

  // Place this at the top level of the BillTemplates component, with other useState hooks:
  const [dragIdx, setDragIdx] = useState(null);

  // Add state for discount type and value in Totals
  const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'amount'
  const [discountValue, setDiscountValue] = useState(0);

  // At the top level of BillTemplates component, after other useState hooks:
  const [itemTableDragCol, setItemTableDragCol] = useState(null);
  const [itemTableResizingCol, setItemTableResizingCol] = useState(null);
  const [itemTableStartX, setItemTableStartX] = useState(0);
  const [itemTableStartWidth, setItemTableStartWidth] = useState(0);
  
  // Thumbnail view state
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [selectedThumbnail, setSelectedThumbnail] = useState(null);
  
  // Default template state
  const [defaultTemplateId, setDefaultTemplateId] = useState(null);

  // Add per-type margin variable and setter:
  const margin = marginByType[selectedType] || { top: 10, right: 10, bottom: 10, left: 10 };
  const setMarginForType = (newMargin) => setMarginByType(prev => ({ ...prev, [selectedType]: typeof newMargin === 'function' ? newMargin(prev[selectedType] || { top: 10, right: 10, bottom: 10, left: 10 }) : newMargin }));

  useEffect(() => {
    if (resizingCol) {
      const handleMouseMove = e => {
        const dx = e.clientX - startX;
        setFontSettings(fs => {
          const newWidth = Math.max(10, startWidth + dx / 3.78); // convert px to mm
          return {
            ...fs,
            itemTable: {
              ...fs.itemTable,
              sublines: {
                ...fs.itemTable.sublines,
                [resizingCol]: {
                  ...fs.itemTable.sublines[resizingCol],
                  width: newWidth,
                },
              },
            },
          };
        });
      };
      const handleMouseUp = () => {
        setResizingCol(null);
        document.body.style.cursor = '';
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingCol, startX, startWidth]);

  useEffect(() => {
    if (itemTableResizingCol) {
      window.addEventListener('mouseup', handleItemTableMouseUp);
    } else {
      window.removeEventListener('mouseup', handleItemTableMouseUp);
    }
    return () => window.removeEventListener('mouseup', handleItemTableMouseUp);
  }, [itemTableResizingCol]);

  // Close font editor on outside click or Esc
  useEffect(() => {
    if (!fontEditor.open) return;
    const handleClick = (e) => {
      if (fontEditorRef.current && !fontEditorRef.current.contains(e.target)) {
        setFontEditor({ open: false, block: null, pos: { x: 0, y: 0 } });
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setFontEditor({ open: false, block: null, pos: { x: 0, y: 0 } });
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [fontEditor.open]);

  // Save or update layout in Firestore
  const handleSaveLayout = async () => {
    if (!layoutName.trim() || !db || !userId || !appId) return;
    const layoutData = {
      name: layoutName,
      data: {
        paperSize,
        orientation,
        customSize,
        margin,
        layout,
        fontSettings,
        headerMainHead,
        headerMainHeadOther,
      },
      type: selectedType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const colRef = collection(db, `artifacts/${appId}/users/${userId}/billLayouts`);
    if (editingLayoutId) {
      // Update existing
      await setDoc(doc(colRef, editingLayoutId), {
        ...layoutData,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      // Add new
      await addDoc(colRef, layoutData);
    }
    // Refresh list
    const querySnapshot = await getDocs(colRef);
    const layouts = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    setSavedLayouts(layouts);
    setLayoutName("");
    setEditingLayoutId(null);
  };

  // Edit layout (load for editing)
  const handleEditLayout = (id) => {
    const l = savedLayouts.find(l => l.id === id);
    if (!l) return;
    setPaperSize(l.data.paperSize);
    setOrientation(l.data.orientation);
    setCustomSize(l.data.customSize);
    setMarginForType(l.data.margin);
    // Patch layout rows for width
    const paperW = l.data.paperSize === 'custom' && l.data.customSize ? l.data.customSize.width : (l.data.paperSize ? (210) : 210);
    const patchedLayout = patchLayoutRowWidths(l.data.layout, paperW, l.data.margin || { left: 10, right: 10 });
    setLayout(patchedLayout);
    setFontSettings(mergeFontSettings(l.data.fontSettings || {}, DEFAULT_FONT_SETTINGS));
    setHeaderMainHead(l.data.headerMainHead || 'Invoice');
    setHeaderMainHeadOther(l.data.headerMainHeadOther || '');
    setLayoutName(l.name);
    setEditingLayoutId(id);
  };

  // View layout (load for view only)
  const handleViewLayout = (id) => {
    const l = savedLayouts.find(l => l.id === id);
    if (!l) return;
    setPaperSize(l.data.paperSize);
    setOrientation(l.data.orientation);
    setCustomSize(l.data.customSize);
    setMarginForType(l.data.margin);
    // Patch layout rows for width
    const paperW = l.data.paperSize === 'custom' && l.data.customSize ? l.data.customSize.width : (l.data.paperSize ? (210) : 210);
    const patchedLayout = patchLayoutRowWidths(l.data.layout, paperW, l.data.margin || { left: 10, right: 10 });
    setLayout(patchedLayout);
    setFontSettings(mergeFontSettings(l.data.fontSettings || {}, DEFAULT_FONT_SETTINGS));
    setHeaderMainHead(l.data.headerMainHead || 'Invoice');
    setHeaderMainHeadOther(l.data.headerMainHeadOther || '');
    setLayoutName("");
    setEditingLayoutId(null);
  };

  // Set template as default
  const handleSetAsDefault = async (id) => {
    if (!db || !userId || !appId) {
      alert("Database connection or user authentication not available");
      return;
    }
    try {
      // 1. Check if the template exists
      const template = savedLayouts.find(l => l.id === id);
      if (!template) {
        alert("Template not found");
        return;
      }

      // 2. Get current preferences
      const preferencesRef = doc(db, `artifacts/${appId}/users/${userId}/preferences`, 'userPreferences');
      const preferencesSnap = await getDoc(preferencesRef);
      
      // 3. Prepare new preferences
      let defaultTemplateIdByType = {};
      if (preferencesSnap.exists()) {
        defaultTemplateIdByType = preferencesSnap.data().defaultTemplateIdByType || {};
      }
      
      // 4. Update default template for current type
      defaultTemplateIdByType[selectedType] = id;

      // 5. Save to Firebase
      await setDoc(preferencesRef, {
        defaultTemplateIdByType,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 6. Update local state
      setDefaultTemplateIdByType(prev => ({ ...prev, [selectedType]: id }));
      setDefaultTemplateId(id);

      // 7. Show success message
      alert(`Template "${template.name}" set as default for ${selectedType.toUpperCase()}`);
    } catch (err) {
      console.error("Error setting default template:", err);
      alert(`Failed to set template as default: ${err.message || 'Unknown error'}`);
    }
  };

  // Load default template
  const handleLoadDefaultTemplate = () => {
    if (!defaultTemplateId) {
      alert("No default template set. Please set a template as default first.");
      return;
    }
    handleViewLayout(defaultTemplateId);
  };

  // Print default template
  const handlePrintDefault = () => {
    if (!defaultTemplateId) {
      alert("No default template set. Please set a template as default first.");
      return;
    }
    const defaultLayout = savedLayouts.find(l => l.id === defaultTemplateId);
    if (!defaultLayout) {
      alert("Default template not found.");
      return;
    }
    
    // Load default template data temporarily for printing
    const layoutData = defaultLayout.data;
    const tempPaper = layoutData.paperSize === 'custom' && layoutData.customSize
      ? { width: layoutData.customSize.width, height: layoutData.customSize.height }
      : PAPER_SIZES.find(p => p.key === layoutData.paperSize) || PAPER_SIZES[0];
    const tempIsPortrait = layoutData.orientation === 'portrait';
    const tempPaperW = tempIsPortrait ? tempPaper.width : tempPaper.height;
    const tempPaperH = tempIsPortrait ? tempPaper.height : tempPaper.width;
    const tempMargin = layoutData.margin || { top: 10, right: 10, bottom: 10, left: 10 };
    const tempLayout = layoutData.layout || [];
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Default Template - ${defaultLayout.name}</title>
          <style>
            body { margin: 0; padding: 0; }
            .print-container {
              width: ${tempPaperW}mm;
              height: ${tempPaperH}mm;
              margin: 0 auto;
              background: white;
              position: relative;
              box-sizing: border-box;
              padding: ${tempMargin.top}mm ${tempMargin.right}mm ${tempMargin.bottom}mm ${tempMargin.left}mm;
            }
            .layout-row {
              display: flex;
              width: 100%;
              margin-bottom: 2px;
            }
            .layout-cell {
              flex: 1;
              border: 1px dashed #ccc;
              padding: 4px;
              font-size: 12px;
              min-height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            @media print {
              body { margin: 0; }
              .print-container { 
                width: ${tempPaperW}mm !important;
                height: ${tempPaperH}mm !important;
                margin: 0 !important;
                padding: ${tempMargin.top}mm ${tempMargin.right}mm ${tempMargin.bottom}mm ${tempMargin.left}mm !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${tempLayout.map((row, rowIdx) => `
              <div class="layout-row" style="height: ${row.height || 20}mm;">
                ${row.cells.map((cell, colIdx) => `
                  <div class="layout-cell" style="flex: ${row.columns > 1 ? 1 : 'none'};">
                    ${cell ? BLOCK_DISPLAY_NAMES[cell] || cell : '[Empty]'}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // Print current layout or default template
  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    // Get the current layout data
    const currentLayoutData = {
      paperSize,
      orientation,
      customSize,
      margin,
      layout,
      fontSettings,
      headerMainHead,
      headerMainHeadOther,
    };

    // Create print HTML
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Layout</title>
          <style>
            body { margin: 0; padding: 0; }
            .print-container {
              width: ${paperW}mm;
              height: ${paperH}mm;
              margin: 0 auto;
              background: white;
              position: relative;
              box-sizing: border-box;
              padding: ${margin.top}mm ${margin.right}mm ${margin.bottom}mm ${margin.left}mm;
            }
            .layout-row {
              display: flex;
              width: 100%;
              margin-bottom: 2px;
            }
            .layout-cell {
              flex: 1;
              border: 1px dashed #ccc;
              padding: 4px;
              font-size: 12px;
              min-height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            @media print {
              body { margin: 0; }
              .print-container { 
                width: ${paperW}mm !important;
                height: ${paperH}mm !important;
                margin: 0 !important;
                padding: ${margin.top}mm ${margin.right}mm ${margin.bottom}mm ${margin.left}mm !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${layout.map((row, rowIdx) => `
              <div class="layout-row" style="height: ${row.height || 20}mm;">
                ${row.cells.map((cell, colIdx) => `
                  <div class="layout-cell" style="flex: ${row.columns > 1 ? 1 : 'none'};">
                    ${cell ? BLOCK_DISPLAY_NAMES[cell] || cell : '[Empty]'}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // Delete layout from Firestore
  const handleDeleteLayout = async (id) => {
    if (!db || !userId || !appId) return;
    const colRef = collection(db, `artifacts/${appId}/users/${userId}/billLayouts`);
    await deleteDoc(doc(colRef, id));
    // Refresh list
    const querySnapshot = await getDocs(colRef);
    const layouts = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    setSavedLayouts(layouts);
    if (editingLayoutId === id) {
      setLayoutName("");
      setEditingLayoutId(null);
    }
    // If deleted template was default, clear default
    if (defaultTemplateId === id) {
      try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`, 'preferences');
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const defaultTemplateIdByType = userDoc.data().defaultTemplateIdByType || {};
          delete defaultTemplateIdByType[selectedType];
          await setDoc(userDocRef, { defaultTemplateIdByType }, { merge: true });
        }
        setDefaultTemplateId(null);
      } catch (err) {
        console.error("Error clearing default template:", err);
      }
    }
  };

  // Export layouts as JSON file
  const handleExportLayouts = () => {
    const dataStr = JSON.stringify(savedLayouts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bill_layouts.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import layouts from JSON file
  const handleImportLayouts = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error();
        // Merge, avoiding duplicate IDs
        setSavedLayouts(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const merged = [...prev];
          imported.forEach(l => {
            if (l && l.id && !existingIds.has(l.id)) merged.push(l);
          });
          return merged;
        });
      } catch {
        alert("Invalid layout file.");
      }
    };
    reader.readAsText(file);
    // Reset input value so same file can be imported again if needed
    e.target.value = "";
  };

  // Margin controls
  const handleMarginChange = (side, value) => {
    setMarginForType(margin => ({ ...margin, [side]: parseInt(value) || 0 }));
  };

  // Layout controls
  const addRow = () => setLayout(l => [...l, { columns: 1, cells: [null], height: 20, width: paperW - margin.left - margin.right }]);
  const removeRow = (idx) => setLayout(l => l.filter((_, i) => i !== idx));
  const setRowColumns = (idx, columns) => {
    setLayout(l => l.map((row, i) =>
      i === idx ? { ...row, columns, cells: Array(columns).fill(null).map((_, j) => row.cells[j] || null) } : row
    ));
  };
  const setCellSection = (rowIdx, colIdx, section) => {
    setLayout(l => l.map((row, i) =>
      i === rowIdx ? { ...row, cells: row.cells.map((cell, j) => j === colIdx ? section : cell) } : row
    ));
  };
  const setRowHeight = (idx, height) => {
    setLayout(l => l.map((row, i) =>
      i === idx ? { ...row, height: parseInt(height) || 1 } : row
    ));
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.3));
  const handleZoomReset = () => setZoom(2);

  // Helper to get header sublines based on main head
  function getHeaderSublines(mainHead, otherLabel) {
    switch (mainHead) {
      case 'Invoice':
        return [
          { key: 'invoiceNumber', label: 'Invoice Number' },
          { key: 'invoiceDate', label: 'Invoice Date' },
        ];
      case 'Challan':
        return [
          { key: 'challanNumber', label: 'Challan Number' },
          { key: 'challanDate', label: 'Challan Date' },
        ];
      case 'Quotation':
        return [
          { key: 'quotationNumber', label: 'Quotation Number' },
          { key: 'quotationDate', label: 'Quotation Date' },
        ];
      case 'Purchase Order':
        return [
          { key: 'purchaseOrderNumber', label: 'Purchase Order Number' },
          { key: 'purchaseOrderDate', label: 'Purchase Order Date' },
        ];
      case 'Other':
        return [
          { key: 'documentNumber', label: (otherLabel || 'Document Number') },
          { key: 'documentDate', label: (otherLabel ? `${otherLabel} Date` : 'Document Date') },
        ];
      default:
        return [];
    }
  }

  // Patch loaded fontSettings to ensure all required sublines exist
  function mergeFontSettings(loaded, defaults) {
    const merged = { ...defaults };
    for (const block of Object.keys(defaults)) {
      if (!loaded[block]) continue;
      merged[block] = { ...defaults[block], ...loaded[block] };
      if (defaults[block].sublines) {
        merged[block].sublines = { ...defaults[block].sublines, ...(loaded[block].sublines || {}) };
        // Patch width for itemTable sublines
        if (block === 'itemTable') {
          for (const subKey of Object.keys(merged[block].sublines)) {
            if (merged[block].sublines[subKey].width === undefined) {
              merged[block].sublines[subKey].width = 30; // default width in mm
            }
          }
          // Ensure every key in sequence has a subline object
          const seq = merged[block].sequence || defaults[block].sequence;
          seq.forEach(key => {
            if (!merged[block].sublines[key]) {
              merged[block].sublines[key] = { ...defaults[block].sublines[key] };
            }
          });
        }
        // Ensure all bankDetails sublines exist
        if (block === 'bankDetails' && BLOCK_SUBLINES.bankDetails) {
          BLOCK_SUBLINES.bankDetails.forEach(sub => {
            if (!merged[block].sublines[sub.key]) {
              merged[block].sublines[sub.key] = {
                fontSize: 14,
                fontFamily: "",
                fontWeight: "normal",
                color: "#222222",
                visible: true,
                fontStyle: "normal",
                textDecoration: "none",
                letterSpacing: 0,
                textTransform: "none",
                lineHeight: 1.2,
              };
            }
          });
        }
        
        // --- Auto-fit logic for itemTable saved templates ---
        if (block === 'itemTable') {
          // Calculate available table width (in mm)
          const paperW = loaded.paperSize && loaded.paperSize === 'custom' && loaded.customSize ? loaded.customSize.width : (loaded.paperSize ? (PAPER_SIZES.find(p => p.key === loaded.paperSize)?.width || 210) : 210);
          const margin = loaded.margin || { left: 10, right: 10 };
          const tableWidthMm = paperW - (margin.left || 10) - (margin.right || 10);
          // Get all visible columns (including GST sub-columns)
          const sequence = merged[block].sequence || defaults[block].sequence;
          if (!Array.isArray(sequence)) return; // Safety check
          const gstSubs = ['SGST', 'CGST', 'IGST'].filter(gstKey => merged[block].gstColumns && merged[block].gstColumns[gstKey]);
          const visibleColumns = sequence
            .map(key => BLOCK_SUBLINES.itemTable?.find(s => s.key === key))
            .filter(sub => sub && merged[block].sublines[sub.key] && merged[block].sublines[sub.key].visible);
          const allColWidths = visibleColumns.flatMap(sub =>
            sub.key === 'gst'
              ? gstSubs.map(gstKey => merged[block].gst[gstKey]?.width || 30)
              : [merged[block].sublines[sub.key]?.width || 30]
          );
          const totalColWidth = allColWidths.reduce((a, b) => a + b, 0) || 1;
          const scale = tableWidthMm / totalColWidth;
          // Scale all column widths
          visibleColumns.forEach(sub => {
            if (sub.key === 'gst') {
              gstSubs.forEach(gstKey => {
                if (merged[block].gst[gstKey]) {
                  merged[block].gst[gstKey].width = (merged[block].gst[gstKey].width || 30) * scale;
                }
              });
            } else {
              merged[block].sublines[sub.key].width = (merged[block].sublines[sub.key].width || 30) * scale;
            }
          });
          // --- End auto-fit logic ---
        }
      }
      if (block === 'header') {
        merged[block].mainHead = loaded[block].mainHead || defaults[block].mainHead;
      }
      if (defaults[block].gst) {
        merged[block].gst = { ...defaults[block].gst, ...(loaded[block].gst || {}) };
      }
      if (defaults[block].gstColumns) {
        merged[block].gstColumns = { ...defaults[block].gstColumns, ...(loaded[block].gstColumns || {}) };
      }
      if (defaults[block].customLines) {
        merged[block].customLines = loaded[block].customLines || [];
      }
      if (defaults[block].sequence) {
        merged[block].sequence = loaded[block].sequence || defaults[block].sequence;
      }
    }
    return merged;
  }

  useEffect(() => {
    // Ensure all sublines for the selected Main Head exist in fontSettings.header.sublines
    const neededSublines = getHeaderSublines(headerMainHead, headerMainHeadOther);
    setFontSettings(fs => {
      const updated = { ...fs };
      updated.header = { ...fs.header, sublines: { ...fs.header.sublines } };
      neededSublines.forEach(sub => {
        if (!updated.header.sublines[sub.key]) {
          updated.header.sublines[sub.key] = {
            fontSize: 14,
            fontFamily: "",
            fontWeight: "normal",
            color: "#222222",
            visible: true,
            fontStyle: "normal",
            textDecoration: "none",
            letterSpacing: 0,
            textTransform: "none",
            lineHeight: 1.2,
          };
        }
      });
      return updated;
    });
  }, [headerMainHead, headerMainHeadOther]);

  // Ensure all bankDetails sublines exist
  useEffect(() => {
    setFontSettings(fs => {
      const updated = { ...fs };
      if (!updated.bankDetails) {
        updated.bankDetails = { sublines: {}, customLines: [] };
      }
      if (!updated.bankDetails.sublines) {
        updated.bankDetails.sublines = {};
      }
      
      BLOCK_SUBLINES.bankDetails?.forEach(sub => {
        if (!updated.bankDetails.sublines[sub.key]) {
          updated.bankDetails.sublines[sub.key] = {
            fontSize: 14,
            fontFamily: "",
            fontWeight: "normal",
            color: "#222222",
            visible: true,
            fontStyle: "normal",
            textDecoration: "none",
            letterSpacing: 0,
            textTransform: "none",
            lineHeight: 1.2,
          };
        }
      });
      return updated;
    });
  }, []);

  function handleItemTableDragStart(idx) { setItemTableDragCol(idx); }
  function handleItemTableDrop(idx, sequence) {
    if (itemTableDragCol === null || itemTableDragCol === idx) return;
    const newSeq = [...sequence];
    const [removed] = newSeq.splice(itemTableDragCol, 1);
    newSeq.splice(idx, 0, removed);
    setFontSettings(fs => ({
      ...fs,
      itemTable: {
        ...fs.itemTable,
        sequence: newSeq,
      },
    }));
    setItemTableDragCol(null);
  }
  function handleItemTableMouseDown(e, colKey, fontSettings) {
    setItemTableResizingCol(colKey);
    setItemTableStartX(e.clientX);
    setItemTableStartWidth(fontSettings.itemTable.sublines[colKey]?.width || 30);
    document.body.style.cursor = 'col-resize';
  }
  function handleItemTableMouseUp(e, fontSettings) {
    if (!itemTableResizingCol) return;
    const dx = e.clientX - itemTableStartX;
    const newWidth = Math.max(10, itemTableStartWidth + dx / 3.78);
    setFontSettings(fs => ({
      ...fs,
      itemTable: {
        ...fs.itemTable,
        sublines: {
          ...fs.itemTable.sublines,
          [itemTableResizingCol]: {
            ...fs.itemTable.sublines[itemTableResizingCol],
            width: newWidth,
          },
        },
      },
    }));
    setItemTableResizingCol(null);
    document.body.style.cursor = '';
  }

  // Render thumbnail for a saved layout
  const renderThumbnail = (layout) => {
    const layoutData = layout.data;
    const thumbPaper = layoutData.paperSize === 'custom' && layoutData.customSize
      ? { width: layoutData.customSize.width, height: layoutData.customSize.height }
      : PAPER_SIZES.find(p => p.key === layoutData.paperSize) || PAPER_SIZES[0];
    const thumbIsPortrait = layoutData.orientation === 'portrait';
    const thumbPaperW = thumbIsPortrait ? thumbPaper.width : thumbPaper.height;
    const thumbPaperH = thumbIsPortrait ? thumbPaper.height : thumbPaper.width;
    const thumbMargin = layoutData.margin || { top: 10, right: 10, bottom: 10, left: 10 };
    const thumbLayout = layoutData.layout || [];
    const thumbFontSettings = layoutData.fontSettings || DEFAULT_FONT_SETTINGS;
    const thumbHeaderMainHead = layoutData.headerMainHead || 'Invoice';
    
    const thumbMmToPx = mm => mm * 0.5; // Smaller scale for thumbnails
    
    return (
      <div
        key={layout.id}
        className={`group cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200 ${
          defaultTemplateId === layout.id
            ? 'border-green-500 shadow-lg bg-green-50'
            : selectedThumbnail === layout.id 
              ? 'border-blue-500 shadow-lg' 
              : 'border-gray-300 hover:border-blue-300'
        }`}
        onClick={() => setSelectedThumbnail(layout.id)}
        onDoubleClick={() => handleViewLayout(layout.id)}
        style={{
          width: '150px',
          height: '200px',
          background: defaultTemplateId === layout.id ? '#f0fdf4' : '#fff',
          position: 'relative',
        }}
      >
        <div
          className="relative w-full h-full"
          style={{
            padding: `${thumbMmToPx(thumbMargin.top)}px ${thumbMmToPx(thumbMargin.right)}px ${thumbMmToPx(thumbMargin.bottom)}px ${thumbMmToPx(thumbMargin.left)}px`,
            background: '#fff',
            overflow: 'hidden',
          }}
        >
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-start',
            fontSize: '6px',
            lineHeight: '1.2',
          }}>
            {thumbLayout.map((row, rowIdx) => (
              <div key={rowIdx} className="flex"
                style={{
                  height: row.height ? thumbMmToPx(row.height) : thumbMmToPx(10),
                  width: '100%',
                  margin: '0 auto',
                  padding: 0,
                  gap: 0,
                  boxSizing: 'border-box',
                  overflow: 'visible',
                  marginBottom: rowIdx < thumbLayout.length - 1 ? 1 : 0,
                }}
              >
                {row.cells.map((cell, colIdx) => (
                  <div
                    key={colIdx}
                    className="flex-1 min-h-[8px] border border-dashed border-gray-200 bg-gray-50 flex flex-col justify-center p-1"
                    style={{ fontSize: '5px' }}
                  >
                    {cell === 'itemTable' ? (
                      <div className="text-center text-gray-500">[Table]</div>
                    ) : cell === 'gstDetails' ? (
                      <div className="text-center text-gray-500">[GST]</div>
                    ) : cell === 'header' ? (
                      <div className="text-center font-bold" style={{ fontSize: '6px' }}>
                        {thumbHeaderMainHead}
                      </div>
                    ) : cell ? (
                      <div className="text-center text-gray-600" style={{ fontSize: '5px' }}>
                        {BLOCK_DISPLAY_NAMES[cell] || cell}
                      </div>
                    ) : (
                      <div className="text-center text-gray-300" style={{ fontSize: '4px' }}>
                        [Empty]
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Default template indicator */}
        {defaultTemplateId === layout.id && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
            DEFAULT
          </div>
        )}
        
        {/* Overlay buttons */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewLayout(layout.id);
            }}
            className="w-7 h-7 bg-gray-800 bg-opacity-90 text-white rounded-md flex items-center justify-center text-sm hover:bg-opacity-100 hover:scale-110 transition-all duration-200 shadow-lg"
            title="View Layout"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditLayout(layout.id);
            }}
            className="w-7 h-7 bg-gray-800 bg-opacity-90 text-white rounded-md flex items-center justify-center text-sm hover:bg-opacity-100 hover:scale-110 transition-all duration-200 shadow-lg"
            title="Edit Layout"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSetAsDefault(layout.id);
            }}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-sm hover:scale-110 transition-all duration-200 shadow-lg ${
              defaultTemplateId === layout.id 
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-md' 
                : 'bg-gray-800 bg-opacity-90 text-white hover:bg-opacity-100 hover:bg-green-600'
            }`}
            title={defaultTemplateId === layout.id ? "Default Template (Click to change)" : "Set as Default"}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteLayout(layout.id);
            }}
            className="w-7 h-7 bg-gray-800 bg-opacity-90 text-white rounded-md flex items-center justify-center text-sm hover:bg-opacity-100 hover:scale-110 transition-all duration-200 shadow-lg"
            title="Delete Layout"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
        
        <div className={`absolute bottom-0 left-0 right-0 text-white text-xs p-1 truncate font-medium ${
          defaultTemplateId === layout.id 
            ? 'bg-green-600 bg-opacity-90' 
            : 'bg-black bg-opacity-50'
        }`} style={{ maxWidth: '100%' }}>
          {defaultTemplateId === layout.id && '⭐ '}{layout.name}
        </div>
      </div>
    );
  };

  // Add this helper function at the top level
  const getDefaultFontStyle = (block, key) => ({
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    fontWeight: "normal",
    color: "#2d3748",
    fontStyle: "normal",
    textDecoration: "none",
    letterSpacing: 0,
    textTransform: "none",
    lineHeight: 1.4,
    visible: true,
  });

  // If billOverride is present, we're in print mode
  if (billOverride) {
    const companyDetails = billOverride.companyDetails || {};
    const partyDetails = billOverride.partyDetails || {};
    const items = billOverride.items || [];
    const rows = billOverride.rows || [];

    const defaultTemplateId = defaultTemplateIdByType[billOverride.docType || 'invoice'];
    const defaultTemplate = savedLayoutsByType[billOverride.docType || 'invoice']?.find(l => l.id === defaultTemplateId);
    const templateData = defaultTemplate?.data || { layout: defaultLayout, margin: { top: 10, right: 10, bottom: 10, left: 10 } };
    const layout = templateData.layout || defaultLayout;
    const margin = templateData.margin || { top: 10, right: 10, bottom: 10, left: 10 };

    // Dynamic document type label
    const docTypeLabel = {
      invoice: 'TAX INVOICE',
      challan: 'CHALLAN',
      quotation: 'QUOTATION',
      purchase_bill: 'PURCHASE BILL',
      purchase_order: 'PURCHASE ORDER'
    }[billOverride.docType] || 'INVOICE';
    // Dynamic number label
    const numberLabel = {
      invoice: 'Invoice Number',
      challan: 'Challan Number',
      quotation: 'Quotation Number',
      purchase_bill: 'Purchase Bill Number',
      purchase_order: 'Purchase Order Number'
    }[billOverride.docType] || 'Number';

    return (
      <div className="flex justify-center items-start min-h-screen bg-gray-100 p-4">
        <div
          className="bg-white shadow-lg"
          style={{
            width: '900px',
            margin: 'auto',
            padding: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
            boxSizing: 'border-box'
          }}
        >
          {layout.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', marginBottom: 8, minHeight: 60 }}>
              {row.cells.map((cell, colIdx) => {
                if (!cell) return <div key={colIdx} style={{ flex: 1 }} />;
                // Render each block with real data
                if (rowIdx === 0 && colIdx === 0 && cell === 'header') {
                  // Row 1, Col 1: Document type, number, date
                  return (
                    <div key={colIdx} style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                      <div className="text-xl font-bold">{docTypeLabel}</div>
                      <div>{numberLabel}: {billOverride.number || ''}</div>
                      <div>Date: {billOverride.invoiceDate || ''}</div>
          </div>
                  );
                }
                if (rowIdx === 0 && colIdx === 1 && cell === 'logo') {
                  // Row 1, Col 2: Company logo
                  return (
                    <div key={colIdx} style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      {companyDetails.logoUrl ? (
                        <img src={companyDetails.logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: 120, margin: '0 auto', objectFit: 'contain', display: 'block' }} />
                      ) : (
                        <span className="text-gray-400">No Logo</span>
                      )}
                    </div>
                  );
                }
                // ...rest of the switch/cases for other blocks...
                switch (cell) {
                  case 'header':
                    return (
                      <div key={colIdx} style={{ flex: 1, textAlign: 'center' }}>
                        <h1 className="text-2xl font-bold">{companyDetails.firmName || ''}</h1>
                        <div>{companyDetails.address || ''}</div>
            <div>
                          {companyDetails.city || ''} {companyDetails.state ? `, ${companyDetails.state}` : ''} 
                          {companyDetails.pincode ? ` - ${companyDetails.pincode}` : ''}
            </div>
                        <div>GSTIN: {companyDetails.gstin || ''}</div>
                        <div>Contact: {companyDetails.contactNumber || ''}</div>
            </div>
                    );
                  case 'billedBy':
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        <b>Billed By:</b>
                        <div>{companyDetails.firmName || ''}</div>
                        <div>{companyDetails.address || ''}</div>
                        <div>GSTIN: {companyDetails.gstin || ''}</div>
                        <div>Contact: {companyDetails.contactNumber || ''}</div>
          </div>
                    );
                  case 'billedTo':
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        <b>Bill To:</b>
                        <div>{partyDetails.firmName || ''}</div>
                        <div>{partyDetails?.address || ''}</div>
                        <div>GSTIN: {partyDetails?.gstin || ''}</div>
                        <div>Contact: {partyDetails?.contactNumber || ''}</div>
            </div>
                    );
                  case 'shippedTo':
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        <b>Ship To:</b>
                        <div>{partyDetails.firmName || ''}</div>
                        <div>{partyDetails?.address || ''}</div>
                        <div>GSTIN: {partyDetails?.gstin || ''}</div>
                        <div>Contact: {partyDetails?.contactNumber || ''}</div>
            </div>
                    );
                  case 'itemTable':
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        {/* Item Table */}
            <table className="w-full border-collapse">
              <thead className="bg-gray-800 text-white">
                <tr>
                              <th className="border px-2 py-1">Sr.</th>
                              <th className="border px-2 py-1">Item Description</th>
                              <th className="border px-2 py-1">HSN</th>
                              <th className="border px-2 py-1">Qty</th>
                              <th className="border px-2 py-1">Rate</th>
                              <th className="border px-2 py-1">Amount</th>
                              <th className="border px-2 py-1">GST %</th>
                              <th className="border px-2 py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                            {rows.map((row, idx) => {
                              const itemObj = items.find(it => it.id === row.item) || {};
                  return (
                                <tr key={idx}>
                                  <td className="border px-2 py-1 text-center">{idx + 1}</td>
                                  <td className="border px-2 py-1">
                                    <div>{itemObj.itemName || ''}</div>
                                    {(row.nos || row.length || row.height) && (
                                      <div style={{ fontSize: '0.85em', fontStyle: 'italic', color: '#555' }}>
                                        {[
                                          row.nos && parseFloat(row.nos) !== 0 ? row.nos : null,
                                          row.length && parseFloat(row.length) !== 1 && parseFloat(row.length) !== 0 ? row.length : null,
                                          row.height && parseFloat(row.height) !== 1 && parseFloat(row.height) !== 0 ? row.height : null
                                        ].filter(Boolean).join('x')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="border px-2 py-1">{itemObj.hsnCode || ''}</td>
                                  <td className="border px-2 py-1 text-center">{row.qty}</td>
                                  <td className="border px-2 py-1 text-right">{row.rate}</td>
                                  <td className="border px-2 py-1 text-right">{row.amount}</td>
                                  <td className="border px-2 py-1 text-center">{round2((parseFloat(row.sgst) || 0) + (parseFloat(row.cgst) || 0) + (parseFloat(row.igst) || 0))}%</td>
                                  <td className="border px-2 py-1 text-right">{row.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
                    );
                  case 'bankDetails':
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        <b>Bank & Payment Details:</b>
                        <div>{companyDetails.bankName || ''}</div>
                        <div>{companyDetails.bankAccount ? `A/C: ${companyDetails.bankAccount}` : ''}</div>
                        <div>{companyDetails.bankIfsc ? `IFSC: ${companyDetails.bankIfsc}` : ''}</div>
                        <div>{companyDetails.upiId ? `UPI: ${companyDetails.upiId}` : ''}</div>
                      </div>
                    );
                  case 'totals': {
                    // Group rows by GST %
                    const gstGroups = {};
                    rows.forEach(row => {
                      const gstPercent = parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0);
                      if (!gstGroups[gstPercent]) gstGroups[gstPercent] = { taxable: 0, sgst: 0, cgst: 0, igst: 0 };
                      gstGroups[gstPercent].taxable += parseFloat(row.amount) || 0;
                      gstGroups[gstPercent].sgst += ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100) || 0;
                      gstGroups[gstPercent].cgst += ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100) || 0;
                      gstGroups[gstPercent].igst += ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100) || 0;
                    });
                    const subtotal = rows?.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0) || 0;
                    const totalSGST = rows?.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0) || 0;
                    const totalCGST = rows?.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0) || 0;
                    const totalIGST = rows?.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0) || 0;
                    const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        <b>Totals (GST % wise):</b>
                        <table className="w-full border-collapse text-xs mt-1 mb-2">
                          <thead>
                            <tr>
                              <th className="border px-1 py-0.5 text-center align-middle">GST %</th>
                              <th className="border px-1 py-0.5 text-center align-middle">Taxable</th>
                              <th className="border px-1 py-0.5 text-center align-middle">SGST</th>
                              <th className="border px-1 py-0.5 text-center align-middle">CGST</th>
                              <th className="border px-1 py-0.5 text-center align-middle">IGST</th>
                              <th className="border px-1 py-0.5 text-center align-middle">Total Tax</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(gstGroups).map(([gst, vals]) => (
                              <tr key={gst}>
                                <td className="border px-1 py-0.5 text-center align-middle">{gst}%</td>
                                <td className="border px-1 py-0.5 text-center align-middle">{round2(vals.taxable)}</td>
                                <td className="border px-1 py-0.5 text-center align-middle">{round2(vals.sgst)}</td>
                                <td className="border px-1 py-0.5 text-center align-middle">{round2(vals.cgst)}</td>
                                <td className="border px-1 py-0.5 text-center align-middle">{round2(vals.igst)}</td>
                                <td className="border px-1 py-0.5 text-center align-middle">{round2(vals.sgst + vals.cgst + vals.igst)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div>Taxable Amount: {round2(subtotal)}</div>
                        <div>SGST: {round2(totalSGST)}</div>
                        <div>CGST: {round2(totalCGST)}</div>
                        <div>IGST: {round2(totalIGST)}</div>
                        <div>Grand Total: {round2(grandTotal)}</div>
                      </div>
                    );
                  }
                  case 'gst':
                    // You can render a GST summary or details here, or combine with totals if needed
                    return null; // Placeholder, or implement as needed
                  case 'terms':
                    return (
                      <div key={colIdx} style={{ flex: 1 }}>
                        <b>Terms and Conditions:</b>
                        <div>{companyDetails.terms || 'Thank you for your business!'}</div>
                      </div>
                    );
                  default:
                    return <div key={colIdx} style={{ flex: 1 }} />;
                }
              })}
              </div>
          ))}
          {/* Payment Details Section (after all layout rows) */}
          {billOverride && (() => {
            const payments = billOverride.payments || [];
            const rows = billOverride.rows || [];
            const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
            const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
            const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
            const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
            const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;
            const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const remainingDue = round2(grandTotal - totalPaid);
            return (
              <div className="bill-payments-section mt-2" style={{ maxWidth: 600, margin: '0 auto', fontSize: '12px' }}>
                <b>Payment Details:</b>
                <div className="mb-1">
                  <span className="font-medium">Status: </span>{totalPaid >= grandTotal ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid'}
                  <span className="ml-4 font-medium">Total Paid: </span>₹{totalPaid.toFixed(2)}
                  <span className="ml-4 font-medium text-red-600">Remaining Due: </span>₹{remainingDue.toFixed(2)}
                </div>
                <table className="w-full text-xs mb-2 border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">Amount</th>
                      <th className="border px-2 py-1">Date</th>
                      <th className="border px-2 py-1">Mode</th>
                      <th className="border px-2 py-1">Reference/Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, idx) => (
                      <tr key={idx}>
                        <td className="border px-2 py-1 text-right">₹{parseFloat(p.amount).toFixed(2)}</td>
                        <td className="border px-2 py-1">{p.date}</td>
                        <td className="border px-2 py-1">{p.mode}</td>
                        <td className="border px-2 py-1">{p.reference}</td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-2">No payments yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {companyDetails.footer && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 12 }}>
              {companyDetails.footer || `Generated on ${new Date().toLocaleDateString('en-IN')} | ${companyDetails.firmName || ''}`}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular template editor UI
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Bill Templates</h2>
      <div className="flex space-x-2 mb-6">
        {DOCUMENT_TYPES.map((type) => (
          <button
            key={type.key}
            className={`px-4 py-2 rounded-t ${selectedType === type.key ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"}`}
            onClick={() => setSelectedType(type.key)}
          >
            {type.label}
          </button>
        ))}
      </div>
      {selectedType === "invoice" && (
        <div className="flex gap-8 items-start">
          {/* Layout controls - left */}
          <div className="w-96 min-w-[320px] bg-gray-50 border rounded-lg p-4 flex flex-col gap-4 sticky top-4 h-fit overflow-x-auto">
            {/* Page Options */}
            <div className="mb-2 font-semibold">Page Options</div>
            <div className="mb-2">
              <label className="block font-medium mb-1">Orientation</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={orientation}
                onChange={e => setOrientation(e.target.value)}
              >
                {ORIENTATIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="block font-medium mb-1">Page Size</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={paperSize}
                onChange={e => setPaperSize(e.target.value)}
              >
                {PAPER_SIZES.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>
            {paperSize === 'custom' && (
              <div className="mb-2 flex gap-2">
                <div>
                  <label className="block text-sm">Width (mm)</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-20"
                    min={1}
                    value={customSize.width}
                    onChange={e => setCustomSize(cs => ({ ...cs, width: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <label className="block text-sm">Height (mm)</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-20"
                    min={1}
                    value={customSize.height}
                    onChange={e => setCustomSize(cs => ({ ...cs, height: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
            )}
            {/* End Page Options */}
            <div className="mb-2 font-semibold">Page Margin (mm)</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <label>Top <input type="number" className="border rounded px-2 py-1 w-16 ml-2" value={margin.top} onChange={e => handleMarginChange("top", e.target.value)} /></label>
              <label>Right <input type="number" className="border rounded px-2 py-1 w-16 ml-2" value={margin.right} onChange={e => handleMarginChange("right", e.target.value)} /></label>
              <label>Bottom <input type="number" className="border rounded px-2 py-1 w-16 ml-2" value={margin.bottom} onChange={e => handleMarginChange("bottom", e.target.value)} /></label>
              <label>Left <input type="number" className="border rounded px-2 py-1 w-16 ml-2" value={margin.left} onChange={e => handleMarginChange("left", e.target.value)} /></label>
            </div>
            <div className="mb-2 font-semibold">Layout Rows</div>
            {layout.map((row, rowIdx) => (
              <div key={rowIdx} className="mb-2 border rounded p-2 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">Row {rowIdx + 1}</span>
                  <button className="text-red-500 text-xs ml-auto" onClick={() => removeRow(rowIdx)}>Remove</button>
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <label>Columns:</label>
                  <select className="border rounded px-2 py-1" value={row.columns} onChange={e => setRowColumns(rowIdx, parseInt(e.target.value))}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <label className="ml-4">Row Height (mm):</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-16 max-w-full"
                    min={1}
                    value={row.height || 20}
                    onChange={e => setRowHeight(rowIdx, e.target.value)}
                  />
                  <label className="ml-4">Row Width (mm):</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-16 max-w-full"
                    min={10}
                    max={paperW - margin.left - margin.right}
                    value={row.width !== undefined ? row.width : (paperW - margin.left - margin.right)}
                    onChange={e => setLayout(l => l.map((r, i) => i === rowIdx ? { ...r, width: parseInt(e.target.value) || (paperW - margin.left - margin.right) } : r))}
                  />
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.columns}, minmax(0, 1fr))` }}>
                  {row.cells.map((cell, colIdx) => (
                    <select
                      key={colIdx}
                      className="border rounded px-2 py-1 bg-gray-100"
                      value={cell || ""}
                      onChange={e => setCellSection(rowIdx, colIdx, e.target.value)}
                    >
                      <option value="">[Empty]</option>
                      {BLOCK_LIBRARY.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            ))}
            <button className="bg-blue-500 text-white px-4 py-2 rounded mt-2" onClick={addRow}>+ Add Row</button>
            
            {/* Default Template Section */}
            <div className={`mt-4 p-3 border rounded-lg transition-all duration-200 ${
              defaultTemplateId 
                ? 'bg-green-50 border-green-300 shadow-sm' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`mb-2 font-semibold ${
                defaultTemplateId ? 'text-green-800' : 'text-gray-700'
              }`}>
                {defaultTemplateId ? '✅ Default Template' : '📋 Default Template'}
              </div>
              {defaultTemplateId ? (
                <div className="text-sm text-green-700 mb-2 font-medium">
                  📄 {savedLayouts.find(l => l.id === defaultTemplateId)?.name || 'Unknown'}
                </div>
              ) : (
                <div className="text-sm text-gray-600 mb-2">
                  No default template set
                </div>
              )}
              <div className="flex gap-2">
                <button 
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={handleLoadDefaultTemplate}
                  disabled={!defaultTemplateId}
                  title={defaultTemplateId ? "Load default template" : "Set a template as default first"}
                >
                  📄 Load
                </button>
                <button 
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={handlePrintDefault}
                  disabled={!defaultTemplateId}
                  title={defaultTemplateId ? "Print default template" : "Set a template as default first"}
                >
                  🖨️ Print
                </button>
              </div>
            </div>



            {/* Font Settings Section */}
            {/* Removed as per edit hint */}
          </div>
          {/* Preview - right */}
          <div className="flex-1 flex flex-col items-center">
            {/* Layout Name at Top */}
            <div className="w-full mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800">Current Layout</h3>
                  <p className="text-sm text-blue-600">
                    {editingLayoutId 
                      ? `Editing: ${savedLayouts.find(l => l.id === editingLayoutId)?.name || 'Unknown'}`
                      : layoutName.trim() 
                        ? `Draft: ${layoutName}` 
                        : 'New Layout (Unsaved)'
                    }
                  </p>
                </div>
                {editingLayoutId && (
                  <button
                    onClick={() => {
                      setEditingLayoutId(null);
                      setLayoutName('');
                    }}
                    className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-semibold mb-2">Live Layout Preview</h3>
            <div className="flex gap-2 mb-2 items-center">
              <button className="px-2 py-1 bg-gray-200 rounded text-lg" onClick={handleZoomOut} title="Zoom Out">-</button>
              <span className="font-semibold text-sm">{Math.round(zoom * 100)}%</span>
              <button className="px-2 py-1 bg-gray-200 rounded text-lg" onClick={handleZoomIn} title="Zoom In">+</button>
              <button className="px-2 py-1 bg-gray-100 rounded text-xs ml-2" onClick={handleZoomReset} title="Reset Zoom">Reset</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm ml-4 hover:bg-blue-700 transition-colors" onClick={handlePrint} title="Print Layout">
                🖨️ Print
              </button>
            </div>
            <div
              className="border-2 border-gray-300 rounded bg-white shadow-lg flex flex-col items-center justify-center w-full h-full"
              style={{
                maxWidth: "100%",
                maxHeight: "95vh",
                aspectRatio: `${paperW} / ${paperH}`,
                width: `${mmToPx(paperW)}px`,
                height: `${mmToPx(paperH)}px`,
                minWidth: mmToPx(100),
                minHeight: mmToPx(140),
                background: "#fff",
                transition: "width 0.2s, height 0.2s",
                padding: `${mmToPx(margin.top)}px ${mmToPx(margin.right)}px ${mmToPx(margin.bottom)}px ${mmToPx(margin.left)}px`
              }}
            >
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                {layout.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex"
                    style={{
                      height: row.height ? mmToPx(row.height) : mmToPx(20),
                      width: mmToPx(row.width !== undefined ? row.width : (paperW - margin.left - margin.right)),
                      maxWidth: mmToPx(paperW - margin.left - margin.right),
                      margin: '0 auto',
                      padding: 0,
                      gap: 0,
                      boxSizing: 'border-box',
                      overflow: 'visible',
                      marginBottom: rowIdx < layout.length - 1 ? 2 : 0,
                    }}
                  >
                    {row.cells.map((cell, colIdx) => (
                      <div
                        key={colIdx}
                        className="flex-1 min-h-[40px] border border-dashed border-gray-300 bg-gray-50 flex flex-col justify-center p-2"
                        onDoubleClick={e => {
                          if (!cell) return;
                          const rect = e.target.getBoundingClientRect();
                          setFontEditor({ open: true, block: cell, pos: { x: rect.right + window.scrollX + 8, y: rect.top + window.scrollY } });
                        }}
                      >
                        {cell === 'itemTable' ? (
                          <ItemTable 
                            widthMm={row.width || 190} 
                            items={billData?.rows || []} 
                            db={db} 
                            userId={userId} 
                            isAuthReady={isAuthReady} 
                            appId={appId} 
                          />
                        ) : cell === 'gstDetails' ? (
                          <GstDetailsTable widthMm={row.width || 190} db={db} userId={userId} isAuthReady={isAuthReady} appId={appId} />
                        ) : (
                          <div className="p-4">
                            {Object.entries(mapDataToBlock(cell) || {}).map(([key, value]) => {
                              // Get font settings with fallbacks
                              const blockSettings = fontSettings?.[cell] || DEFAULT_FONT_SETTINGS[cell] || {};
                              const sublineSettings = blockSettings?.sublines?.[key] || getDefaultFontStyle(cell, key);
                              
                              // Skip if not visible
                              if (sublineSettings.visible === false) return null;

                              return (
                                <div key={key} style={{
                                  fontSize: sublineSettings.fontSize || 14,
                                  fontFamily: sublineSettings.fontFamily || "Arial, sans-serif",
                                  fontWeight: sublineSettings.fontWeight || "normal",
                                  color: sublineSettings.color || "#2d3748",
                                  fontStyle: sublineSettings.fontStyle || "normal",
                                  textDecoration: sublineSettings.textDecoration || "none",
                                  letterSpacing: sublineSettings.letterSpacing || 0,
                                  textTransform: sublineSettings.textTransform || "none",
                                  lineHeight: sublineSettings.lineHeight || 1.4,
                                  marginBottom: "0.5rem"
                                }}>
                                  {value}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {fontSettings[cell]?.customLines?.map((line, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: line.fontSize || 14,
                              color: line.color || "#222222",
                            }}
                          >
                            {line.label} {line.value}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Save Layout Section at Bottom */}
            <div className="w-full mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block font-medium mb-2 text-gray-700">Layout Name</label>
                  <input
                    type="text"
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Enter layout name..."
                    value={layoutName}
                    onChange={e => setLayoutName(e.target.value)}
                  />
                </div>
                <button
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
                  onClick={handleSaveLayout}
                  disabled={!layoutName.trim() || loadingLayouts}
                >
                  {loadingLayouts ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      💾 {editingLayoutId ? "Update Layout" : "Save Layout"}
                    </span>
                  )}
                </button>
              </div>
              {editingLayoutId && (
                <div className="mt-2 text-sm text-amber-600">
                  ⚠️ You are editing an existing layout. Click "Update Layout" to save changes.
                </div>
              )}
            </div>
          </div>
          
          {/* Thumbnail Sidebar - right */}
          <div className={`transition-all duration-300 ${showThumbnails ? 'w-64' : 'w-8'} bg-gray-100 border-l border-gray-300 flex flex-col`}>
            {/* Toggle button */}
            <div className="p-2 border-b border-gray-300">
              <button
                onClick={() => setShowThumbnails(!showThumbnails)}
                className="w-full flex items-center justify-center p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                title={showThumbnails ? "Hide Thumbnails" : "Show Thumbnails"}
              >
                {showThumbnails ? (
                  <>
                    <span className="mr-2">Hide</span>
                    <span>👁️</span>
                  </>
                ) : (
                  <>
                    <span>👁️</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Thumbnails container */}
            {showThumbnails && (
              <div className="flex-1 p-4 overflow-y-auto">
                <h4 className="font-semibold mb-3 text-gray-700">Saved Layouts</h4>
                {loadingLayouts ? (
                  <div className="text-gray-400 text-center">Loading...</div>
                ) : savedLayouts.length === 0 ? (
                  <div className="text-gray-400 text-center text-sm">No layouts saved</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {savedLayouts.map(layout => renderThumbnail(layout))}
                  </div>
                )}
                

                
                {/* Import/Export Layouts */}
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <h5 className="font-medium mb-2 text-sm">Import/Export</h5>
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full text-xs bg-emerald-600 text-white px-3 py-2 rounded-md hover:bg-emerald-700 transition-colors duration-200 shadow-sm flex items-center justify-center gap-1"
                      onClick={handleExportLayouts}
                      disabled={savedLayouts.length === 0}
                    >
                      📤 Export
                    </button>
                    <input
                      type="file"
                      accept="application/json"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleImportLayouts}
                    />
                    <button
                      className="w-full text-xs bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 transition-colors duration-200 shadow-sm flex items-center justify-center gap-1"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    >
                      📥 Import
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {fontEditor.open && fontEditor.block && (
        <div
          ref={fontEditorRef}
          style={{
            position: "absolute",
            left: fontEditor.pos.x,
            top: fontEditor.pos.y,
            zIndex: 1000,
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: 16,
            minWidth: 260,
            maxWidth: 420,
          }}
        >
          <div className="font-semibold mb-2 capitalize">Edit Font: {fontEditor.block.replace(/([A-Z])/g, ' $1')}</div>
          <div className="flex flex-col gap-2">
            {/* Main Head dropdown for header */}
            {fontEditor.block === 'header' && (
              <>
                <div className="flex gap-2 items-center mb-1">
                  <span className="text-xs w-32">Main Head</span>
                  <select
                    className="border rounded px-1 py-0.5"
                    value={headerMainHead}
                    onChange={e => setHeaderMainHead(e.target.value)}
                  >
                    {MAIN_HEAD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {headerMainHead === 'Other' && (
                    <input
                      type="text"
                      className="border rounded px-1 py-0.5 ml-2"
                      value={headerMainHeadOther}
                      onChange={e => setHeaderMainHeadOther(e.target.value)}
                      placeholder="Enter main head"
                    />
                  )}
                </div>
                {/* Main Head font settings */}
                <div className="flex flex-wrap gap-2 items-center mb-1">
                  <span className="text-xs w-32">Main Head Style</span>
                  <input type="number" min={8} max={72} className="border rounded px-1 py-0.5 w-12" value={fontSettings.header.mainHead.fontSize}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, fontSize: parseInt(e.target.value) || 8 } } }))} />
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.mainHead.fontFamily}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, fontFamily: e.target.value } } }))}>
                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.mainHead.fontWeight}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, fontWeight: e.target.value } } }))}>
                    {FONT_WEIGHTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.mainHead.fontStyle}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, fontStyle: e.target.value } } }))}>
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                    <option value="oblique">Oblique</option>
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.mainHead.textDecoration}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, textDecoration: e.target.value } } }))}>
                    <option value="none">None</option>
                    <option value="underline">Underline</option>
                    <option value="line-through">Line-through</option>
                    <option value="overline">Overline</option>
                  </select>
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings.header.mainHead.letterSpacing}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, letterSpacing: parseFloat(e.target.value) || 0 } } }))} placeholder="Spacing" />
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.mainHead.textTransform}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, textTransform: e.target.value } } }))}>
                    <option value="none">None</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings.header.mainHead.lineHeight}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, lineHeight: parseFloat(e.target.value) || 1.2 } } }))} placeholder="Line" />
                  <input type="color" className="ml-1" value={fontSettings.header.mainHead.color}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, mainHead: { ...fs.header.mainHead, color: e.target.value } } }))} />
                </div>
              </>
            )}
            {/* Sublines font settings */}
            {fontEditor.block === 'header'
              ? getHeaderSublines(headerMainHead, headerMainHeadOther).map(sub => (
                <div key={sub.key} className="flex flex-wrap gap-2 items-center mb-1">
                  <input type="checkbox" className="mr-1" checked={fontSettings.header.sublines[sub.key]?.visible ?? true}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], visible: e.target.checked } } } }))} />
                  <span className="text-xs w-32">{sub.label}</span>
                  <input type="number" min={8} max={72} className="border rounded px-1 py-0.5 w-12" value={fontSettings.header.sublines[sub.key]?.fontSize ?? 14}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], fontSize: parseInt(e.target.value) || 8 } } } }))} />
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.sublines[sub.key]?.fontFamily ?? ""}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], fontFamily: e.target.value } } } }))}>
                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.sublines[sub.key]?.fontWeight ?? "normal"}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], fontWeight: e.target.value } } } }))}>
                    {FONT_WEIGHTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.sublines[sub.key]?.fontStyle ?? "normal"}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], fontStyle: e.target.value } } } }))}>
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                    <option value="oblique">Oblique</option>
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.sublines[sub.key]?.textDecoration ?? "none"}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], textDecoration: e.target.value } } } }))}>
                    <option value="none">None</option>
                    <option value="underline">Underline</option>
                    <option value="line-through">Line-through</option>
                    <option value="overline">Overline</option>
                  </select>
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings.header.sublines[sub.key]?.letterSpacing ?? 0}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], letterSpacing: parseFloat(e.target.value) || 0 } } } }))} placeholder="Spacing" />
                  <select className="border rounded px-1 py-0.5" value={fontSettings.header.sublines[sub.key]?.textTransform ?? "none"}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], textTransform: e.target.value } } } }))}>
                    <option value="none">None</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings.header.sublines[sub.key]?.lineHeight ?? 1.2}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], lineHeight: parseFloat(e.target.value) || 1.2 } } } }))} placeholder="Line" />
                  <input type="color" className="ml-1" value={fontSettings.header.sublines[sub.key]?.color ?? "#222222"}
                    onChange={e => setFontSettings(fs => ({ ...fs, header: { ...fs.header, sublines: { ...fs.header.sublines, [sub.key]: { ...fs.header.sublines[sub.key], color: e.target.value } } } }))} />
                </div>
              ))
              : BLOCK_SUBLINES[fontEditor.block] && BLOCK_SUBLINES[fontEditor.block].map(sub => (
                <div key={sub.key} className="flex flex-wrap gap-2 items-center mb-1">
                  <input type="checkbox" className="mr-1" checked={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.visible ?? true}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], visible: e.target.checked } } } }))} />
                  <span className="text-xs w-32">{sub.label}</span>
                  <input type="number" min={8} max={72} className="border rounded px-1 py-0.5 w-12" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.fontSize ?? 14}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], fontSize: parseInt(e.target.value) || 8 } } } }))} />
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.fontFamily ?? ""}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], fontFamily: e.target.value } } } }))}>
                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.fontWeight ?? "normal"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], fontWeight: e.target.value } } } }))}>
                    {FONT_WEIGHTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.fontStyle ?? "normal"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], fontStyle: e.target.value } } } }))} />
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.textDecoration ?? "none"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], textDecoration: e.target.value } } } }))} />
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.letterSpacing ?? 0}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], letterSpacing: parseFloat(e.target.value) || 0 } } } }))} placeholder="Spacing" />
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.textTransform ?? "none"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], textTransform: e.target.value } } } }))} />
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.lineHeight ?? 1.2}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], lineHeight: parseFloat(e.target.value) || 1.2 } } } }))} placeholder="Line" />
                  <input type="color" className="ml-1" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.color ?? "#222222"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], color: e.target.value } } } }))} />
                </div>
              ))}

            {/* Custom lines for all blocks */}
            <div className="font-semibold text-xs mt-2">Custom Lines</div>
            <div className="flex flex-col gap-1">
              {fontSettings[fontEditor.block].customLines.map((line, idx) => (
                <div key={idx} className="flex gap-1 items-center mb-1">
                  <input type="text" className="border rounded px-1 py-0.5 w-20" value={line.label}
                    onChange={e => setFontSettings(fs => {
                      const updated = [...fs[fontEditor.block].customLines];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      return { ...fs, [fontEditor.block]: { ...fs[fontEditor.block], customLines: updated } };
                    })} />
                  <input type="text" className="border rounded px-1 py-0.5 w-24" value={line.value}
                    onChange={e => setFontSettings(fs => {
                      const updated = [...fs[fontEditor.block].customLines];
                      updated[idx] = { ...updated[idx], value: e.target.value };
                      return { ...fs, [fontEditor.block]: { ...fs[fontEditor.block], customLines: updated } };
                    })} />
                  <input type="number" min={8} max={72} className="border rounded px-1 py-0.5 w-10" value={line.fontSize || 14}
                    onChange={e => setFontSettings(fs => {
                      const updated = [...fs[fontEditor.block].customLines];
                      updated[idx] = { ...updated[idx], fontSize: parseInt(e.target.value) || 8 };
                      return { ...fs, [fontEditor.block]: { ...fs[fontEditor.block], customLines: updated } };
                    })} />
                  <input type="color" className="ml-1" value={line.color || "#222222"}
                    onChange={e => setFontSettings(fs => {
                      const updated = [...fs[fontEditor.block].customLines];
                      updated[idx] = { ...updated[idx], color: e.target.value };
                      return { ...fs, [fontEditor.block]: { ...fs[fontEditor.block], customLines: updated } };
                    })} />
                  <button className="text-red-500 text-xs" onClick={() => setFontSettings(fs => {
                    const updated = [...fs[fontEditor.block].customLines];
                    updated.splice(idx, 1);
                    return { ...fs, [fontEditor.block]: { ...fs[fontEditor.block], customLines: updated } };
                  })}>✕</button>
                </div>
              ))}
              <button className="text-blue-600 text-xs mt-1 self-start" onClick={() => setFontSettings(fs => ({
                ...fs,
                [fontEditor.block]: {
                  ...fs[fontEditor.block],
                  customLines: [...fs[fontEditor.block].customLines, { label: "", value: "", fontSize: 14, color: "#222222" }],
                },
              }))}>+ Add Custom Line</button>
            </div>

            {fontEditor.block === 'totals'
              ? BLOCK_SUBLINES.totals.map(sub => (
                  <div key={sub.key} className="flex flex-wrap gap-2 items-center mb-1">
                    <input type="checkbox" className="mr-1" checked={fontSettings.totals?.sublines?.[sub.key]?.visible ?? true}
                      onChange={e => setFontSettings(fs => ({ ...fs, totals: { ...fs.totals, sublines: { ...fs.totals.sublines, [sub.key]: { ...fs.totals.sublines[sub.key], visible: e.target.checked } } } }))} />
                    <span className="text-xs w-32">{sub.label}</span>
                    {sub.key === 'discount' && (
                      <>
                        <select className="border rounded px-1 py-0.5" value={discountType} onChange={e => setDiscountType(e.target.value)}>
                          <option value="percent">Percent (%)</option>
                          <option value="amount">Amount (₹)</option>
                        </select>
                        <input
                          type="number"
                          className="border rounded px-1 py-0.5 w-16"
                          value={discountValue}
                          min={0}
                          onChange={e => setDiscountValue(e.target.value)}
                          placeholder={discountType === 'percent' ? '% off' : '₹ off'}
                        />
                      </>
                    )}
                    <input type="number" min={8} max={72} className="border rounded px-1 py-0.5 w-12" value={fontSettings.totals?.sublines?.[sub.key]?.fontSize ?? 14}
                      onChange={e => setFontSettings(fs => ({ ...fs, totals: { ...fs.totals, sublines: { ...fs.totals.sublines, [sub.key]: { ...fs.totals.sublines[sub.key], fontSize: parseInt(e.target.value) || 8 } } } }))} />
                    <select className="border rounded px-1 py-0.5" value={fontSettings.totals?.sublines?.[sub.key]?.fontFamily ?? ""}
                      onChange={e => setFontSettings(fs => ({ ...fs, totals: { ...fs.totals, sublines: { ...fs.totals.sublines, [sub.key]: { ...fs.totals.sublines[sub.key], fontFamily: e.target.value } } } }))}>
                      {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select className="border rounded px-1 py-0.5" value={fontSettings.totals?.sublines?.[sub.key]?.fontWeight ?? "bold"}
                      onChange={e => setFontSettings(fs => ({ ...fs, totals: { ...fs.totals, sublines: { ...fs.totals.sublines, [sub.key]: { ...fs.totals.sublines[sub.key], fontWeight: e.target.value } } } }))}>
                      {FONT_WEIGHTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <input type="color" className="ml-1" value={fontSettings.totals?.sublines?.[sub.key]?.color ?? "#222222"}
                      onChange={e => setFontSettings(fs => ({ ...fs, totals: { ...fs.totals, sublines: { ...fs.totals.sublines, [sub.key]: { ...fs.totals.sublines[sub.key], color: e.target.value } } } }))} />
                  </div>
                ))
              : null}
          </div>
          <button
            className="mt-3 px-3 py-1 bg-blue-600 text-white rounded text-xs"
            onClick={() => setFontEditor({ open: false, block: null, pos: { x: 0, y: 0 } })}
          >Close</button>
        </div>
      )}
    </div>
  );
};

export default BillTemplates; 

// Add EditableCell component at the top or bottom of the file
function EditableCell({ value, onChange, style }) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  useEffect(() => { setInputValue(value); }, [value]);
  return editing ? (
    <input
      style={{ ...style, minWidth: 0, width: '100%' }}
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      onBlur={() => { setEditing(false); onChange(inputValue); }}
      onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(inputValue); } }}
      autoFocus
    />
  ) : (
    <div
      style={{ ...style, cursor: 'pointer', minHeight: 24, minWidth: 0, width: '100%' }}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || <span style={{ color: '#bbb' }}>Sample</span>}
    </div>
  );
} 

// Patch loaded layout rows to ensure width is set, then update layout state
const patchLayoutRowWidths = (layout, paperW, margin) => {
  const defaultWidth = paperW - (margin.left || 10) - (margin.right || 10);
  return layout.map(row => ({ ...row, width: row.width === undefined ? defaultWidth : row.width }));
};

// mmToPx helper for ItemTable
const mmToPx = mm => mm * 3.78;

// Add new GstDetailsTable component
function GstDetailsTable({ widthMm = 190, db, userId, isAuthReady, appId }) {
  const [gstDetails, setGstDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch GST details from Firebase
  useEffect(() => {
    if (!db || !userId || !isAuthReady || !appId) return;
    const gstCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/gstDetails`);
    const unsubscribe = onSnapshot(gstCollectionRef, (snapshot) => {
      const gstArr = [];
      snapshot.forEach((doc) => {
        gstArr.push({ id: doc.id, ...doc.data() });
      });
      setGstDetails(gstArr);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, userId, isAuthReady, appId]);

  const addRow = () => setGstDetails(gstDetails => [...gstDetails, { hsn: '', taxableAmount: 0, cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, totalTaxAmount: 0, selected: false }]);
  const removeRow = idx => setGstDetails(gstDetails => gstDetails.filter((_, i) => i !== idx));
  const toggleRowSelection = idx => setGstDetails(gstDetails => gstDetails.map((row, i) => i === idx ? { ...row, selected: !row.selected } : row));
  const removeSelectedRows = () => setGstDetails(gstDetails => gstDetails.filter(row => !row.selected));
  const updateRow = (idx, key, value) => {
    setGstDetails(gstDetails => {
      const newGstDetails = [...gstDetails];
      newGstDetails[idx] = { ...newGstDetails[idx], [key]: value };
      // Recalculate amounts
      const taxable = parseFloat(newGstDetails[idx].taxableAmount) || 0;
      const cgstRate = parseFloat(newGstDetails[idx].cgstRate) || 0;
      const sgstRate = parseFloat(newGstDetails[idx].sgstRate) || 0;
      newGstDetails[idx].cgstAmount = (taxable * cgstRate / 100);
      newGstDetails[idx].sgstAmount = (taxable * sgstRate / 100);
      newGstDetails[idx].totalTaxAmount = newGstDetails[idx].cgstAmount + newGstDetails[idx].sgstAmount;
      return newGstDetails;
    });
  };
  
  const tableWidthPx = mmToPx(widthMm);
  const selectedRows = gstDetails.filter(row => row.selected);
  const totalTaxableAmount = selectedRows.reduce((sum, row) => sum + (parseFloat(row.taxableAmount) || 0), 0);
  const totalCgstAmount = selectedRows.reduce((sum, row) => sum + (parseFloat(row.cgstAmount) || 0), 0);
  const totalSgstAmount = selectedRows.reduce((sum, row) => sum + (parseFloat(row.sgstAmount) || 0), 0);
  const grandTotalTaxAmount = totalCgstAmount + totalSgstAmount;
  
  return (
    <div style={{ width: tableWidthPx, maxWidth: tableWidthPx, margin: 0, boxSizing: 'border-box', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #444', background: '#fff' }}>
      {/* Total Amount In Words */}
      <div style={{ padding: '8px', background: '#f8f9fa', borderBottom: '1px solid #444', fontSize: 14 }}>
        <strong>Total Amount In Words:</strong> INR {totalTaxableAmount.toLocaleString('en-IN')} Only
      </div>
      
      {/* Table */}
      <div style={{ display: 'flex', background: '#444', color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
        <div style={{ flex: 0.3, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #666' }}>✓</div>
        <div style={{ flex: 1, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #666' }}>HSN</div>
        <div style={{ flex: 1.5, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #666' }}>Taxable Amount</div>
        <div style={{ flex: 2, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #666' }}>CGST</div>
        <div style={{ flex: 2, padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #666' }}>SGST</div>
        <div style={{ flex: 1.5, padding: '8px 4px', textAlign: 'center' }}>Total Tax Amount</div>
      </div>
      
      {/* Sub-headers */}
      <div style={{ display: 'flex', background: '#555', color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
        <div style={{ flex: 0.3, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}></div>
        <div style={{ flex: 1, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}></div>
        <div style={{ flex: 1.5, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}></div>
        <div style={{ flex: 1, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}>Rate</div>
        <div style={{ flex: 1, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}>Amount</div>
        <div style={{ flex: 1, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}>Rate</div>
        <div style={{ flex: 1, padding: '4px', textAlign: 'center', borderRight: '1px solid #666' }}>Amount</div>
        <div style={{ flex: 1.5, padding: '4px', textAlign: 'center' }}></div>
      </div>
      
      {/* Data rows */}
      {gstDetails.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #eee', alignItems: 'center', fontSize: 13 }}>
          <div style={{ flex: 0.3, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <input 
              type="checkbox" 
              checked={row.selected} 
              onChange={() => toggleRowSelection(idx)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>
          <div style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <input 
              value={row.hsn} 
              onChange={e => updateRow(idx, 'hsn', e.target.value)} 
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, textAlign: 'center' }} 
              placeholder="HSN" 
            />
          </div>
          <div style={{ flex: 1.5, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <input 
              type="number" 
              value={row.taxableAmount} 
              onChange={e => updateRow(idx, 'taxableAmount', e.target.value)} 
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, textAlign: 'center' }} 
              placeholder="0" 
            />
          </div>
          <div style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <input 
              type="number" 
              value={row.cgstRate} 
              onChange={e => updateRow(idx, 'cgstRate', e.target.value)} 
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, textAlign: 'center' }} 
              placeholder="0" 
            />
          </div>
          <div style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {round2(row.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <input 
              type="number" 
              value={row.sgstRate} 
              onChange={e => updateRow(idx, 'sgstRate', e.target.value)} 
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, textAlign: 'center' }} 
              placeholder="0" 
            />
          </div>
          <div style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #eee' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {round2(row.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ flex: 1.5, padding: '6px 4px', textAlign: 'center' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }}>
              {round2(row.totalTaxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
      
      {/* Add row button */}
      <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={removeSelectedRows} 
          disabled={selectedRows.length === 0}
          style={{ 
            background: selectedRows.length > 0 ? '#dc3545' : '#ccc', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 4, 
            padding: '6px 18px', 
            fontSize: 13, 
            cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed' 
          }}
        >
          🗑️ Remove Selected ({selectedRows.length})
        </button>
        <button 
          onClick={addRow} 
          style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', fontSize: 13, cursor: 'pointer' }}
        >
          + Add Row
        </button>
      </div>
      
      {/* Totals row */}
      <div style={{ display: 'flex', background: '#f3f4f6', fontWeight: 'bold', fontSize: 14, borderTop: '2px solid #444' }}>
        <div style={{ flex: 2.8, textAlign: 'right', padding: '8px 4px' }}>Total (Selected):</div>
        <div style={{ flex: 1.5, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' }}>
          {round2(totalTaxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc' }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' }}>
          {round2(totalCgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc' }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' }}>
          {round2(totalSgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ flex: 1.5, textAlign: 'center', padding: '8px 4px', fontVariantNumeric: 'tabular-nums' }}>
          {round2(grandTotalTaxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}

// New ItemTable component with reorderable columns
function ItemTable({ widthMm = 190, items = [], db, userId, isAuthReady, appId }) {
  const tableWidthPx = mmToPx(widthMm);
  const [itemsData, setItemsData] = useState({});

  // Helper function to safely format numbers
  const formatNumber = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '₹0.00' : new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Fetch item details for each item in the bill
  useEffect(() => {
    if (!db || !userId || !isAuthReady || !appId || !items.length) return;
    
    const fetchItems = async () => {
      const itemsObj = {};
      for (const row of items) {
        if (row.item) {
          const itemRef = doc(db, `artifacts/${appId}/users/${userId}/items`, row.item);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            itemsObj[row.item] = itemSnap.data();
          }
        }
      }
      setItemsData(itemsObj);
    };

    fetchItems();
  }, [items, db, userId, isAuthReady, appId]);

  // Calculate totals
  const totals = items.reduce((acc, row) => {
    const amount = parseFloat(row.amount) || 0;
    const sgst = amount * (parseFloat(row.sgst) || 0) / 100;
    const cgst = amount * (parseFloat(row.cgst) || 0) / 100;
    const igst = amount * (parseFloat(row.igst) || 0) / 100;
    
    return {
      subtotal: acc.subtotal + amount,
      sgst: acc.sgst + sgst,
      cgst: acc.cgst + cgst,
      igst: acc.igst + igst,
      total: acc.total + (parseFloat(row.total) || 0)
    };
  }, { subtotal: 0, sgst: 0, cgst: 0, igst: 0, total: 0 });

  return (
    <div style={{ width: tableWidthPx, maxWidth: tableWidthPx, margin: 0, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', background: '#2d3748', color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
        <div style={{ width: '40px', padding: '8px', borderRight: '1px solid #4a5568', textAlign: 'center' }}>Sr.</div>
        <div style={{ flex: 2, padding: '8px', borderRight: '1px solid #4a5568' }}>Item Description</div>
        <div style={{ width: '80px', padding: '8px', borderRight: '1px solid #4a5568', textAlign: 'center' }}>HSN</div>
        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #4a5568', textAlign: 'center' }}>Qty</div>
        <div style={{ width: '80px', padding: '8px', borderRight: '1px solid #4a5568', textAlign: 'right' }}>Rate</div>
        <div style={{ width: '100px', padding: '8px', borderRight: '1px solid #4a5568', textAlign: 'right' }}>Amount</div>
        <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #4a5568', textAlign: 'center' }}>GST%</div>
        <div style={{ width: '100px', padding: '8px', textAlign: 'right' }}>Total</div>
      </div>
      <div style={{ background: '#fff' }}>
        {items.map((row, idx) => {
          const itemDetails = itemsData[row.item] || {};
          const gstPercent = parseFloat(itemDetails.gstPercentage) || 0;
          
          return (
            <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '40px', padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                {idx + 1}
              </div>
              <div style={{ flex: 2, padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                {itemDetails.itemName || ''}
              </div>
              <div style={{ width: '80px', padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                {itemDetails.hsnCode || ''}
              </div>
              <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                {formatNumber(row.nos)}
              </div>
              <div style={{ width: '80px', padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>
                {formatNumber(row.rate)}
              </div>
              <div style={{ width: '100px', padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>
                {formatNumber(row.amount)}
              </div>
              <div style={{ width: '60px', padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                {formatNumber(gstPercent)}%
              </div>
              <div style={{ width: '100px', padding: '8px', textAlign: 'right' }}>
                {formatNumber(row.total)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Totals Section */}
      <div style={{ background: '#f7fafc', borderTop: '2px solid #e2e8f0', padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ fontSize: '14px' }}>
            <span style={{ display: 'inline-block', width: '120px', fontWeight: 'medium' }}>Subtotal:</span>
            <span style={{ display: 'inline-block', width: '120px', textAlign: 'right' }}>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.sgst > 0 && (
            <div style={{ fontSize: '14px' }}>
              <span style={{ display: 'inline-block', width: '120px', fontWeight: 'medium' }}>SGST:</span>
              <span style={{ display: 'inline-block', width: '120px', textAlign: 'right' }}>{formatCurrency(totals.sgst)}</span>
            </div>
          )}
          {totals.cgst > 0 && (
            <div style={{ fontSize: '14px' }}>
              <span style={{ display: 'inline-block', width: '120px', fontWeight: 'medium' }}>CGST:</span>
              <span style={{ display: 'inline-block', width: '120px', textAlign: 'right' }}>{formatCurrency(totals.cgst)}</span>
            </div>
          )}
          {totals.igst > 0 && (
            <div style={{ fontSize: '14px' }}>
              <span style={{ display: 'inline-block', width: '120px', fontWeight: 'medium' }}>IGST:</span>
              <span style={{ display: 'inline-block', width: '120px', textAlign: 'right' }}>{formatCurrency(totals.igst)}</span>
            </div>
          )}
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a365d', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
            <span style={{ display: 'inline-block', width: '120px' }}>Grand Total:</span>
            <span style={{ display: 'inline-block', width: '120px', textAlign: 'right' }}>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultTemplate({ data, companyDetails, partyDetails, bankDetails }) {
  const [itemsData, setItemsData] = useState([]);
  const [totals, setTotals] = useState({
    subtotal: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0
  });

  useEffect(() => {
    if (data && data.rows) {
      setItemsData(data.rows);
      // Calculate totals
      const subtotal = data.rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
      const cgst = data.rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
      const sgst = data.rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
      const igst = data.rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
      const total = subtotal + cgst + sgst + igst;

      setTotals({
        subtotal,
        cgst,
        sgst,
        igst,
        total
      });
    }
  }, [data]);

  // --- FIX: Define all required variables in scope ---
  const isPurchaseBill = data?.docType === 'purchaseBill' || data?.type === 'purchaseBill';
  const isPurchaseOrder = data?.docType === 'purchaseOrder' || data?.type === 'purchaseOrder';
  const isPurchase = isPurchaseBill || isPurchaseOrder || data?.type === 'purchase';
  let headerLabel = 'TAX INVOICE';
  if (isPurchaseBill) {
    headerLabel = 'PURCHASE BILL';
  } else if (isPurchaseOrder) {
    headerLabel = 'PURCHASE ORDER';
  } else if (data?.docType === 'challan') {
    headerLabel = 'CHALLAN';
  } else if (data?.docType === 'quotation') {
    headerLabel = 'QUOTATION';
  }
  // For purchase, swap billed by/to
  const billedBy = isPurchase ? partyDetails : companyDetails;
  const billedTo = isPurchase ? companyDetails : partyDetails;
  // Logo
  const logoUrl = billedTo?.logoUrl || billedBy?.logoUrl || companyDetails?.logoUrl;
  // Section labels for purchase
  let leftSectionLabel = 'Billed By:';
  let rightSectionLabel = 'Billed To:';
  if (isPurchaseBill) {
    leftSectionLabel = 'Received To:';
    rightSectionLabel = 'Received From:';
  } else if (isPurchaseOrder) {
    leftSectionLabel = 'Ordered By:';
    rightSectionLabel = 'Ordered To:';
  }
  // --- END FIX ---

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white print:p-4 print:max-w-none print:mx-0">
      {/* Header with Logo and Company Details */}
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-gray-800 print:text-xl">{headerLabel}</h1>
          <p className="text-gray-600">No: {data?.number || ''}</p>
          <p className="text-gray-600">Date: {formatDate(data?.date || data?.billDate)}</p>
        </div>
        <div className="text-right">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain', display: 'block', marginLeft: 'auto' }} />
          ) : (
            <span className="text-gray-400">No Logo</span>
          )}
        </div>
      </div>

      {/* Main sections: for purchases, do NOT render Ship To */}
      <div className="grid grid-cols-2 gap-8 mb-6 print:mb-4 print:gap-4">
        <div className="border p-3 rounded print:border-gray-300">
          <h3 className="font-bold text-gray-800 mb-2">{leftSectionLabel}</h3>
          <p className="font-semibold">{billedBy?.firmName || ''}</p>
          <p>{billedBy?.address || ''}</p>
          <p>
            {billedBy?.city || ''} {billedBy?.state ? `, ${billedBy.state}` : ''}
            {billedBy?.pincode ? ` - ${billedBy.pincode}` : ''}
          </p>
          <p>GSTIN: {billedBy?.gstin || ''}</p>
          <p>Contact: {billedBy?.contactNumber || ''}</p>
        </div>
        <div className="border p-3 rounded print:border-gray-300">
          <h3 className="font-bold text-gray-800 mb-2">{rightSectionLabel}</h3>
          <p className="font-semibold">{billedTo?.firmName || ''}</p>
          <p>{billedTo?.address || ''}</p>
          <p>
            {billedTo?.city || ''} {billedTo?.state ? `, ${billedTo.state}` : ''}
            {billedTo?.pincode ? ` - ${billedTo.pincode}` : ''}
          </p>
          <p>GSTIN: {billedTo?.gstin || ''}</p>
          <p>Contact: {billedTo?.contactNumber || ''}</p>
        </div>
      </div>

      {/* Bank Details */}
      <div className="border-t pt-4 mb-6 print:mb-4">
        <h3 className="font-bold text-gray-800 mb-2">Bank & Payment Details:</h3>
        <p>Bank Name: {companyDetails?.bankName || ''}</p>
        <p>Account No: {companyDetails?.bankAccount || ''}</p>
        <p>IFSC Code: {companyDetails?.bankIfsc || ''}</p>
        {companyDetails?.upiId && <p>UPI ID: {companyDetails.upiId}</p>}
        {companyDetails?.upiQrUrl && <div className="mt-2"><img src={companyDetails.upiQrUrl} alt="UPI QR" className="h-20" /></div>}
        {companyDetails?.paymentGatewayLink && <div className="mt-2"><a href={companyDetails.paymentGatewayLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Pay Online</a></div>}
        <pre style={{fontSize: '10px', color: 'red'}}>{JSON.stringify(companyDetails, null, 2)}</pre>
      </div>

      {/* Terms & Signature */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-bold text-gray-800 mb-2">Terms & Conditions:</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{companyDetails?.terms ||
            '1. Goods once sold will not be taken back.\n' +
            '2. Interest @18% p.a. will be charged on overdue bills.\n' +
            '3. Subject to local jurisdiction.'}</p>
        </div>
        <div className="text-right">
          <div className="mt-16 print:mt-8">
            <div className="border-t border-gray-400 inline-block px-8"></div>
            <p className="text-gray-600">Authorized Signatory</p>
            <p className="font-semibold">For {companyDetails?.firmName || ''}</p>
          </div>
        </div>
      </div>

      {/* Receiver Signature Section */}
      <div className="mt-12 flex justify-end">
        <div className="text-center">
          <div style={{ borderTop: '1px solid #333', width: '200px', margin: '0 auto', marginTop: '24px' }}></div>
          <div className="mt-2">Receiver Signature</div>
        </div>
      </div>

      {/* Footer Section */}
      {companyDetails?.footer && (
        <div className="mt-8 text-center text-xs text-gray-500">
          {companyDetails.footer}
        </div>
      )}
    </div>
  );
}

// Utility for rounding to 2 decimal places
function round2(val) {
  return Math.round((parseFloat(val) + Number.EPSILON) * 100) / 100;
}
