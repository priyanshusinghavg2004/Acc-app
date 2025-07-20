import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, setDoc, doc, deleteDoc, getDoc } from "firebase/firestore";

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
      return <div className="font-bold text-xl mb-2">Header (Invoice Title, Number, Date)</div>;
    case "logo":
      return <div className="flex items-center justify-center h-full"><span className="text-gray-400">[Logo]</span></div>;
    case "billedBy":
      return <div><span className="font-bold">Billed By:</span> {'{company details}'}</div>;
    case "billedTo":
      return <div><span className="font-bold">Billed To:</span> {'{party details}'}</div>;
    case "shippedTo":
      return <div><span className="font-bold">Shipped To:</span> {'{shipping details}'}</div>;
    case "supplyInfo":
      return <div>Place of Supply: {'{company.state}'} | Country: India</div>;
    case "gstDetails":
      return <div className="font-bold text-center">[GST Details Table]</div>;
    case "itemTable":
      return <div className="font-bold">[Item Table]</div>;
    case "bankDetails":
      return <div><span className="font-bold">Bank & Payment Details:</span> {'{bank details}'}</div>;
    case "totals":
      return <div><span className="font-bold">Totals:</span> {'{totals}'}</div>;
    case "terms":
      return <div><span className="font-bold">Terms and Conditions:</span> {'{terms}'}</div>;
    case "notes":
      return <div><span className="font-bold">Additional Notes:</span> {'{notes}'}</div>;
    case "footer":
      return <div className="text-xs text-gray-500">Footer (Contact Info)</div>;
    default:
      return <div className="text-gray-400">[Empty]</div>;
  }
};

const defaultLayout = [
  { columns: 2, cells: ["header", "header"], height: 40, width: 190 },
  { columns: 3, cells: ["billedBy", "billedTo", "shippedTo"], height: 40, width: 190 },
  { columns: 1, cells: ["gstDetails"], height: 30, width: 190 },
  { columns: 1, cells: ["itemTable"], height: 100, width: 190 },
  { columns: 2, cells: ["bankDetails", "totals"], height: 30, width: 190 },
  { columns: 1, cells: ["terms"], height: 15, width: 190 },
  { columns: 1, cells: ["footer"], height: 15, width: 190 },
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
// Update DEFAULT_FONT_SETTINGS to include more font options for each sub-line
const DEFAULT_FONT_SETTINGS = BLOCKS.reduce((acc, block) => {
  if (block === "header") {
    acc[block] = {
      mainHead: {
        fontSize: 22,
        fontFamily: "",
        fontWeight: "bold",
        color: "#222222",
        visible: true,
        fontStyle: "normal",
        textDecoration: "none",
        letterSpacing: 0,
        textTransform: "none",
        lineHeight: 1.2,
      },
      sublines: {},
      customLines: [],
    };
  } else if (block === "itemTable") {
    acc[block] = {
      gstColumns: { SGST: true, CGST: true, IGST: false },
      gst: {
        SGST: { fontSize: 14, fontFamily: "", fontWeight: "normal", color: "#222222", width: 30 },
        CGST: { fontSize: 14, fontFamily: "", fontWeight: "normal", color: "#222222", width: 30 },
        IGST: { fontSize: 14, fontFamily: "", fontWeight: "normal", color: "#222222", width: 30 },
      },
      sublines: BLOCK_SUBLINES[block].reduce((sacc, s) => {
        sacc[s.key] = {
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
          width: s.key === 'itemDescription' ? 60 : 30, // 60mm for description, 30mm for others
        };
        return sacc;
      }, {}),
      customLines: [],
      sequence: [
        'serialNo',
        'itemDescription',
        'hsn',
        'quantity',
        'rate',
        'taxableAmount',
        'gst',
        'amount',
      ],
    };
  } else if (block === "totals") {
    acc[block] = {
      sublines: BLOCK_SUBLINES[block].reduce((sacc, s) => {
        sacc[s.key] = {
          fontSize: 14,
          fontFamily: "",
          fontWeight: "bold",
          color: "#222222",
          visible: true,
          fontStyle: "normal",
          textDecoration: "none",
          letterSpacing: 0,
          textTransform: "none",
          lineHeight: 1.2,
        };
        return sacc;
      }, {}),
      customLines: [],
    };
  } else if (BLOCK_SUBLINES[block]) {
    acc[block] = {
      sublines: BLOCK_SUBLINES[block].reduce((sacc, s) => {
        sacc[s.key] = {
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
        return sacc;
      }, {}),
      customLines: [],
    };
  } else {
    acc[block] = { customLines: [] };
  }
  return acc;
}, {});

const BillTemplates = ({ db, userId, isAuthReady, appId }) => {
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

  // Place this at the top level of the BillTemplates component, with other useState declarations
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
    if (!db || !userId || !isAuthReady) return;
    const fetchLayouts = async () => {
      setLoadingLayouts(true);
      try {
        // Fetch layouts
        const q = collection(db, "users", userId, "billLayouts");
        const querySnapshot = await getDocs(q);
        // Group layouts by type
        const layoutsByTypeTemp = {};
        querySnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const type = data.type || 'invoice';
          if (!layoutsByTypeTemp[type]) layoutsByTypeTemp[type] = [];
          layoutsByTypeTemp[type].push({ id: docSnap.id, ...data });
        });
        setSavedLayoutsByType(layoutsByTypeTemp);
        // Fetch default template preference (per type)
        try {
          const userDoc = await getDoc(doc(db, "users", userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const defaultIds = userData.defaultTemplateIdByType || {};
            setDefaultTemplateIdByType(defaultIds);
            // Optionally, verify existence
            Object.entries(defaultIds).forEach(([type, defaultId]) => {
              if (defaultId && !(layoutsByTypeTemp[type] || []).find(l => l.id === defaultId)) {
                // Clear missing default
                setDefaultTemplateIdByType(prev => ({ ...prev, [type]: null }));
              }
            });
          }
        } catch (err) {
          setDefaultTemplateIdByType({});
        }
      } catch (err) {
        setSavedLayoutsByType({});
      }
      setLoadingLayouts(false);
    };
    fetchLayouts();
  }, [db, userId, isAuthReady]);

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
    if (!layoutName.trim() || !db || !userId) return;
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
    };
    const colRef = collection(db, "users", userId, "billLayouts");
    if (editingLayoutId) {
      // Update existing
      await setDoc(doc(colRef, editingLayoutId), layoutData, { merge: true });
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
    if (!db || !userId) {
      alert("Database connection or user authentication not available");
      return;
    }
    try {
      // Check if the template exists
      const template = savedLayouts.find(l => l.id === id);
      if (!template) {
        alert("Template not found");
        return;
      }
      // Get current defaultTemplateIdByType from Firestore
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      let defaultTemplateIdByType = {};
      if (userDoc.exists()) {
        defaultTemplateIdByType = userDoc.data().defaultTemplateIdByType || {};
      }
      // Set for current type
      defaultTemplateIdByType[selectedType] = id;
      await setDoc(userDocRef, { defaultTemplateIdByType }, { merge: true });
      setDefaultTemplateIdByType(prev => ({ ...prev, [selectedType]: id }));
      alert("Template set as default successfully!");
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
    if (!db || !userId) return;
    const colRef = collection(db, "users", userId, "billLayouts");
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
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          await setDoc(userDocRef, { defaultTemplateId: null }, { merge: true });
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

  // Add this after the useEffect that fetches layouts from Firestore
  useEffect(() => {
    if (savedLayoutsByType[selectedType]) {
      setSavedLayouts(savedLayoutsByType[selectedType]);
    } else {
      setSavedLayouts([]);
    }
  }, [savedLayoutsByType, selectedType]);

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
                        {cell === 'itemTable' ? <ItemTable widthMm={row.width || 190} /> :
                          cell === 'gstDetails' ? <GstDetailsTable widthMm={row.width || 190} /> :
                          fontSettings[cell] && fontSettings[cell].sublines && BLOCK_SUBLINES[cell] ? (
                            BLOCK_SUBLINES[cell]
                              .filter(sub => fontSettings[cell].sublines[sub.key] && fontSettings[cell].sublines[sub.key].visible)
                              .map(sub => {
                                const sublineSettings = fontSettings[cell].sublines[sub.key] || {};
                                return (
                                  <div
                                    key={sub.key}
                                    style={{
                                      fontSize: sublineSettings.fontSize || 14,
                                      fontFamily: sublineSettings.fontFamily || "",
                                      fontWeight: sublineSettings.fontWeight || "normal",
                                      color: sublineSettings.color || "#222222",
                                      fontStyle: sublineSettings.fontStyle || "normal",
                                      textDecoration: sublineSettings.textDecoration || "none",
                                      letterSpacing: sublineSettings.letterSpacing || 0,
                                      textTransform: sublineSettings.textTransform || "none",
                                      lineHeight: sublineSettings.lineHeight || 1.2,
                                    }}
                                                                  >
                                  {cell === 'header' && sub.key === 'mainHead'
                                    ? (headerMainHead === 'Other' ? headerMainHeadOther : headerMainHead)
                                    : sub.key === 'label' ? (BLOCK_DISPLAY_NAMES[cell] || sub.label) : sub.label}
                                </div>
                              );
                              })
                          ) : <BlockPreview block={cell} />}
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
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], fontStyle: e.target.value } } } }))}>
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                    <option value="oblique">Oblique</option>
                  </select>
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.textDecoration ?? "none"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], textDecoration: e.target.value } } } }))}>
                    <option value="none">None</option>
                    <option value="underline">Underline</option>
                    <option value="line-through">Line-through</option>
                    <option value="overline">Overline</option>
                  </select>
                  <input type="number" step="0.1" className="border rounded px-1 py-0.5 w-12" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.letterSpacing ?? 0}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], letterSpacing: parseFloat(e.target.value) || 0 } } } }))} placeholder="Spacing" />
                  <select className="border rounded px-1 py-0.5" value={fontSettings[fontEditor.block]?.sublines?.[sub.key]?.textTransform ?? "none"}
                    onChange={e => setFontSettings(fs => ({ ...fs, [fontEditor.block]: { ...fs[fontEditor.block], sublines: { ...fs[fontEditor.block].sublines, [sub.key]: { ...fs[fontEditor.block].sublines[sub.key], textTransform: e.target.value } } } }))}>
                    <option value="none">None</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
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
function GstDetailsTable({ widthMm = 190 }) {
  const [rows, setRows] = React.useState([
    { hsn: '', taxableAmount: 0, cgstRate: 9, cgstAmount: 0, sgstRate: 9, sgstAmount: 0, totalTaxAmount: 0, selected: false },
  ]);
  
  const addRow = () => setRows(r => [...r, { hsn: '', taxableAmount: 0, cgstRate: 9, cgstAmount: 0, sgstRate: 9, sgstAmount: 0, totalTaxAmount: 0, selected: false }]);
  const removeRow = idx => setRows(r => r.filter((_, i) => i !== idx));
  const toggleRowSelection = idx => setRows(r => r.map((row, i) => i === idx ? { ...row, selected: !row.selected } : row));
  const removeSelectedRows = () => setRows(r => r.filter(row => !row.selected));
  const updateRow = (idx, key, value) => {
    setRows(r => {
      const newRows = r.map((row, i) => {
        if (i === idx) {
          const updatedRow = { ...row, [key]: value };
          // Recalculate amounts
          const taxable = parseFloat(updatedRow.taxableAmount) || 0;
          const cgstRate = parseFloat(updatedRow.cgstRate) || 0;
          const sgstRate = parseFloat(updatedRow.sgstRate) || 0;
          updatedRow.cgstAmount = (taxable * cgstRate / 100);
          updatedRow.sgstAmount = (taxable * sgstRate / 100);
          updatedRow.totalTaxAmount = updatedRow.cgstAmount + updatedRow.sgstAmount;
          return updatedRow;
        }
        return row;
      });
      return newRows;
    });
  };
  
  const tableWidthPx = mmToPx(widthMm);
  const selectedRows = rows.filter(row => row.selected);
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
      {rows.map((row, idx) => (
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
              {row.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {row.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ flex: 1.5, padding: '6px 4px', textAlign: 'center' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }}>
              {row.totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          {totalTaxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc' }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' }}>
          {totalCgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc' }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #ccc', fontVariantNumeric: 'tabular-nums' }}>
          {totalSgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ flex: 1.5, textAlign: 'center', padding: '8px 4px', fontVariantNumeric: 'tabular-nums' }}>
          {grandTotalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}

// New ItemTable component with reorderable columns
function ItemTable({ widthMm = 190 }) {
  const [rows, setRows] = React.useState([
    { 
      sno: 1,
      description: '', 
      hsn: '', 
      qty: 1, 
      rate: 10000, 
      gst: 9,
      taxableAmount: 10000,
      amount: 10900
    }
  ]);

  // Column configuration with reorderable capability
  const [columns, setColumns] = React.useState([
    { key: 'sno', label: 'S.No', width: 0.5, editable: false, type: 'number' },
    { key: 'description', label: 'Item Description', width: 2, editable: true, type: 'text' },
    { key: 'hsn', label: 'HSN', width: 1, editable: true, type: 'text' },
    { key: 'qty', label: 'Qty.', width: 1, editable: true, type: 'number' },
    { key: 'rate', label: 'Rate', width: 1, editable: true, type: 'number' },
    { key: 'gst', label: 'GST %', width: 1, editable: true, type: 'select' },
    { key: 'taxableAmount', label: 'Taxable Amount', width: 1.5, editable: false, type: 'currency' },
    { key: 'amount', label: 'Amount', width: 1.5, editable: false, type: 'currency' }
  ]);

  const gstOptions = [0, 5, 9, 12, 18, 28];

  // Column reordering functions
  const moveColumn = (fromIndex, toIndex) => {
    const newColumns = [...columns];
    const [movedColumn] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, movedColumn);
    setColumns(newColumns);
  };

  const addRow = () => {
    const newSno = rows.length + 1;
    const newRow = {
      sno: newSno,
      description: '',
      hsn: '',
      qty: 1,
      rate: 10000,
      gst: 9,
      taxableAmount: 10000,
      amount: 10900
    };
    setRows(r => [...r, newRow]);
  };

  const updateRow = (idx, key, value) => {
    setRows(r => {
      const newRows = r.map((row, i) => {
        if (i === idx) {
          const updatedRow = { ...row, [key]: value };
          
          // Recalculate amounts if qty, rate, or gst changes
          if (key === 'qty' || key === 'rate' || key === 'gst') {
            const qty = parseFloat(updatedRow.qty) || 0;
            const rate = parseFloat(updatedRow.rate) || 0;
            const gst = parseFloat(updatedRow.gst) || 0;
            
            updatedRow.taxableAmount = qty * rate;
            const gstAmount = (updatedRow.taxableAmount * gst) / 100;
            updatedRow.amount = updatedRow.taxableAmount + gstAmount;
          }
          
          return updatedRow;
        }
        return row;
      });
      return newRows;
    });
  };

  const tableWidthPx = mmToPx(widthMm);
  const selectedRows = rows.filter(row => row.selected);

  // Render cell content based on column type
  const renderCell = (row, column, idx) => {
    const value = row[column.key];
    
    switch (column.type) {
      case 'number':
        return <span style={{ fontWeight: 'bold', color: '#666' }}>{value}</span>;
      
      case 'text':
        return (
          <input 
            value={value} 
            onChange={e => updateRow(idx, column.key, e.target.value)} 
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, textAlign: column.key === 'description' ? 'left' : 'center' }} 
            placeholder={column.label}
          />
        );
      
      case 'select':
        return (
          <select 
            value={value} 
            onChange={e => updateRow(idx, column.key, parseFloat(e.target.value))} 
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, textAlign: 'center' }}
          >
            {gstOptions.map(opt => <option key={opt} value={opt}>{opt}%</option>)}
          </select>
        );
      
      case 'currency':
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: column.key === 'amount' ? 'bold' : 'normal' }}>
            {value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </span>
        );
      
      default:
        return <span>{value}</span>;
    }
  };

  return (
    <div style={{ width: tableWidthPx, maxWidth: tableWidthPx, margin: 0, boxSizing: 'border-box', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #444', background: '#fff' }}>
      {/* Header with reorderable columns */}
      <div style={{ display: 'flex', background: '#444', color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
        {columns.map((column, colIdx) => (
          <div 
            key={column.key}
            style={{ 
              flex: column.width, 
              padding: '8px 8px', 
              textAlign: column.key === 'description' ? 'left' : 'center',
              borderRight: colIdx < columns.length - 1 ? '1px solid #555' : 'none',
              cursor: 'grab',
              userSelect: 'none'
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', colIdx);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
              const toIndex = colIdx;
              if (fromIndex !== toIndex) {
                moveColumn(fromIndex, toIndex);
              }
            }}
            title="Drag to reorder column"
          >
            {column.label}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #eee', alignItems: 'center', fontSize: 15 }}>
          {/* Data columns */}
          {columns.map((column, colIdx) => (
            <div 
              key={column.key}
              style={{ 
                flex: column.width, 
                padding: '8px 8px', 
                textAlign: column.key === 'description' ? 'left' : 'center',
                borderRight: colIdx < columns.length - 1 ? '1px solid #ddd' : 'none'
              }}
            >
              {renderCell(row, column, idx)}
            </div>
          ))}
        </div>
      ))}

      {/* Action buttons */}
      <div style={{ padding: 8, textAlign: 'right' }}>
        <button 
          onClick={addRow} 
          style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', fontSize: 15, cursor: 'pointer' }}
        >
          + Add Item
        </button>
      </div>

      {/* Totals row */}
      <div style={{ display: 'flex', background: '#f3f4f6', fontWeight: 'bold', fontSize: 16, borderTop: '2px solid #444' }}>
        <div style={{ flex: 9.5, textAlign: 'right', padding: '8px 8px', borderRight: '1px solid #ddd' }}>Total:</div>
        <div style={{ flex: 1.5, textAlign: 'right', padding: '8px 8px', fontVariantNumeric: 'tabular-nums' }}>
          {rows.reduce((sum, row) => sum + row.amount, 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
        </div>
      </div>
    </div>
  );
}
