import React from 'react';

function ItemTable({ widthMm = 190, data }) {
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
      no: '1',
      description: 'Sample Product Description',
      hsn: '1234',
      qty: '2',
      rate: '1000.00',
      amount: '2000.00',
      gst: '18%',
      total: '2360.00'
    },
    {
      no: '2',
      description: 'Another Sample Item',
      hsn: '5678',
      qty: '1',
      rate: '500.00',
      amount: '500.00',
      gst: '12%',
      total: '560.00'
    }
  ];

  const columns = [
    { key: 'no', label: 'No.', width: '5%' },
    { key: 'description', label: 'Description', width: '35%', align: 'left' },
    { key: 'hsn', label: 'HSN', width: '8%' },
    { key: 'qty', label: 'Qty', width: '8%' },
    { key: 'rate', label: 'Rate', width: '12%', align: 'right' },
    { key: 'amount', label: 'Amount', width: '12%', align: 'right' },
    { key: 'gst', label: 'GST', width: '8%' },
    { key: 'total', label: 'Total', width: '12%', align: 'right' }
  ];

  // Use data prop if provided, else fallback to sampleData
  const tableData = Array.isArray(data) && data.length > 0 ? data : sampleData;

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
      {tableData.map((row, idx) => (
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
              {/* Render correct field for each column */}
              {col.key === 'no'
                ? idx + 1
                : col.key === 'description'
                  ? row.itemDescription || row.description || ''
                  : col.key === 'gst'
                    ? (row.gstPercent !== undefined ? `${row.gstPercent}%` : row.gst || '')
                    : row[col.key] !== undefined
                      ? row[col.key]
                      : ''}
            </div>
          ))}
        </div>
      ))}

      {/* Empty rows for preview */}
      {(!data || data.length === 0) && [1, 2].map((_, idx) => (
        <div key={`empty-${idx}`} style={rowStyle}>
          {columns.map((col) => (
            <div
              key={col.key}
              style={{
                ...dataCellStyle,
                width: col.width,
                textAlign: col.align || 'center',
                justifyContent: col.align === 'left' ? 'flex-start' : 'center',
                background: (idx + sampleData.length) % 2 === 0 ? '#f7fafc' : '#fff',
                color: '#a0aec0'
              }}
            >
              {col.key === 'no' ? sampleData.length + idx + 1 : ''}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default ItemTable; 