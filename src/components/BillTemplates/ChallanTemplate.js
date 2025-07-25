import React from 'react';

const PAGE_DIMENSIONS = {
  a4: { portrait: { width: 210, height: 297 }, landscape: { width: 297, height: 210 } },
  a5: { portrait: { width: 148, height: 210 }, landscape: { width: 210, height: 148 } },
  letter: { portrait: { width: 216, height: 279 }, landscape: { width: 279, height: 216 } },
};

function blur(val, previewMode) {
  if (!previewMode) return val;
  if (typeof val === 'number') return 'XXX';
  if (typeof val === 'string') return val.replace(/[^\s]/g, 'X');
  return 'XXX';
}

function formatINR(num) {
  if (typeof num !== 'number') num = parseInt(num, 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-IN');
}

function numberToWordsIndian(num) {
  const a = [ '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen' ];
  const b = [ '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety' ];
  let str = '';
  if (num >= 10000000) {
    str += numberToWordsIndian(Math.floor(num / 10000000)) + ' Crore ';
    num = num % 10000000;
  }
  if (num >= 100000) {
    str += numberToWordsIndian(Math.floor(num / 100000)) + ' Lakh ';
    num = num % 100000;
  }
  if (num >= 1000) {
    str += numberToWordsIndian(Math.floor(num / 1000)) + ' Thousand ';
    num = num % 1000;
  }
  if (num >= 100) {
    str += numberToWordsIndian(Math.floor(num / 100)) + ' Hundred ';
    num = num % 100;
  }
  if (num > 0) {
    if (str !== '') str += 'and ';
    if (num < 20) str += a[num] + ' ';
    else str += b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '') + ' ';
  }
  return str.replace(/ +/g, ' ').trim();
}

function numToWords(num) {
  if (typeof num !== 'number') num = parseInt(num, 10);
  if (isNaN(num)) return '';
  if (num === 0) return 'Zero Rupees Only';
  return numberToWordsIndian(num) + ' Rupees Only';
}

function ChallanTemplate({
  billData = {},
  companyDetails = {},
  partyDetails = {},
  bankDetails = {},
  payments = [],
  pageSize = 'a4',
  orientation = 'portrait',
  previewMode = false,
}) {
  // Discount logic (matching Sales page)
  const subtotal = billData.items?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0;
  let discount = 0;
  if (billData.discountType === 'percent') {
    discount = subtotal * (parseFloat(billData.discountValue) || 0) / 100;
  } else if (billData.discountType === 'amount') {
    discount = parseFloat(billData.discountValue) || 0;
  }
  const discountedSubtotal = Math.max(0, subtotal - discount);
  // GST calculations
  const totalSGST = billData.items?.reduce((sum, item) => sum + ((parseFloat(item.amount) || 0) * ((parseFloat(item.sgst) || 0) / 100)), 0) || 0;
  const totalCGST = billData.items?.reduce((sum, item) => sum + ((parseFloat(item.amount) || 0) * ((parseFloat(item.cgst) || 0) / 100)), 0) || 0;
  const totalIGST = billData.items?.reduce((sum, item) => sum + ((parseFloat(item.amount) || 0) * ((parseFloat(item.gst) || 0) / 100)), 0) || 0;
  // For Regular GST, total must be including GST
  const grandTotal = discountedSubtotal + totalSGST + totalCGST + totalIGST;

  // Get page dimensions
  const pageDims = PAGE_DIMENSIONS[pageSize]?.[orientation] || PAGE_DIMENSIONS.a4.portrait;
  const pageStyle = {
    width: `${pageDims.width}mm`,
    minHeight: `${pageDims.height}mm`,
    maxWidth: '100%',
    margin: '0 auto',
    background: 'white',
    boxSizing: 'border-box',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  };

  return (
    <div style={pageStyle} className="print:p-0 print:shadow-none print:border-0 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">CHALLAN</h2>
          <div>Challan Number: {previewMode ? 'XXX-XXX/XXXX' : billData.challanNumber || billData.invoiceNumber}</div>
          <div>Challan Date: {previewMode ? 'YYYY-MM-DD' : billData.challanDate || billData.date}</div>
        </div>
        {companyDetails.logoUrl && <img src={companyDetails.logoUrl} alt="Logo" className="h-16 w-16 object-contain" loading="eager" />}
      </div>

      {/* Billed By / Billed To */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="font-bold">Billed By:</div>
          <div>{companyDetails.name || companyDetails.firmName}</div>
          <div>{companyDetails.address}</div>
          {(companyDetails.gstinType === 'Regular' || companyDetails.gstinType === 'Composition') && <div>GSTIN: {companyDetails.gstin}</div>}
          <div>Contact: {companyDetails.contact || companyDetails.contactNumber}</div>
        </div>
        <div>
          <div className="font-bold">Bill To:</div>
          <div>{previewMode ? 'XXX Party Name' : partyDetails.name}</div>
          <div>{previewMode ? 'XXX Address' : partyDetails.address}</div>
          {(companyDetails.gstinType === 'Regular' || companyDetails.gstinType === 'Composition') && <div>GSTIN: {previewMode ? 'XXGSTINXXXX' : partyDetails.gstin}</div>}
          <div>Contact: {previewMode ? 'XXXXXXXXXX' : partyDetails.contact}</div>
        </div>
      </div>

      {/* Item Table */}
      <table className="w-full border mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Sr.</th>
            <th className="border px-2 py-1">Item Description</th>
            {(companyDetails.gstinType === 'Regular') && <th className="border px-2 py-1">HSN</th>}
            <th className="border px-2 py-1">Qty</th>
            <th className="border px-2 py-1">Rate</th>
            <th className="border px-2 py-1">Amount</th>
            {(companyDetails.gstinType === 'Regular') && <th className="border px-2 py-1">GST %</th>}
            <th className="border px-2 py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {(billData.items || []).map((item, idx) => (
            <tr key={idx}>
              <td className="border px-2 py-1 text-center">{idx + 1}</td>
              <td className="border px-2 py-1">
                {item.description}
                <div style={{ fontSize: '0.85em', fontStyle: 'italic', color: '#555' }}>
                  {item.nos || item.qty || item.Nos || 1}x{item.length || 1}x{item.height || 1}
                </div>
              </td>
              {(companyDetails.gstinType === 'Regular') && <td className="border px-2 py-1 text-center">{item.hsn}</td>}
              <td className="border px-2 py-1 text-center">{item.qty}</td>
              <td className="border px-2 py-1 text-right">{item.rate}</td>
              <td className="border px-2 py-1 text-right">{item.amount}</td>
              {(companyDetails.gstinType === 'Regular') && <td className="border px-2 py-1 text-center">{item.gst || item.sgst + item.cgst + item.igst}</td>}
              <td className="border px-2 py-1 text-right">
                {item.total !== undefined && item.total !== null && item.total !== "" ? item.total : item.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bank & Payment Details + Totals */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 bank-totals-flex-row">
        <div className="bank-box" style={{ width: '100%', maxWidth: 'calc(50% - 10mm)' }}>
          <div className="font-bold mb-1">Bank & Payment Details:</div>
          <div>{companyDetails.bankName}</div>
          <div>A/C: {companyDetails.bankAccount}</div>
          <div>IFSC: {companyDetails.bankIfsc}</div>
          <div>UPI: {companyDetails.upiId}</div>
          {/* QR Code and Payment Link */}
          <div className="mt-4 flex flex-col items-center">
            {companyDetails.upiQrUrl ? (
              <img src={companyDetails.upiQrUrl} alt="UPI QR" className="w-20 h-20 object-contain mb-2 border" loading="eager" />
            ) : (
              <div className="w-20 h-20 bg-gray-200 flex items-center justify-center text-xs text-gray-500 mb-2">QR</div>
            )}
            {companyDetails.paymentGatewayLink && (
              <a href={companyDetails.paymentGatewayLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">Pay Now</a>
            )}
          </div>
        </div>
        {/* Totals (No GST Table) */}
        <div className="totals-box" style={{ width: '100%', maxWidth: '50%' }}>
          <div className="font-bold mb-1">Totals</div>
          <div>Total Amount: ₹{companyDetails.gstinType === 'Regular' ? formatINR(Math.round(grandTotal)) : formatINR(Math.round(discountedSubtotal))}</div>
          <div>Discount: -₹{discount} {billData.discountType === 'percent' ? `(${billData.discountValue || 0}%)` : ''}</div>
          <div>Payable Amount: <b>₹{companyDetails.gstinType === 'Regular' ? formatINR(Math.round(grandTotal)) : formatINR(Math.round(discountedSubtotal))}</b></div>
          <div>In Words: <span className="italic">{numToWords(companyDetails.gstinType === 'Regular' ? Math.round(grandTotal) : Math.round(discountedSubtotal))}</span></div>
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="mb-4">
        <div className="font-bold">Terms and Conditions:</div>
        <div className="whitespace-pre-line">{companyDetails.salesTerms || companyDetails.terms}</div>
      </div>

      {/* Payment Details */}
      <div className="mb-4">
        <div className="font-bold">Payment Details:</div>
        <div>Status: {previewMode ? 'XXX' : billData.paymentStatus} &nbsp; Total Paid: ₹{previewMode ? 'XXX' : (billData.totalPaid?.toFixed(2) || 0)} &nbsp; <span className="text-red-600">Remaining Due: ₹{previewMode ? 'XXX' : (billData.remainingDue?.toFixed(2) || 0)}</span></div>
        <table className="w-full border mt-2 text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-1">Amount</th>
              <th className="border px-1">Date</th>
              <th className="border px-1">Mode</th>
              <th className="border px-1">Reference/Notes</th>
            </tr>
          </thead>
          <tbody>
            {(payments || []).length === 0 ? (
              <tr><td colSpan={4} className="border px-1 text-center">No payments</td></tr>
            ) : (
              payments.map((p, idx) => (
                <tr key={idx}>
                  <td className="border px-1 text-right">{p.amount}</td>
                  <td className="border px-1 text-center">{p.date}</td>
                  <td className="border px-1 text-center">{p.mode}</td>
                  <td className="border px-1">{p.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Disclaimer for Composition Scheme */}
      {companyDetails.gstinType === 'Composition' && (
        <div className="text-red-600 font-bold text-sm mb-2">
          Composition taxable person, not eligible to collect tax on supplies
        </div>
      )}

      {/* Footer: Signatures */}
      <div className="flex justify-between items-end mt-12" style={{ minHeight: '64px' }}>
        <div className="text-xs text-gray-700 flex flex-col items-start justify-end" style={{minHeight:'64px'}}>
          <div className="flex flex-col items-center">
            {/* Receiver Signature image placeholder (if any in future) */}
          </div>
          <span className="mt-1">Receiver Signature</span>
        </div>
        <div className="text-xs text-gray-700 text-right flex flex-col items-end justify-end" style={{minHeight:'64px'}}>
          <div className="flex flex-row items-end gap-2">
            {bankDetails.sealUrl && <img src={bankDetails.sealUrl} alt="Company Seal" loading="eager" crossOrigin="anonymous" style={{height:'40px', maxWidth:'80px', objectFit:'contain', display:'block', printColorAdjust:'exact', WebkitPrintColorAdjust:'exact', visibility:'visible !important', background:'none !important', border:'none !important'}} className="print:visible" />}
            {bankDetails.signUrl && <img src={bankDetails.signUrl} alt="Company Sign" loading="eager" crossOrigin="anonymous" style={{height:'40px', maxWidth:'80px', objectFit:'contain', display:'block', printColorAdjust:'exact', WebkitPrintColorAdjust:'exact', visibility:'visible !important', background:'none !important', border:'none !important'}} className="print:visible" />}
          </div>
          <span className="mt-1">Company Seal & Sign</span>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
          @page {
            size: ${pageDims.width}mm ${pageDims.height}mm ${orientation};
            margin: 8mm;
          }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-0 { border: none !important; }
          /* .bank-totals-flex-row { display: none !important; } */
          .bank-totals-print-table { display: table !important; }
          img, .print\:visible {
            display: block !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            visibility: visible !important;
            max-width: 80px !important;
            max-height: 40px !important;
            background: none !important;
            border: none !important;
          }
          .bank-totals-flex-row { display: flex !important; flex-direction: row !important; gap: 16px !important; }
          .bank-box { max-width: 40% !important; width: 100% !important; }
          .totals-box { max-width: 60% !important; width: 100% !important; }
        }
        /* PDF output uses print CSS via html2pdf.js, so keep print and PDF layouts identical. */
      `}</style>
    </div>
  );
}

export default ChallanTemplate; 