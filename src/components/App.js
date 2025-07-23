import React, { useState } from 'react';

const initialItemRow = {
  item: '',
  nos: 1,
  length: 0,
  height: 0,
  area: 0,
  rate: 0,
  amount: 0,
  sgst: 0,
  cgst: 0,
  igst: 0,
};

const parties = [
  { id: '1', name: 'ABC Enterprises' },
  { id: '2', name: 'XYZ Traders' },
];
const items = [
  { id: '1', name: 'Flex Banner', sgst: 9, cgst: 9, igst: 0 },
  { id: '2', name: 'Vinyl Print', sgst: 6, cgst: 6, igst: 0 },
];
const [uid, setUid] = useState("");

useEffect(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) setUid(user.uid);
    else setUid("Not logged in");
  });
}, []);

return (
  <div>
    <h2>User UID: {uid}</h2>
  </div>
);
function App() {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ ...initialItemRow }]);

  // Calculate area and amount for each row
  const handleRowChange = (idx, field, value) => {
    const updatedRows = rows.map((row, i) => {
      if (i !== idx) return row;
      let updated = { ...row, [field]: value };
      if (field === 'item') {
        const itemObj = items.find(it => it.id === value);
        updated.sgst = itemObj ? itemObj.sgst : 0;
        updated.cgst = itemObj ? itemObj.cgst : 0;
        updated.igst = itemObj ? itemObj.igst : 0;
      }
      if (field === 'length' || field === 'height') {
        updated.area = (parseFloat(updated.length) || 0) * (parseFloat(updated.height) || 0);
      }
      if (field === 'nos' || field === 'rate' || field === 'area' || field === 'length' || field === 'height') {
        const qty = updated.area > 0 ? updated.area : updated.nos;
        updated.amount = (parseFloat(qty) || 0) * (parseFloat(updated.rate) || 0);
      }
      return updated;
    });
    setRows(updatedRows);
  };

  const addRow = () => setRows([...rows, { ...initialItemRow }]);

  const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
  const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
  const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
  const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-5xl print:w-full print:shadow-none print:p-2">
        <h2 className="text-3xl font-bold text-center mb-6">Create New Sales Invoice</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
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
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                <th className="px-2 py-1">AREA</th>
                <th className="px-2 py-1">RATE</th>
                <th className="px-2 py-1">AMOUNT</th>
                <th className="px-2 py-1">SGST</th>
                <th className="px-2 py-1">CGST</th>
                <th className="px-2 py-1">IGST</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1">
                    <select value={row.item} onChange={e => handleRowChange(idx, 'item', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-32">
                      <option value="">Select Item</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
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
                    <input type="number" value={row.area} min={0} readOnly
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
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.cgst} min={0} onChange={e => handleRowChange(idx, 'cgst', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-14" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={row.igst} min={0} onChange={e => handleRowChange(idx, 'igst', e.target.value)}
                      className="border border-gray-300 rounded-md p-1 w-14" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6">
          <button onClick={addRow} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md mb-4 md:mb-0">Add Item Row</button>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-full md:w-80">
            <div className="flex justify-between mb-1"><span>Subtotal (Excl. GST):</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between mb-1"><span>Total SGST:</span><span>₹{totalSGST.toFixed(2)}</span></div>
            <div className="flex justify-between mb-1"><span>Total CGST:</span><span>₹{totalCGST.toFixed(2)}</span></div>
            <div className="flex justify-between mb-1"><span>Total IGST:</span><span>₹{totalIGST.toFixed(2)}</span></div>
            <div className="flex justify-between mt-2 font-bold text-lg"><span>Grand Total (Incl. GST):</span><span className="text-blue-700">₹{grandTotal.toFixed(2)}</span></div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 print:hidden">
            Save Sales Invoice
          </button>
          <button type="button" onClick={handlePrint} className="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 print:hidden">
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default App; 