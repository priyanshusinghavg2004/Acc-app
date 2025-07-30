import React, { forwardRef } from 'react';

const ReceiptTemplate = forwardRef(({ receipt, bill, company, party, receiptNumber, fifoAllocation = [], customImages = {} }, ref) => {
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
    <div ref={ref} className="receipt-container" style={{
      backgroundColor: 'white',
      padding: '40px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
      color: '#1f2937'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>PAYMENT RECEIPT</h1>
        <div style={{ fontSize: '18px', color: '#2563eb', fontFamily: 'monospace' }}>Receipt No: {receiptNumber || 'N/A'}</div>
      </div>
      
      {/* Company Information */}
      <div style={{ textAlign: 'center', marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #d1d5db' }}>
        {/* Company Logo */}
        {customImages.logo && (
          <div style={{ marginBottom: '15px' }}>
            <img 
              src={customImages.logo} 
              alt="Company Logo" 
              style={{ 
                maxHeight: '60px', 
                maxWidth: '200px', 
                objectFit: 'contain' 
              }} 
            />
          </div>
        )}
        
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '5px' }}>{getCompanyName()}</div>
        {company?.address && <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>{company.address}</div>}
        {company?.gstin && <div style={{ fontSize: '14px', color: '#6b7280' }}>GSTIN: {company.gstin}</div>}
      </div>
      
      {/* Receipt Details */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <span style={{ fontWeight: '600', color: '#374151' }}>Date:</span>
          <span style={{ fontSize: '16px' }}>{formatDate(receipt.date)}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <span style={{ fontWeight: '600', color: '#374151' }}>Receipt No:</span>
          <span style={{ fontSize: '16px', fontFamily: 'monospace', color: '#2563eb' }}>{receiptNumber || 'N/A'}</span>
        </div>
        
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', marginBottom: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <span style={{ fontWeight: '600', color: '#374151' }}>Received From:</span>
            <div style={{ fontSize: '16px', fontWeight: '500', marginTop: '5px' }}>{getPartyName()}</div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <span style={{ fontWeight: '600', color: '#374151' }}>Amount:</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a', marginTop: '5px' }}>
              ₹{parseFloat(receipt.totalAmount || receipt.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ fontWeight: '600', color: '#374151' }}>Payment Mode:</span>
            <span style={{ fontSize: '16px' }}>{receipt.mode || receipt.paymentMethod || 'Cash'}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ fontWeight: '600', color: '#374151' }}>Reference:</span>
            <span style={{ fontSize: '16px' }}>{receipt.reference || '-'}</span>
          </div>
          
          {receipt.billReference ? (
            <div style={{ marginTop: '15px' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Against Invoice:</span>
              <div style={{ fontSize: '16px', fontFamily: 'monospace', marginTop: '5px' }}>{bill?.number || bill?.invoiceNumber || bill?.billNumber || 'N/A'}</div>
            </div>
          ) : (
            <div style={{ marginTop: '15px' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Payment Type:</span>
              <div style={{ fontSize: '16px', color: '#2563eb', marginTop: '5px' }}>Advance Payment</div>
            </div>
          )}
          
          {receipt.notes && (
            <div style={{ marginTop: '15px' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Notes:</span>
              <div style={{ fontSize: '16px', marginTop: '5px' }}>{receipt.notes}</div>
            </div>
          )}
        </div>
        
        {/* Invoice-wise Allocation (FIFO) */}
        {fifoAllocation && fifoAllocation.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <div style={{ fontWeight: '600', color: '#2563eb', marginBottom: '15px' }}>Invoice-wise Allocation (FIFO):</div>
            <div>
              {fifoAllocation.map((alloc, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '4px', 
                  padding: '15px', 
                  marginBottom: '10px', 
                  backgroundColor: '#f9fafb' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span>Invoice: <span style={{ fontFamily: 'monospace' }}>{alloc.billNumber}</span></span>
                    <span style={{ color: alloc.isFullPayment ? '#16a34a' : '#ca8a04' }}>
                      {alloc.isFullPayment ? '(Full)' : '(Partial)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>Outstanding: ₹{alloc.billOutstanding?.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '14px', color: '#2563eb', fontWeight: '600' }}>Allocated: ₹{alloc.allocatedAmount?.toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advance Allocation Details */}
        {receipt.advanceAllocations && receipt.advanceAllocations.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <div style={{ fontWeight: '600', color: '#9333ea', marginBottom: '15px' }}>Advance Allocation Details:</div>
            <div>
              {receipt.advanceAllocations.map((advAlloc, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '4px', 
                  padding: '15px', 
                  marginBottom: '10px', 
                  backgroundColor: '#faf5ff' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span>Advance Receipt: <span style={{ fontFamily: 'monospace' }}>{advAlloc.paymentId}</span></span>
                    <span style={{ color: '#9333ea', fontWeight: '600' }}>Advance Used</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#9333ea', fontWeight: '600' }}>Amount Used: ₹{advAlloc.amountUsed?.toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FIFO Allocation Summary */}
        {receipt.fifoAllocationUsed && receipt.fifoAllocationUsed > 0 && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#f0fdf4', 
            borderLeft: '4px solid #16a34a', 
            color: '#166534', 
            borderRadius: '4px' 
          }}>
            <div style={{ fontWeight: '600', marginBottom: '5px' }}>FIFO Allocation Summary:</div>
            <div>Excess amount allocated to other bills: <span style={{ fontWeight: 'bold' }}>₹{receipt.fifoAllocationUsed.toLocaleString('en-IN')}</span></div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>This amount was automatically allocated to other outstanding bills using FIFO principle.</div>
          </div>
        )}

        {/* Advance Available */}
        {receipt.remainingAmount > 0 && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#fefce8', 
            borderLeft: '4px solid #ca8a04', 
            color: '#92400e', 
            borderRadius: '4px' 
          }}>
            <span style={{ fontWeight: '600' }}>Advance Available:</span> ₹{parseFloat(receipt.remainingAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
      
              {/* Footer */}
        <div style={{ 
          marginTop: '40px', 
          paddingTop: '20px', 
          borderTop: '1px solid #d1d5db', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-end' 
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            <div>Generated on: {new Date().toLocaleDateString()}</div>
            <div>Time: {new Date().toLocaleTimeString()}</div>
          </div>
          
          {/* Company Seal */}
          {customImages.seal && (
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
              <img 
                src={customImages.seal} 
                alt="Company Seal" 
                style={{ 
                  maxHeight: '80px', 
                  maxWidth: '80px', 
                  opacity: 0.7 
                }} 
              />
            </div>
          )}
          
          <div style={{ textAlign: 'center' }}>
            {/* Signature */}
            {customImages.signature ? (
              <div>
                <img 
                  src={customImages.signature} 
                  alt="Signature" 
                  style={{ 
                    maxHeight: '40px', 
                    maxWidth: '120px', 
                    marginBottom: '10px' 
                  }} 
                />
                <div style={{ fontWeight: '600', color: '#374151' }}>Authorized Signatory</div>
              </div>
            ) : (
              <div>
                <div style={{ borderTop: '2px solid #9ca3af', width: '120px', margin: '0 auto 10px' }}></div>
                <div style={{ fontWeight: '600', color: '#374151' }}>Authorized Signatory</div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
});

export default ReceiptTemplate; 