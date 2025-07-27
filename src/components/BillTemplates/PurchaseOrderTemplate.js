import React from 'react';

function formatINR(num) {
  if (isNaN(num)) return '';
  return Number(num).toLocaleString('en-IN');
}

function numberToWordsIndian(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  }
  return inWords(Math.floor(num));
}
function numToWords(num) {
  return numberToWordsIndian(num) + ' Rupees Only';
}

function PurchaseOrderTemplate({ billData = {}, companyDetails = {}, partyDetails = {}, bankDetails = {} }) {
  const items = billData.items || billData.rows || [];
  const subtotal = items.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const discount = billData.discountType === 'percent'
    ? subtotal * (parseFloat(billData.discountValue) || 0) / 100
    : parseFloat(billData.discountValue) || 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  // GST calculations
  const totalSGST = items.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * ((parseFloat(row.sgst) || 0) / 100)), 0);
  const totalCGST = items.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * ((parseFloat(row.cgst) || 0) / 100)), 0);
  const totalIGST = items.reduce((sum, row) => sum + ((parseFloat(row.amount) || 0) * ((parseFloat(row.igst) || 0) / 100)), 0);
  const grandTotal = discountedSubtotal + totalSGST + totalCGST + totalIGST;
  // GST summary table
  const gstSummary = {};
  items.forEach(row => {
    const gstPercent = (parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)) || parseFloat(row.gst) || 0;
    const key = gstPercent.toString();
    if (!gstSummary[key]) {
      gstSummary[key] = {
        percent: gstPercent,
        taxable: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        total: 0,
      };
    }
    const amount = parseFloat(row.amount) || 0;
    const sgstAmt = amount * (parseFloat(row.sgst) || 0) / 100;
    const cgstAmt = amount * (parseFloat(row.cgst) || 0) / 100;
    const igstAmt = amount * (parseFloat(row.igst) || 0) / 100;
    gstSummary[key].taxable += amount;
    gstSummary[key].sgst += sgstAmt;
    gstSummary[key].cgst += cgstAmt;
    gstSummary[key].igst += igstAmt;
    gstSummary[key].total += sgstAmt + cgstAmt + igstAmt;
  });
  const terms = companyDetails.purchaseTerms || '';

  return (
    <div className="p-8 bg-white rounded shadow max-w-3xl mx-auto text-sm print:p-0 print:shadow-none print:bg-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          {companyDetails.logoUrl && <img src={companyDetails.logoUrl} alt="Logo" className="h-16 w-auto" />}
          <div>
            <div className="text-xl font-bold uppercase">{companyDetails.firmName}</div>
            <div>{companyDetails.address}{companyDetails.city ? ', ' + companyDetails.city : ''}{companyDetails.pincode ? ' - ' + companyDetails.pincode : ''}</div>
            <div>{companyDetails.state}</div>
            <div>GSTIN: {companyDetails.gstin || 'N/A'}</div>
            <div>Contact: {companyDetails.contactNumber || ''} | {companyDetails.email || ''}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-wider">PURCHASE ORDER</div>
          <div className="mt-2"><span className="font-semibold">Order No:</span> {billData.purchaseOrderNumber || billData.number || ''}</div>
          <div><span className="font-semibold">Date:</span> {billData.date || billData.invoiceDate || ''}</div>
        </div>
      </div>
      {/* Parties */}
      <div className="flex flex-row justify-between mb-2">
        <div>
          <div className="font-semibold">Billed To (Buyer):</div>
          <div>{companyDetails.firmName}</div>
          <div>{companyDetails.address}</div>
          <div>{companyDetails.city} {companyDetails.pincode}</div>
          <div>GSTIN: {companyDetails.gstin || 'N/A'}</div>
          <div>Contact: {companyDetails.contactNumber || ''}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">Order From (Seller):</div>
          <div>{partyDetails.firmName || partyDetails.name || ''}</div>
          <div>{partyDetails.address || ''}</div>
          <div>{partyDetails.city || ''} {partyDetails.pincode || ''}</div>
          <div>GSTIN: {partyDetails.gstin || 'N/A'}</div>
          <div>Contact: {partyDetails.contactNumber || ''}</div>
        </div>
      </div>
      {/* Item Table */}
      <div className="overflow-x-auto mt-4 mb-4">
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">Sr.</th>
              <th className="border px-2 py-1">Description</th>
              <th className="border px-2 py-1">HSN</th>
              <th className="border px-2 py-1">Qty</th>
              <th className="border px-2 py-1">Rate</th>
              <th className="border px-2 py-1">Amount</th>
              <th className="border px-2 py-1">GST %</th>
              <th className="border px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={idx}>
                <td className="border px-2 py-1 text-center">{idx + 1}</td>
                <td className="border px-2 py-1">{row.description || row.itemName || ''}</td>
                <td className="border px-2 py-1 text-center">{row.hsn || ''}</td>
                <td className="border px-2 py-1 text-right">{row.qty || row.nos || ''}</td>
                <td className="border px-2 py-1 text-right">₹{formatINR(row.rate)}</td>
                <td className="border px-2 py-1 text-right">₹{formatINR(row.amount)}</td>
                <td className="border px-2 py-1 text-center">{(parseFloat(row.sgst || 0) + parseFloat(row.cgst || 0) + parseFloat(row.igst || 0)) || row.gst || ''}</td>
                <td className="border px-2 py-1 text-right">₹{formatINR(row.total !== undefined && row.total !== null && row.total !== '' ? row.total : row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* GST Summary (if Regular) */}
      {companyDetails.gstinType === 'Regular' && (
        <div className="flex flex-row gap-8 mt-4 mb-2">
          <div className="flex-1">
            <div className="font-bold mb-1">Totals (GST % wise):</div>
            <table className="w-full border text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-1 py-1">GST %</th>
                  <th className="border px-1 py-1">Taxable</th>
                  <th className="border px-1 py-1">SGST</th>
                  <th className="border px-1 py-1">CGST</th>
                  <th className="border px-1 py-1">IGST</th>
                  <th className="border px-1 py-1">Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(gstSummary).map((row, idx) => (
                  <tr key={idx}>
                    <td className="border px-1 py-1 text-center">{row.percent}</td>
                    <td className="border px-1 py-1 text-right">₹{formatINR(row.taxable)}</td>
                    <td className="border px-1 py-1 text-right">₹{formatINR(row.sgst)}</td>
                    <td className="border px-1 py-1 text-right">₹{formatINR(row.cgst)}</td>
                    <td className="border px-1 py-1 text-right">₹{formatINR(row.igst)}</td>
                    <td className="border px-1 py-1 text-right">₹{formatINR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex-1">
            <div className="font-bold mb-1">Summary:</div>
            <div>Taxable Amount: ₹{formatINR(subtotal)}</div>
            <div>Discount: -₹{formatINR(discount)} {billData.discountType === 'percent' ? `(${billData.discountValue || 0}%)` : ''}</div>
            <div>Net Subtotal: ₹{formatINR(discountedSubtotal)}</div>
            <div>SGST: ₹{formatINR(totalSGST)}</div>
            <div>CGST: ₹{formatINR(totalCGST)}</div>
            <div>IGST: ₹{formatINR(totalIGST)}</div>
            <div className="font-bold">Grand Total: ₹{formatINR(grandTotal)}</div>
            <div>In Words: {numToWords(grandTotal)}</div>
          </div>
        </div>
      )}
      {/* No GST summary for Composition/Unregistered */}
      {(companyDetails.gstinType === 'Composition' || companyDetails.gstinType === 'Unregistered') && (
        <div className="flex flex-row gap-8 mt-4 mb-2">
          <div className="flex-1">
            <div className="font-bold mb-1">Totals:</div>
            <div>Total Amount: ₹{formatINR(subtotal)}</div>
            <div>Discount: -₹{formatINR(discount)} {billData.discountType === 'percent' ? `(${billData.discountValue || 0}%)` : ''}</div>
            <div>Payable Amount: <b>₹{formatINR(discountedSubtotal)}</b></div>
            <div>In Words: <span className="italic">{numToWords(discountedSubtotal)}</span></div>
          </div>
        </div>
      )}
      {/* Terms and Conditions */}
      <div className="mt-4 mb-2">
        <div className="font-semibold mb-1">Terms and Conditions:</div>
        <div className="whitespace-pre-line text-gray-700">{terms || 'N/A'}</div>
      </div>

      {/* Seal and Sign - show together */}
      <div className="flex flex-row items-end justify-end gap-8 mt-8 mb-2">
        {companyDetails.sealUrl && (
          <div className="flex flex-col items-center mr-4">
            <img src={companyDetails.sealUrl} alt="Seal" className="h-16 mb-1" />
            <div className="text-xs text-gray-500">Company Seal</div>
          </div>
        )}
        {companyDetails.signUrl && (
          <div className="flex flex-col items-center">
            <img src={companyDetails.signUrl} alt="Sign" className="h-16 mb-1" />
            <div className="text-xs text-gray-500">Authorised Signatory</div>
          </div>
        )}
      </div>
      {/* Footer */}
      {companyDetails.footer && (
        <div className="mt-4 text-center text-xs text-gray-500 border-t pt-2">{companyDetails.footer}</div>
      )}
    </div>
  );
}

export default PurchaseOrderTemplate; 