import React from "react";
import { mmToPx } from "./utils";

const ItemTable = ({ widthMm = 190 }) => {
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
};

export default ItemTable; 