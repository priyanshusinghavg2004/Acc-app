import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import SunriseTemplate from './BillTemplates';

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
  total: 0,
};

const areaUnits = [
  'Sq. Ft.', 'Sq. Inch', 'Sq. Yard', 'Square Meter', 'Cubic Feet', 'Cubic Meter', 'Cu. Inch', 'Cu. Yard'
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

function Sales({ db, userId, isAuthReady, appId }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ ...initialItemRow }]);
  // Remove template selection, always use SunriseTemplate
  const [showPrint, setShowPrint] = useState(false);

  // Live data states
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
    const [salesBills, setSalesBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [stockMap, setStockMap] = useState({}); // { itemId: stockQty }
  const [company, setCompany] = useState({});

  // Fetch parties
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
      const unsubscribe = onSnapshot(partiesCollectionRef, (snapshot) => {
        const partiesArr = [];
                snapshot.forEach((doc) => {
          partiesArr.push({ id: doc.id, ...doc.data() });
        });
        partiesArr.sort((a, b) => (a.firmName || '').localeCompare(b.firmName || ''));
        setParties(partiesArr);
      });
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

  // Fetch sales bills
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
      const unsubscribe = onSnapshot(salesCollectionRef, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
        bills.sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));
                setSalesBills(bills);
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

  // Calculate live stock for each item
  useEffect(() => {
    // Only run when items, purchases, or salesBills change
    const stock = {};
    items.forEach(item => {
      let purchased = 0;
      let sold = 0;
      purchases.forEach(bill => {
        (bill.items || []).forEach(billItem => {
          if (billItem.itemId === item.id) {
            purchased += parseFloat(billItem.quantity || 0);
          }
        });
      });
      salesBills.forEach(bill => {
        (bill.rows || []).forEach(billRow => {
          if (billRow.item === item.id) {
            sold += parseFloat(billRow.nos || 0); // Adjust if you use a different field for quantity
          }
        });
      });
      stock[item.id] = purchased - sold;
    });
    setStockMap(stock);
  }, [items, purchases, salesBills]);

  // Auto-generate invoice number on date change or on mount
  useEffect(() => {
    const fy = getFinancialYear(invoiceDate);
    // Find max serial for this FY in salesBills
    const serials = salesBills
      .filter(bill => (bill.invoiceNumber || '').startsWith(fy))
      .map(bill => parseInt((bill.invoiceNumber || '').split('/')[1], 10))
      .filter(n => !isNaN(n));
    const nextSerial = (serials.length ? Math.max(...serials) : 0) + 1;
    const paddedSerial = nextSerial.toString().padStart(4, '0');
    setInvoiceNumber(`${fy}/${paddedSerial}`);
    // eslint-disable-next-line
  }, [invoiceDate, salesBills]);

  // Calculate area, amount, GST, and total for each row
  const handleRowChange = (idx, field, value) => {
    const updatedRows = rows.map((row, i) => {
      if (i !== idx) return row;
      let updated = { ...row, [field]: value };
      let itemObj = items.find(it => it.id === (field === 'item' ? value : row.item));
      const unit = itemObj ? itemObj.quantityMeasurement : '';
      if (field === 'item') {
        updated.sgst = itemObj ? itemObj.sgstRate || 0 : 0;
        updated.cgst = itemObj ? itemObj.cgstRate || 0 : 0;
        updated.igst = itemObj ? itemObj.igstRate || 0 : 0;
        updated.length = 0;
        updated.height = 0;
        updated.nos = 1;
        updated.area = 0;
        updated.rate = 0;
        updated.amount = 0;
        updated.total = 0;
      }
      // Area calculation for area/calculative units
      if (areaUnits.includes(unit)) {
        updated.area = (parseFloat(updated.nos) || 0) * (parseFloat(updated.length) || 0) * (parseFloat(updated.height) || 0);
        updated.amount = (parseFloat(updated.area) || 0) * (parseFloat(updated.rate) || 0);
      } else {
        updated.area = 0;
        updated.amount = (parseFloat(updated.nos) || 0) * (parseFloat(updated.rate) || 0);
      }
      // GST and total calculation
      const sgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.sgst) || 0) / 100;
      const cgstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.cgst) || 0) / 100;
      const igstAmt = (parseFloat(updated.amount) || 0) * (parseFloat(updated.igst) || 0) / 100;
      updated.total = (parseFloat(updated.amount) || 0) + sgstAmt + cgstAmt + igstAmt;
      return updated;
    });
    setRows(updatedRows);
  };

  const addRow = () => setRows([...rows, { ...initialItemRow }]);
  const removeRow = idx => setRows(rows.filter((_, i) => i !== idx));

  const subtotal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const totalSGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.sgst) || 0) / 100), 0);
  const totalCGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.cgst) || 0) / 100), 0);
  const totalIGST = rows.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * (parseFloat(row.igst) || 0) / 100), 0);
  const grandTotal = subtotal + totalSGST + totalCGST + totalIGST;

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
  // Buyer details
  const buyerObj = parties.find(p => p.id === party) || {};
  const buyer = {
    name: buyerObj.firmName || '',
    address: buyerObj.address || '',
    gstin: buyerObj.gstin || '',
    state: buyerObj.state || '',
  };
  // Invoice details
  const invoice = {
    number: invoiceNumber,
    date: invoiceDate,
    placeOfSupply: seller.state,
  };
  // Items for print template
  const printItems = rows.map((row, idx) => {
    const itemObj = items.find(it => it.id === row.item) || {};
    // For SunriseTemplate, combine GST for single column
    const gstRate = (parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)).toFixed(2);
    const gstAmt = ((row.amount || 0) * gstRate / 100).toFixed(2);
    return {
      name: itemObj.itemName || '',
      hsn: itemObj.hsnCode || '',
      qty: row.nos,
      unit: itemObj.quantityMeasurement || '',
      rate: row.rate,
      taxableValue: row.amount,
      gstRate,
      gstAmt,
      total: row.total,
    };
  });
  // Totals for print template
  const roundOff = (Math.round(grandTotal) - grandTotal).toFixed(2);
  const totals = {
    subtotal: subtotal.toFixed(2),
    sgst: totalSGST.toFixed(2),
    cgst: totalCGST.toFixed(2),
    igst: totalIGST.toFixed(2),
    grandTotal: Math.round(grandTotal).toFixed(2),
    amountWords: numToWords(Math.round(grandTotal)),
    roundOff,
  };
  // Extra fields for SunriseTemplate
  const extra = {
    paymentMode: 'UPI',
    reverseCharge: 'YES',
    buyerOrderNo: '',
    supplierRef: '',
    vehicleNo: '',
    deliveryDate: '',
    transportDetails: '',
    termsOfDelivery: '',
    bankName: 'STATE BANK OF INDIA',
    bankBranch: 'Delhi',
    bankAccount: '20412XXXXX05',
    bankIfsc: 'SBIN003XXXX',
    upiId: 'yourid@upi',
    freightCharges: '0.00',
    appName: 'Acc-app',
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

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 100);
  };

  // For SunriseTemplate, ensure A4 size and fixed layout
  const a4Style = showPrint ? {
    width: '210mm',
    minHeight: '297mm',
    maxHeight: '297mm',
    margin: '0 auto',
    background: '#fff',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  } : {};

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; left: 0; top: 0; width: 210mm; min-height: 297mm; max-height: 297mm; background: #fff; z-index: 9999; margin: 0; padding: 0; box-sizing: border-box; }
        }
      `}</style>
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-5xl print:w-full print:shadow-none print:p-2">
        <h2 className="text-3xl font-bold text-center mb-6">Create New Sales Invoice</h2>
        {/* Print area (hidden except when printing) */}
        {showPrint && (
          <div id="print-area" className="print:block hidden" style={a4Style}>
            <SunriseTemplate invoice={invoice} seller={seller} buyer={buyer} items={printItems} totals={totals} extra={extra} />
                    </div>
                )}
        {/* Hide form/table UI when printing */}
        <div className={showPrint ? 'hidden print:hidden' : ''}>
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
                {parties.map(p => <option key={p.id} value={p.id}>{p.firmName}</option>)}
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
                  <th className="px-2 py-1">TOTAL</th>
                  <th className="px-2 py-1">REMOVE</th>
                                    </tr>
                                </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1">
                      <select value={row.item} onChange={e => handleRowChange(idx, 'item', e.target.value)}
                        className="border border-gray-300 rounded-md p-1 w-32">
                        <option value="">Select Item</option>
                        {items.map(it => <option key={it.id} value={it.id}>{it.itemName}</option>)}
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
          {/* Sales Bill List Section */}
          <div className="mt-10">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Sales Bill List</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                    <th className="px-2 py-1">Invoice No.</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Party</th>
                    <th className="px-2 py-1">Amount</th>
                                </tr>
                            </thead>
                <tbody>
                  {salesBills.map((bill, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">{bill.invoiceNumber}</td>
                      <td className="px-2 py-1">{bill.invoiceDate || bill.date}</td>
                      <td className="px-2 py-1">{(() => {
                        const p = parties.find(pt => pt.id === bill.party);
                        return p ? p.firmName : bill.party;
                      })()}</td>
                      <td className="px-2 py-1">₹{(bill.amount || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
          </div>
        </div>
      </div>
            </div>
    );
}

export default Sales; 