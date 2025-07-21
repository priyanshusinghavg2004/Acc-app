import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, setDoc, doc, deleteDoc } from "firebase/firestore";
import ItemTable from './ItemTable';
import GstDetailsTable from './GstDetailsTable';

// Constants from original file
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

// Default layout with correct order and widths
const defaultLayout = [
  { columns: 2, cells: ["header", "header"], height: 40 },
  { columns: 3, cells: ["billedBy", "billedTo", "shippedTo"], height: 80 },
  { columns: 1, cells: ["itemTable"], height: 200 },
  { columns: 1, cells: ["gstDetails"], height: 120 },
  { columns: 2, cells: ["bankDetails", "totals"], height: 80 },
  { columns: 1, cells: ["terms"], height: 40 },
  { columns: 1, cells: ["footer"], height: 20 }
];

const BillTemplates = ({ db, userId, isAuthReady }) => {
  // Basic state
  const [selectedType, setSelectedType] = useState(DOCUMENT_TYPES[0].key);
  const [paperSize, setPaperSize] = useState(PAPER_SIZES[0].key);
  const [orientation, setOrientation] = useState(ORIENTATIONS[0].key);
  const [customSize, setCustomSize] = useState({ width: 210, height: 297 });
  const [margin, setMargin] = useState({ top: 10, right: 10, bottom: 10, left: 10 });
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState(defaultLayout.map(row => ({
    ...row,
    width: 210 - margin.left - margin.right // Initial width based on default layout
  })));
  const [layoutName, setLayoutName] = useState("");
  const [editingLayoutId, setEditingLayoutId] = useState(null);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  
  // Calculate paper dimensions and available width
  const selectedPaperSize = PAPER_SIZES.find(p => p.key === paperSize);
  const paperW = orientation === 'portrait' ? selectedPaperSize.width : selectedPaperSize.height;
  const paperH = orientation === 'portrait' ? selectedPaperSize.height : selectedPaperSize.width;
  const availableWidth = paperW - margin.left - margin.right;

  // Initialize layout with calculated widths
  useEffect(() => {
    setLayout(prevLayout => prevLayout.map(row => ({
      ...row,
      width: availableWidth
    })));
  }, [paperW, margin.left, margin.right, availableWidth]);

  // Basic handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.3));
  const handleZoomReset = () => setZoom(1);

  const handleMarginChange = (side, value) => {
    setMargin(prev => ({ ...prev, [side]: value }));
  };

  // Layout manipulation
  const addRow = () => setLayout(l => [
    ...l,
    {
      columns: 1,
      cells: [null],
      height: 40,
      width: availableWidth
    }
  ]);
  const removeRow = (idx) => setLayout(l => l.filter((_, i) => i !== idx));
  const setRowColumns = (idx, columns) => {
    setLayout(l => l.map((row, i) => i === idx ? { ...row, columns, cells: Array(columns).fill(null) } : row));
  };
  const setCellSection = (rowIdx, colIdx, section) => {
    setLayout(l => l.map((row, i) => i === rowIdx ? { ...row, cells: row.cells.map((cell, j) => j === colIdx ? section : cell) } : row));
  };
  const setRowHeight = (idx, height) => {
    setLayout(l => l.map((row, i) => i === idx ? { ...row, height } : row));
  };

  // Firebase handlers
  const handleSaveLayout = async () => {
    if (!layoutName.trim() || !db || !userId) return;
    
    setLoadingLayouts(true);
    try {
      const layoutData = {
        name: layoutName,
        type: selectedType,
        data: {
          paperSize,
          orientation,
          customSize,
          margin,
          layout
        }
      };

      const colRef = collection(db, "users", userId, "billLayouts");
      if (editingLayoutId) {
        await setDoc(doc(colRef, editingLayoutId), layoutData, { merge: true });
      } else {
        await addDoc(colRef, layoutData);
      }

      // Refresh layouts
      const querySnapshot = await getDocs(colRef);
      setSavedLayouts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      setLayoutName("");
      setEditingLayoutId(null);
    } catch (error) {
      console.error("Error saving layout:", error);
    }
    setLoadingLayouts(false);
  };

  const handleDeleteLayout = async (id) => {
    if (!db || !userId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "billLayouts", id));
      setSavedLayouts(layouts => layouts.filter(l => l.id !== id));
      if (editingLayoutId === id) {
        setLayoutName("");
        setEditingLayoutId(null);
      }
    } catch (error) {
      console.error("Error deleting layout:", error);
    }
  };

  // Load layouts on mount
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;
    
    const fetchLayouts = async () => {
      setLoadingLayouts(true);
      try {
        const querySnapshot = await getDocs(collection(db, "users", userId, "billLayouts"));
        setSavedLayouts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching layouts:", error);
        setSavedLayouts([]);
      }
      setLoadingLayouts(false);
    };

    fetchLayouts();
  }, [db, userId, isAuthReady]);

  // Render block content
  const renderBlockContent = (block) => {
    switch (block) {
      case 'itemTable':
        return <ItemTable widthMm={paperW - margin.left - margin.right} />;
      case 'gstDetails':
        return <GstDetailsTable widthMm={paperW - margin.left - margin.right} />;
      case 'billedBy':
        return (
          <div className="p-2 text-sm">
            <div className="font-bold">Billed By</div>
            <div>Company Name/Details</div>
            <div>GSTIN</div>
            <div>Contact</div>
            <div>Email</div>
          </div>
        );
      case 'billedTo':
        return (
          <div className="p-2 text-sm">
            <div className="font-bold">Billed To</div>
            <div>Company Name/Details</div>
            <div>GSTIN</div>
            <div>Contact</div>
            <div>Email</div>
          </div>
        );
      case 'shippedTo':
        return (
          <div className="p-2 text-sm">
            <div className="font-bold">Shipped To</div>
            <div>Name</div>
            <div>Address</div>
            <div>GSTIN</div>
            <div>Contact</div>
            <div>Email</div>
            <div>Vehicle Number</div>
            <div>E-way Bill Number</div>
          </div>
        );
      case 'bankDetails':
        return (
          <div className="p-2 text-sm">
            <div className="font-bold">Bank & Payment Details</div>
            <div>Bank Name</div>
            <div>Account Number</div>
            <div>IFSC Code</div>
            <div>UPI ID</div>
            <div>QR Code</div>
          </div>
        );
      case 'totals':
        return (
          <div className="p-2 text-sm">
            <div>Taxable Amount</div>
            <div>CGST</div>
            <div>SGST</div>
            <div>IGST</div>
            <div>Discount</div>
            <div>Total Amount</div>
          </div>
        );
      case 'terms':
        return (
          <div className="p-2 text-sm">
            <div className="font-bold">Terms and Conditions</div>
            <div>Terms Text</div>
          </div>
        );
      case 'header':
        return (
          <div className="p-2 text-center">
            <div className="text-2xl font-bold">TAX INVOICE</div>
            <div className="text-sm mt-1">Invoice No: INV-001</div>
            <div className="text-sm">Date: {new Date().toLocaleDateString()}</div>
          </div>
        );
      case 'footer':
        return (
          <div className="p-2 text-center text-sm">
            <div>Footer Text</div>
          </div>
        );
      default:
        return (
          <div className="p-2 text-center text-gray-400 text-sm">
            {BLOCK_LIBRARY.find(b => b.key === block)?.label || 'Empty Block'}
          </div>
        );
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Bill Templates</h2>
      
      {/* Document type tabs */}
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

      {/* Paper size and orientation */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Paper Size</label>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {PAPER_SIZES.map(size => (
              <option key={size.key} value={size.key}>{size.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Orientation</label>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {ORIENTATIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Margins */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Margins (mm)</h3>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(margin).map(([side, value]) => (
            <div key={side}>
              <label className="block text-sm font-medium text-gray-700 capitalize">{side}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => handleMarginChange(side, parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Layout builder */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Layout</h3>
        <div className="flex space-x-2 mb-2">
          <button
            onClick={addRow}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Row
          </button>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Zoom In
          </button>
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Zoom Out
          </button>
          <button
            onClick={handleZoomReset}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset Zoom
          </button>
        </div>
        
        <div 
          className="border rounded-lg bg-white"
          style={{
            width: `${paperW * zoom}mm`,
            height: `${paperH * zoom}mm`,
            padding: `${margin.top * zoom}mm ${margin.right * zoom}mm ${margin.bottom * zoom}mm ${margin.left * zoom}mm`,
          }}
        >
          {layout.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="border-2 border-dashed border-gray-300 mb-2"
              style={{ height: `${row.height * zoom}mm` }}
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex space-x-2">
                  <select
                    value={row.columns}
                    onChange={(e) => setRowColumns(rowIdx, parseInt(e.target.value))}
                    className="text-sm border rounded"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n} Column{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={row.height}
                    onChange={(e) => setRowHeight(rowIdx, parseInt(e.target.value))}
                    className="w-20 text-sm border rounded"
                  />
                </div>
                <button
                  onClick={() => removeRow(rowIdx)}
                  className="text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${row.columns}, 1fr)`, gap: '4px' }}>
                {row.cells.map((cell, colIdx) => (
                  <div key={colIdx} className="border p-2">
                    <select
                      value={cell || ''}
                      onChange={(e) => setCellSection(rowIdx, colIdx, e.target.value || null)}
                      className="w-full text-sm border rounded"
                    >
                      <option value="">Select section</option>
                      {BLOCK_LIBRARY.map(block => (
                        <option key={block.key} value={block.key}>{block.label}</option>
                      ))}
                    </select>
                    {cell && (
                      <div className="mt-2">
                        {renderBlockContent(cell)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save layout */}
      <div className="mb-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Layout name"
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            onClick={handleSaveLayout}
            disabled={!layoutName.trim() || loadingLayouts}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loadingLayouts ? 'Saving...' : editingLayoutId ? 'Update Layout' : 'Save Layout'}
          </button>
        </div>
      </div>

      {/* Saved layouts */}
      <div>
        <h3 className="text-lg font-medium mb-2">Saved Layouts</h3>
        <div className="grid grid-cols-3 gap-4">
          {savedLayouts.map(layout => (
            <div key={layout.id} className="border rounded-lg p-4">
              <h4 className="font-medium">{layout.name}</h4>
              <p className="text-sm text-gray-600">{DOCUMENT_TYPES.find(t => t.key === layout.type)?.label}</p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => {
                    setEditingLayoutId(layout.id);
                    setLayoutName(layout.name);
                    setPaperSize(layout.data.paperSize);
                    setOrientation(layout.data.orientation);
                    setCustomSize(layout.data.customSize);
                    setMargin(layout.data.margin);
                    setLayout(layout.data.layout);
                  }}
                  className="text-blue-500 hover:text-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteLayout(layout.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillTemplates; 
