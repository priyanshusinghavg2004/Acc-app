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

function QuotationTemplate({ billData = {}, companyDetails = {}, partyDetails = {}, bankDetails = {} }) {
  const items = billData.items || billData.rows || [];
  const totalAmount = items.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const discount = billData.discountType === 'percent'
    ? totalAmount * (parseFloat(billData.discountValue) || 0) / 100
    : parseFloat(billData.discountValue) || 0;
  const discountedSubtotal = Math.max(0, totalAmount - discount);
  const payableAmount = discountedSubtotal;
  const terms = billData.quotationTermsOverride || companyDetails.quotationTerms || '';

  return (
    <div className="p-4 md:p-8 bg-white rounded shadow max-w-3xl w-full mx-auto text-sm print:p-0 print:shadow-none print:bg-white">
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
          <div className="text-2xl font-bold tracking-wider">QUOTATION</div>
          <div className="mt-2"><span className="font-semibold">Quotation No:</span> {billData.quotationNumber || billData.invoiceNumber || billData.number || ''}</div>
          <div><span className="font-semibold">Date:</span> {billData.date || billData.invoiceDate || ''}</div>
        </div>
      </div>
      {/* To (Party) */}
      <div className="mb-2">
        <div className="font-semibold">To:</div>
        <div>{partyDetails.firmName || partyDetails.name || ''}</div>
        <div>{partyDetails.address || ''}</div>
        <div>{partyDetails.city || ''} {partyDetails.pincode || ''}</div>
        <div>GSTIN: {partyDetails.gstin || 'N/A'}</div>
        <div>Contact: {partyDetails.contactNumber || ''} {partyDetails.email ? '| ' + partyDetails.email : ''}</div>
      </div>
      {/* Note */}
      {billData.notes && (
        <div className="mb-2">
          <div className="font-semibold">Note:</div>
          <div className="italic text-gray-700">{billData.notes}</div>
        </div>
      )}
      {/* Item Table */}
      <div className="overflow-x-auto mt-4 mb-4">
        <table className="w-full min-w-[560px] border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">Sr.</th>
              <th className="border px-2 py-1">Description</th>
              <th className="border px-2 py-1">Qty</th>
              <th className="border px-2 py-1">Rate</th>
              <th className="border px-2 py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={idx}>
                <td className="border px-2 py-1 text-center">{idx + 1}</td>
                <td className="border px-2 py-1">{row.description || row.itemName || ''}</td>
                <td className="border px-2 py-1 text-right">{row.qty || row.nos || ''}</td>
                <td className="border px-2 py-1 text-right">₹{formatINR(row.rate)}</td>
                <td className="border px-2 py-1 text-right">₹{formatINR(row.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="border px-2 py-1 text-right font-semibold">Total</td>
              <td className="border px-2 py-1 text-right font-bold">₹{formatINR(totalAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="border px-2 py-1 text-right">Discount</td>
              <td className="border px-2 py-1 text-right">-₹{formatINR(discount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="border px-2 py-1 text-right font-semibold">Payable Amount</td>
              <td className="border px-2 py-1 text-right font-bold">₹{formatINR(payableAmount)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border px-2 py-1 text-right italic">In Words: {numToWords(payableAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Bank Details */}
      <div className="mt-4 mb-2">
        <div className="font-semibold mb-1">Bank Details:</div>
        <div>Bank: {companyDetails.bankName || bankDetails.name || ''}</div>
        <div>Account No: {companyDetails.bankAccount || bankDetails.account || ''}</div>
        <div>IFSC: {companyDetails.bankIfsc || bankDetails.ifsc || ''}</div>
        <div>UPI: {companyDetails.upiId || bankDetails.upi || ''}</div>
        {companyDetails.upiQrUrl && <img src={companyDetails.upiQrUrl} alt="UPI QR" className="h-20 mt-2" />}
        {companyDetails.paymentGatewayLink && <div>Payment Link: <a href={companyDetails.paymentGatewayLink} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{companyDetails.paymentGatewayLink}</a></div>}
      </div>
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

export default QuotationTemplate; 