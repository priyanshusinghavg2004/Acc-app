import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import GlobalExportButtons from '../GlobalExportButtons';
import { buildReportFilename } from './exportUtils';

const PaymentRegisterReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [paymentData, setPaymentData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalPayments: 0,
    totalAmount: 0,
    totalApplied: 0,
    totalUnapplied: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(paymentData, { key: 'date', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 25);
  const [companyDetails, setCompanyDetails] = useState(null);

  // Fetch company details (for exports/print)
  useEffect(() => {
    if (!db || !userId || !appId) return;
    const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
    const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [db, userId, appId]);

  // Fetch payment register data
  useEffect(() => {
    const fetchPaymentRegister = async () => {
      if (!db || !userId || !appId) return;

      setLoading(true);
      try {
        // Fetch payments (align with Payments.js path/schema)
        const paymentsQueryRef = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          orderBy('paymentDate', 'desc')
        );
        const paymentsSnapshot = await getDocs(paymentsQueryRef);
        let payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter by date range (paymentDate is stored as YYYY-MM-DD string)
        const startStr = dateRange?.start ? new Date(dateRange.start).toISOString().slice(0, 10) : null;
        const endStr = dateRange?.end ? new Date(dateRange.end).toISOString().slice(0, 10) : null;
        if (startStr && endStr) {
          payments = payments.filter(p => {
            const d = (p.paymentDate || '').slice(0, 10);
            return d && d >= startStr && d <= endStr;
          });
        }

        // Filter by selected party if specified
        if (selectedParty) {
          payments = payments.filter(p => p.partyId === selectedParty);
        }

        // Build register rows from stored allocations (no need to refetch bills)
        const paymentRegister = payments.map(payment => {
          const allocations = Array.isArray(payment.allocations) ? payment.allocations : [];
          const appliedAmount = allocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
          const unappliedAmount = Math.max(0, (Number(payment.totalAmount || payment.amount || 0)) - appliedAmount - (Number(payment.remainingAmount || 0) ? 0 : 0));

          // Build applied-to string using bill numbers present in allocations
          const appliedTo = allocations.map(a => {
            const billNum = a.billNumber || a.billId || 'N/A';
            const billType = a.billType || 'invoice';
            const amt = Number(a.allocatedAmount || 0).toLocaleString('en-IN');
            return `${billNum} (${billType}): Rs ${amt}`;
          }).join('<br>');

          const partyName = payment.partyName || parties.find(p => p.id === payment.partyId)?.firmName || parties.find(p => p.id === payment.partyId)?.name || 'Unknown';

          return {
            paymentNo: payment.receiptNumber || payment.id,
            date: payment.paymentDate || payment.date,
            partyName,
            partyId: payment.partyId,
            amountPaid: Number(payment.totalAmount || payment.amount || 0),
            appliedToInvoices: appliedTo,
            unappliedAmount: Number(payment.remainingAmount ?? (Number(payment.totalAmount || payment.amount || 0) - appliedAmount)) || 0,
            status: (appliedAmount >= Number(payment.totalAmount || payment.amount || 0)) ? 'Fully Applied' : (appliedAmount > 0 ? 'Partially Applied' : 'Unapplied'),
            paymentId: payment.id,
            paymentMode: payment.paymentMode || 'N/A',
            paymentType: payment.paymentType || 'N/A',
            reference: payment.reference || payment.paymentReference || 'N/A'
          };
        });

        setPaymentData(paymentRegister);

        // Calculate totals
        const totals = paymentRegister.reduce((acc, payment) => ({
          totalPayments: acc.totalPayments + 1,
          totalAmount: acc.totalAmount + (payment.amountPaid || 0),
          totalApplied: acc.totalApplied + ((payment.amountPaid || 0) - (payment.unappliedAmount || 0)),
          totalUnapplied: acc.totalUnapplied + (payment.unappliedAmount || 0)
        }), { totalPayments: 0, totalAmount: 0, totalApplied: 0, totalUnapplied: 0 });

        setTotalSummary(totals);
      } catch (error) {
        console.error('Error fetching payment register data:', error);
        setPaymentData([]);
        setTotalSummary({ totalPayments: 0, totalAmount: 0, totalApplied: 0, totalUnapplied: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentRegister();
  }, [db, userId, appId, dateRange, selectedParty, parties]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // PDF-safe currency (avoid ₹ glyph issues in jsPDF default fonts)
  const formatCurrencyPdf = (amount) => {
    const n = Number(amount || 0);
    return `Rs ${n.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      
      return dateObj.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid Date';
    }
  };

  // Handle row click - open payment
  const handleRowClick = (payment) => {
    console.log('Open payment:', payment.paymentId);
    // You can implement navigation logic here
  };

  // Prepare export data for GlobalExportButtons
  const getExportData = () => sortedData;

  const getExportColumns = () => [
    { key: 'paymentNo', label: 'Payment No' },
    { key: 'date', label: 'Date' },
    { key: 'partyName', label: 'Party' },
    { key: 'amountPaid', label: 'Amount' },
    { key: 'appliedToInvoices', label: 'Applied To Bills' },
    { key: 'unappliedAmount', label: 'Unapplied' },
    { key: 'status', label: 'Status' },
    { key: 'paymentMode', label: 'Mode' },
    { key: 'reference', label: 'Reference' }
  ];

  const getReportDetails = () => ({
    'Period': `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
    'Total Payments': totalSummary.totalPayments,
    'Total Amount': totalSummary.totalAmount,
    'Total Applied': totalSummary.totalApplied,
    'Unapplied': totalSummary.totalUnapplied,
    dateRange
  });





  // Export as Image
  const exportAsImage = () => {
    if (!sortedData || sortedData.length === 0) return;
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.style.backgroundColor = 'white';
    container.style.padding = '20px';
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${companyDetails?.firmName || 'Company Name'}</div>
        <div style="font-size: 12px; color: #666;">
          ${companyDetails?.address ? `<div>${companyDetails.address}</div>` : ''}
          ${companyDetails?.city && companyDetails?.state ? `<div>${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}</div>` : ''}
          ${companyDetails?.gstin || companyDetails?.contactNumber ? `<div>${companyDetails?.gstin ? `GSTIN: ${companyDetails.gstin}` : ''}${companyDetails?.gstin && companyDetails?.contactNumber ? ' | ' : ''}${companyDetails?.contactNumber ? `Phone: ${companyDetails.contactNumber}` : ''}</div>` : ''}
          ${companyDetails?.email ? `<div>Email: ${companyDetails.email}</div>` : ''}
        </div>
      </div>
      <div style="font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0;">PAYMENT REGISTER REPORT</div>
      <div style="margin: 20px 0;">
        <div><strong>Period:</strong> ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
        <div><strong>Total Payments:</strong> ${totalSummary.totalPayments}</div>
        <div><strong>Total Amount:</strong> ${formatCurrency(totalSummary.totalAmount)}</div>
        <div><strong>Total Applied:</strong> ${formatCurrency(totalSummary.totalApplied)}</div>
        <div><strong>Unapplied:</strong> ${formatCurrency(totalSummary.totalUnapplied)}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Payment No</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Party</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Amount</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Applied To Bills</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Unapplied</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Status</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Mode</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Reference</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(p => `
            <tr>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${p.paymentNo}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${formatDate(p.date)}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${p.partyName}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px; text-align:right;\">${formatCurrency(p.amountPaid)}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${(p.appliedToInvoices || '').replace(/<br>/g, '<br>')}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px; text-align:right;\">${formatCurrency(p.unappliedAmount)}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${p.status}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${p.paymentMode}</td>
              <td style=\"border: 1px solid #ddd; padding: 8px;\">${p.reference}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.body.appendChild(container);
    import('html2canvas').then(html2canvas => {
      html2canvas.default(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' })
        .then(canvas => {
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = buildReportFilename({ prefix: 'PAYMENT_REGISTER', companyDetails, dateRange });
            link.download = `${filename}.png`;
            link.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(container);
          }, 'image/png');
        });
    }).catch(() => {
      alert('Error generating image. Please try again.');
      document.body.removeChild(container);
    });
  };

  // Share link
  const shareLink = () => {
    const shareData = {
      title: 'ACCTOO Payment Register Report',
      text: `Check out this Payment Register report for period ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      const url = `https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`;
      window.open(url, '_blank');
    }
  };

  // Sample data for testing
  const sampleData = [
    {
      paymentNo: 'PRI25-26/1',
      date: '2025-04-03',
      partyName: 'ABC Corp',
      partyId: 'sample1',
      amountPaid: 5000,
      appliedToInvoices: 'INV25-26/1: ₹5,000',
      unappliedAmount: 0,
      status: 'Fully Applied',
      paymentId: 'sample1',
      paymentMode: 'Cash',
      paymentType: 'Bill Payment',
      reference: 'N/A'
    },
    {
      paymentNo: 'PRI25-26/2',
      date: '2025-04-07',
      partyName: 'ABC Corp',
      partyId: 'sample1',
      amountPaid: 3000,
      appliedToInvoices: 'INV25-26/1: ₹3,000',
      unappliedAmount: 0,
      status: 'Fully Applied',
      paymentId: 'sample2',
      paymentMode: 'Bank Transfer',
      paymentType: 'Khata Payment',
      reference: 'TXN123456'
    },
    {
      paymentNo: 'PRI25-26/5',
      date: '2025-04-12',
      partyName: 'ABC Corp',
      partyId: 'sample1',
      amountPaid: 6000,
      appliedToInvoices: 'INV25-26/2: ₹4,000<br>INV25-26/3: ₹2,000',
      unappliedAmount: 0,
      status: 'Fully Applied',
      paymentId: 'sample3',
      paymentMode: 'Cheque',
      paymentType: 'Bill Payment',
      reference: 'CHQ789012'
    }
  ];

  // Use sample data if no real data
  const displayData = paymentData.length > 0 ? paymentData : sampleData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Payment Register Report</h2>
            <p className="text-gray-600">
              Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
              {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.firmName || parties.find(p => p.id === selectedParty)?.name || selectedParty}`}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Shows all payments with FIFO allocation to outstanding bills
            </p>
          </div>
          {/* Global Export/Print/Share Buttons */}
          <GlobalExportButtons
            data={getExportData()}
            columns={getExportColumns()}
            filename="PAYMENT_REGISTER"
            title="Payment Register Report"
            companyDetails={companyDetails}
            reportDetails={getReportDetails()}
            disabled={sortedData.length === 0}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Payments</div>
          <div className="text-2xl font-bold text-blue-800">{totalSummary.totalPayments}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Amount</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalAmount)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Total Applied</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totalSummary.totalApplied)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Unapplied</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totalSummary.totalUnapplied)}</div>
        </div>
      </div>

      {/* Payment Register Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader 
                  columnKey="paymentNo" 
                  label="Payment No" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="w-28"
                />
                <SortableHeader 
                  columnKey="date" 
                  label="Date" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="w-24"
                />
                <SortableHeader 
                  columnKey="partyName" 
                  label="Party" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="w-40"
                />
                <SortableHeader 
                  columnKey="amountPaid" 
                  label="Amount Paid" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="w-28"
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied To Bills
                </th>
                <SortableHeader 
                  columnKey="unappliedAmount" 
                  label="Unapplied Amount" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="w-28"
                />
                <SortableHeader 
                  columnKey="status" 
                  label="Status" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="w-28"
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.map((payment, index) => (
                <tr 
                  key={payment.paymentId || index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(payment)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600 hover:underline">
                      {payment.paymentNo}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(payment.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.partyName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(payment.amountPaid)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 align-top">
                    <div
                      className="max-w-3xl whitespace-pre-wrap break-words tracking-normal"
                      style={{ maxWidth: '600px' }}
                      dangerouslySetInnerHTML={{ __html: payment.appliedToInvoices || '-' }}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={`font-medium ${
                      payment.unappliedAmount > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(payment.unappliedAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'Fully Applied' ? 'bg-green-100 text-green-800' :
                      payment.status === 'Partially Applied' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentMode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <PaginationControls {...pagination} />
      </div>

      {/* No Data Message */}
      {displayData.length === 0 && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No payment register data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">Loading payment register data...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}
    </div>
  );
};

export default PaymentRegisterReport; 