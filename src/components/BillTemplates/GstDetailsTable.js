import React from 'react';

function GstDetailsTable({ widthMm = 190 }) {
  const mmToPx = mm => mm * 3.78;
  const tableWidthPx = mmToPx(widthMm);

  const tableStyle = {
    width: tableWidthPx,
    maxWidth: tableWidthPx,
    margin: 0,
    boxSizing: 'border-box',
    borderRadius: 4,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontFamily: 'Arial, sans-serif'
  };

  const headerStyle = {
    display: 'flex',
    background: '#2d3748',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  };

  const cellStyle = {
    padding: '8px 12px',
    textAlign: 'center',
    borderRight: '1px solid #4a5568',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const rowStyle = {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 12,
    color: '#4a5568'
  };

  const dataCellStyle = {
    ...cellStyle,
    borderRight: '1px solid #e2e8f0',
    color: '#2d3748',
    padding: '6px 8px'
  };

  // Sample data for preview
  const sampleData = [
    {
      hsn: '1234',
      taxableAmount: '2000.00',
      cgstRate: '9%',
      cgstAmount: '180.00',
      sgstRate: '9%',
      sgstAmount: '180.00',
      totalTax: '360.00'
    },
    {
      hsn: '5678',
      taxableAmount: '500.00',
      cgstRate: '6%',
      cgstAmount: '30.00',
      sgstRate: '6%',
      sgstAmount: '30.00',
      totalTax: '60.00'
    }
  ];

  const columns = [
    { key: 'hsn', label: 'HSN', width: '10%' },
    { key: 'taxableAmount', label: 'Taxable Amount', width: '20%', align: 'right' },
    { key: 'cgstRate', label: 'CGST Rate', width: '15%' },
    { key: 'cgstAmount', label: 'CGST Amount', width: '15%', align: 'right' },
    { key: 'sgstRate', label: 'SGST Rate', width: '15%' },
    { key: 'sgstAmount', label: 'SGST Amount', width: '15%', align: 'right' },
    { key: 'totalTax', label: 'Total Tax', width: '10%', align: 'right' }
  ];

  // Calculate totals
  const totals = sampleData.reduce((acc, row) => ({
    taxableAmount: (parseFloat(acc.taxableAmount) + parseFloat(row.taxableAmount)).toFixed(2),
    cgstAmount: (parseFloat(acc.cgstAmount) + parseFloat(row.cgstAmount)).toFixed(2),
    sgstAmount: (parseFloat(acc.sgstAmount) + parseFloat(row.sgstAmount)).toFixed(2),
    totalTax: (parseFloat(acc.totalTax) + parseFloat(row.totalTax)).toFixed(2)
  }), {
    taxableAmount: '0.00',
    cgstAmount: '0.00',
    sgstAmount: '0.00',
    totalTax: '0.00'
  });

  return (
    <div style={tableStyle}>
      {/* Header */}
      <div style={headerStyle}>
        {columns.map((col) => (
          <div
            key={col.key}
            style={{
              ...cellStyle,
              width: col.width,
              textAlign: col.align || 'center',
              justifyContent: col.align === 'left' ? 'flex-start' : 'center'
            }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Data Rows */}
      {sampleData.map((row, idx) => (
        <div key={idx} style={rowStyle}>
          {columns.map((col) => (
            <div
              key={col.key}
              style={{
                ...dataCellStyle,
                width: col.width,
                textAlign: col.align || 'center',
                justifyContent: col.align === 'left' ? 'flex-start' : 'center',
                background: idx % 2 === 0 ? '#f7fafc' : '#fff'
              }}
            >
              {col.key.includes('Amount') || col.key === 'totalTax' ? `₹${row[col.key]}` : row[col.key]}
            </div>
          ))}
        </div>
      ))}

      {/* Totals Row */}
      <div style={{ ...rowStyle, background: '#edf2f7', fontWeight: 'bold' }}>
        {columns.map((col) => (
          <div
            key={col.key}
            style={{
              ...dataCellStyle,
              width: col.width,
              textAlign: col.align || 'center',
              justifyContent: col.align === 'left' ? 'flex-start' : 'center',
              borderBottom: 'none'
            }}
          >
            {col.key === 'hsn' ? 'Total:' :
             col.key.includes('Rate') ? '' :
             col.key.includes('Amount') || col.key === 'totalTax' ? `₹${totals[col.key]}` :
             col.key === 'taxableAmount' ? `₹${totals.taxableAmount}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default GstDetailsTable; 