import React from "react";
import { mmToPx } from "./utils";

const GstDetailsTable = ({ widthMm = 190 }) => {
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
};

export default GstDetailsTable; 