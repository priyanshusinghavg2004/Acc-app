import React, { forwardRef } from 'react';

const ReceiptTemplate = forwardRef(({ receipt, bill, company, party, receiptNumber, fifoAllocation = [] }, ref) => {
  if (!receipt) return null;
  
  // Helper function to get company name safely
  const getCompanyName = () => {
    if (company?.firmName) return company.firmName;
    if (company?.name) return company.name;
    if (company?.companyName) return company.companyName;
    return 'Company Name';
  };
  
  // Helper function to get party name safely
  const getPartyName = () => {
    if (party?.firmName) return party.firmName;
    if (party?.name) return party.name;
    return 'Party Name';
  };
  
  // Helper function to format date
  const formatDate = (dateField) => {
    if (!dateField) return 'Unknown date';
    if (typeof dateField === 'string') return dateField;
    if (dateField && typeof dateField === 'object' && dateField.seconds) {
      // It's a Firestore Timestamp
      return new Date(dateField.seconds * 1000).toISOString().split('T')[0];
    } else if (dateField) {
      // It's already a Date object
      return new Date(dateField).toISOString().split('T')[0];
    }
    return 'Unknown date';
  };
  
  return (
    <div ref={ref} className="bg-white p-8 rounded shadow max-w-lg mx-auto text-gray-900 font-sans" style={{ minHeight: '297mm', width: '210mm' }}>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">PAYMENT RECEIPT</h1>
        <div className="text-lg font-mono text-blue-600">Receipt No: {receiptNumber || 'N/A'}</div>
      </div>
      
      {/* Company Information */}
      <div className="text-center mb-6 p-4 border-b-2 border-gray-300">
        <div className="text-xl font-bold text-gray-800 mb-1">{getCompanyName()}</div>
        {company?.address && <div className="text-sm text-gray-600 mb-1">{company.address}</div>}
        {company?.gstin && <div className="text-sm text-gray-600">GSTIN: {company.gstin}</div>}
      </div>
      
      {/* Receipt Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold text-gray-700">Date:</span>
            <div className="text-lg">{formatDate(receipt.date)}</div>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Receipt No:</span>
            <div className="text-lg font-mono text-blue-600">{receiptNumber || 'N/A'}</div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <div className="mb-3">
            <span className="font-semibold text-gray-700">Received From:</span>
            <div className="text-lg font-medium">{getPartyName()}</div>
          </div>
          
          <div className="mb-3">
            <span className="font-semibold text-gray-700">Amount:</span>
            <div className="text-2xl font-bold text-green-600">
              ₹{parseFloat(receipt.totalAmount || receipt.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-semibold text-gray-700">Payment Mode:</span>
              <div className="text-lg">{receipt.mode || receipt.paymentMethod || 'Cash'}</div>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Reference:</span>
              <div className="text-lg">{receipt.reference || '-'}</div>
            </div>
          </div>
          
          {receipt.billReference ? (
            <div className="mt-3">
              <span className="font-semibold text-gray-700">Against Invoice:</span>
              <div className="text-lg font-mono">{bill?.number || bill?.invoiceNumber || bill?.billNumber || 'N/A'}</div>
            </div>
          ) : (
            <div className="mt-3">
              <span className="font-semibold text-gray-700">Payment Type:</span>
              <div className="text-lg text-blue-600">Advance Payment</div>
            </div>
          )}
          
          {receipt.notes && (
            <div className="mt-3">
              <span className="font-semibold text-gray-700">Notes:</span>
              <div className="text-lg">{receipt.notes}</div>
            </div>
          )}
        </div>
        
        {/* Invoice-wise Allocation (FIFO) */}
        {fifoAllocation && fifoAllocation.length > 0 && (
          <div className="mt-6">
            <div className="font-semibold text-blue-700 mb-2">Invoice-wise Allocation (FIFO):</div>
            <div className="space-y-2">
              {fifoAllocation.map((alloc, idx) => (
                <div key={idx} className="border rounded p-2 bg-gray-50 flex flex-col">
                  <div className="flex justify-between items-center">
                    <span>Invoice: <span className="font-mono">{alloc.billNumber}</span></span>
                    <span className={alloc.isFullPayment ? 'text-green-600' : 'text-yellow-600'}>
                      {alloc.isFullPayment ? '(Full)' : '(Partial)'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">Outstanding: ₹{alloc.billOutstanding?.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-blue-700 font-semibold">Allocated: ₹{alloc.allocatedAmount?.toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advance Available */}
        {receipt.remainingAmount > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded">
            <span className="font-semibold">Advance Available:</span> ₹{parseFloat(receipt.remainingAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-300">
        <div className="flex justify-between items-end">
          <div className="text-sm text-gray-500">
            <div>Generated on: {new Date().toLocaleDateString()}</div>
            <div>Time: {new Date().toLocaleTimeString()}</div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-gray-400 w-32 mx-auto mb-2"></div>
            <div className="font-semibold text-gray-700">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ReceiptTemplate; 