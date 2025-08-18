import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency, formatDate } from './CommonComponents';
import GlobalExportButtons from '../GlobalExportButtons';
import { globalModalManager } from '../Modal';

const InvoiceCollectionReport = ({ db, userId, appId, dateRange, selectedParty, parties, loading, setLoading, companyDetails }) => {
  const [collectionData, setCollectionData] = useState([]);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [quickSummaryInvoice, setQuickSummaryInvoice] = useState(null);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const receiptModalIdRef = useRef(`receipt-modal-${Math.random().toString(36).slice(2)}`);

  // Map party id -> name for quick lookup
  const partyIdToName = useMemo(() => {
    const map = {};
    (parties || []).forEach(p => {
      map[p.id] = p.firmName || p.name || p.partyName || p.displayName || 'Unknown';
    });
    return map;
  }, [parties]);

  // Helper to normalize party id in sales docs (handles stored as path like "parties/{id}")
  const getSalePartyId = (sale) => {
    let pid = sale.partyId || sale.party || sale.partyRef || sale.customerId || '';
    if (typeof pid === 'string' && pid.includes('/')) {
      const parts = pid.split('/');
      pid = parts[parts.length - 1];
    }
    return pid;
  };

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(collectionData, { key: 'invoiceDate', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 10);

  // Calculate totals
  const totalSummary = useMemo(() => {
    if (!sortedData.length) return { totalInvoices: 0, totalAmount: 0, totalPaid: 0, totalOutstanding: 0 };
    
    const totalAmount = sortedData.reduce((sum, item) => sum + (parseFloat(item.invoiceAmount) || 0), 0);
    const totalPaid = sortedData.reduce((sum, item) => sum + (parseFloat(item.paidAmount) || 0), 0);
    const totalOutstanding = totalAmount - totalPaid;
    
    return {
      totalInvoices: sortedData.length,
      totalAmount,
      totalPaid,
      totalOutstanding
    };
  }, [sortedData]);

  // Fetch collection data
  useEffect(() => {
    if (!db || !userId || !appId) return;
    
    setLoading(true);
    
    const fetchCollectionData = async () => {
      try {
        const basePath = `artifacts/${appId}/users/${userId}`;
        
        // Fetch sales bills
        const salesQuery = query(
          collection(db, `${basePath}/salesBills`),
          where('invoiceDate', '>=', dateRange.start.toISOString().split('T')[0]),
          where('invoiceDate', '<=', dateRange.end.toISOString().split('T')[0]),
          orderBy('invoiceDate', 'desc')
        );
        
        // Fetch payments (full list; not restricted by invoice date range)
        const paymentsQuery = query(
          collection(db, `${basePath}/payments`),
          orderBy('paymentDate', 'desc')
        );

        const [salesSnap, paymentsSnap] = await Promise.all([
          getDocs(salesQuery),
          getDocs(paymentsQuery)
        ]);

        const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const payments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllPayments(payments);

        // Filter by selected party if specified
        let filteredSales = sales;
        if (selectedParty) {
          filteredSales = sales.filter(sale => getSalePartyId(sale) === selectedParty);
        }

        // Process collection data
        const collectionEntries = filteredSales.map(sale => {
          const invoiceAmount = parseFloat(sale.totalAmount || sale.grandTotal || sale.amount || sale.invoiceAmount || 0);
          const invoiceId = sale.id;
          const invoiceNo = sale.invoiceNo || sale.billNo || sale.invoiceNumber || '';

          // Filter payments that truly belong to this bill number/id
          const relatedPaymentsDetailed = (payments || []).map(p => {
            const allocations = Array.isArray(p.allocations) ? p.allocations : [];
            const allocatedToThis = allocations
              .filter(a => {
                const billMatch = (a.billId === invoiceId) || (a.billNumber === invoiceNo);
                const typeOk = a.billType ? a.billType === 'invoice' : true;
                return billMatch && typeOk;
              })
              .reduce((s, a) => s + (parseFloat(a.allocatedAmount) || 0), 0);
            const isDirect = (p.invoiceId === invoiceId) || (p.invoiceNumber === invoiceNo);
            const relates = allocatedToThis > 0 || isDirect;
            return { p, allocatedToThis, isDirect, relates };
          }).filter(x => x.relates);

          // Compute paid amount using allocation sum plus direct-only receipts if no allocation
          const allocatedSum = relatedPaymentsDetailed.reduce((s, x) => s + (x.allocatedToThis || 0), 0);
          const directOnlySum = relatedPaymentsDetailed
            .filter(x => x.isDirect && (x.allocatedToThis || 0) === 0)
            .reduce((s, x) => s + (parseFloat(x.p.totalAmount || x.p.amount || 0)), 0);
          const paidAmount = allocatedSum + directOnlySum;

          const balance = invoiceAmount - paidAmount;
          const status = balance <= 0 ? 'Paid' : balance < invoiceAmount ? 'Partially Paid' : 'Unpaid';
          
          // Resolve party name using robust mapping
          const normalizedPartyId = getSalePartyId(sale);
          let partyName = partyIdToName[normalizedPartyId] 
            || sale.partyName 
            || sale.customerName 
            || sale.party 
            || normalizedPartyId 
            || 'Unknown';
          
          return {
            id: sale.id,
            invoiceNo: sale.invoiceNo || sale.billNo || sale.invoiceNumber || sale.number || sale.id,
            invoiceDate: sale.invoiceDate || sale.date,
            partyName: partyName,
            partyId: normalizedPartyId,
            invoiceAmount,
            paidAmount,
            balance,
            status,
            paymentsApplied: relatedPaymentsDetailed.length
          };
        });

        console.log('Invoice Collection Debug:', {
          totalSales: sales.length,
          filteredSales: filteredSales.length,
          collectionEntries: collectionEntries.length,
          sampleEntry: collectionEntries[0],
          parties: parties?.length || 0,
          sampleSale: sales[0],
          sampleParty: parties?.[0]
        });
        
        setCollectionData(collectionEntries);
      } catch (error) {
        console.error('Error fetching collection data:', error);
        setCollectionData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionData();
  }, [db, userId, appId, dateRange, selectedParty, setLoading, parties, partyIdToName]);

  // Handle invoice click for receipt preview
  const handleInvoiceClick = async (invoice) => {
    setQuickSummaryInvoice(invoice);
    
    try {
      // Use in-memory payments to ensure same logic as table
      const invoiceId = invoice.id;
      const invoiceNo = invoice.invoiceNo;
      const relevant = (allPayments || []).map(p => {
        const allocations = Array.isArray(p.allocations) ? p.allocations : [];
        const allocatedToThis = allocations
          .filter(a => {
            const billMatch = (a.billId === invoiceId) || (a.billNumber === invoiceNo);
            const typeOk = a.billType ? a.billType === 'invoice' : true;
            return billMatch && typeOk;
          })
          .reduce((s, a) => s + (parseFloat(a.allocatedAmount) || 0), 0);
        const isDirect = (p.invoiceId === invoiceId) || (p.invoiceNumber === invoiceNo);
        const relates = allocatedToThis > 0 || isDirect;
        return relates ? { ...p, allocatedAmount: allocatedToThis } : null;
      }).filter(Boolean)
        .sort((a, b) => new Date(a.paymentDate || a.date || '') - new Date(b.paymentDate || b.date || ''));

      setInvoicePayments(relevant);
      setShowReceiptPreview(true);
    } catch (error) {
      console.error('Error fetching invoice payments:', error);
      setInvoicePayments([]);
      setShowReceiptPreview(true);
    }
  };

  // Register custom receipt modal with global LIFO ESC manager
  useEffect(() => {
    if (showReceiptPreview) {
      const onClose = () => {
        setShowReceiptPreview(false);
        setQuickSummaryInvoice(null);
        setInvoicePayments([]);
      };
      globalModalManager.register(receiptModalIdRef.current, onClose);
      return () => {
        globalModalManager.unregister(receiptModalIdRef.current);
      };
    }
    return undefined;
  }, [showReceiptPreview]);

  // Prepare export data for GlobalExportButtons
  const getExportData = () => sortedData;

  const getExportColumns = () => [
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'invoiceDate', label: 'Date' },
    { key: 'partyName', label: 'Party' },
    { key: 'invoiceAmount', label: 'Amount' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'balance', label: 'Balance' },
    { key: 'status', label: 'Status' },
    { key: 'paymentsApplied', label: 'Payments Applied' }
  ];

  const selectedPartyName = useMemo(() => {
    if (!selectedParty) return '';
    const p = parties?.find(p => p.id === selectedParty);
    return p?.firmName || p?.name || p?.partyName || '';
  }, [selectedParty, parties]);

  const getReportDetails = () => ({
    'Period': `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
    ...(selectedPartyName ? { 'Party': selectedPartyName } : {}),
    'Total Invoices': totalSummary.totalInvoices,
    'Total Amount': totalSummary.totalAmount,
    'Total Paid': totalSummary.totalPaid,
    'Total Outstanding': totalSummary.totalOutstanding,
    dateRange
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading collection data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Bill-wise Collection Report</h2>
            <p className="text-gray-600">
              Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
              {selectedPartyName && (
                <span className="ml-4">Party: {selectedPartyName}</span>
              )}
            </p>
          </div>

          {/* Global Export/Print/Share Buttons */}
          <GlobalExportButtons
            data={getExportData()}
            columns={getExportColumns()}
            filename="INVOICE_COLLECTION"
            title="Bill-wise Collection Report"
            companyDetails={companyDetails}
            reportDetails={getReportDetails()}
            disabled={collectionData.length === 0}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-800">Total Invoices</div>
          <div className="text-2xl font-semibold text-blue-900">{totalSummary.totalInvoices}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-800">Total Amount</div>
          <div className="text-2xl font-semibold text-green-900">{formatCurrency(totalSummary.totalAmount)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-800">Total Paid</div>
          <div className="text-2xl font-semibold text-yellow-900">{formatCurrency(totalSummary.totalPaid)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-800">Outstanding</div>
          <div className="text-2xl font-semibold text-red-900">{formatCurrency(totalSummary.totalOutstanding)}</div>
        </div>
      </div>

      {/* Collection Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader columnKey="invoiceNo" label="Bill Number" onSort={handleSort} sortConfig={sortConfig} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
              <SortableHeader columnKey="partyName" label="Party Name" onSort={handleSort} sortConfig={sortConfig} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
              <SortableHeader columnKey="invoiceAmount" label="Total Amount" onSort={handleSort} sortConfig={sortConfig} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
              <SortableHeader columnKey="paidAmount" label="Total Paid" onSort={handleSort} sortConfig={sortConfig} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
              <SortableHeader columnKey="balance" label="Outstanding" onSort={handleSort} sortConfig={sortConfig} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Receipts</th>
              <SortableHeader columnKey="status" label="Status" onSort={handleSort} sortConfig={sortConfig} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagination.currentData.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No collection data found</td></tr>
            ) : pagination.currentData.map((row, idx) => (
              <tr key={row.id || idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 text-center">
                  {row.invoiceNo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {row.partyName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {formatCurrency(row.invoiceAmount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                  {formatCurrency(row.paidAmount)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-center ${
                  row.balance > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(row.balance)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <button
                    onClick={() => handleInvoiceClick(row)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Receipts ({row.paymentsApplied})
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    row.status === 'Paid' ? 'bg-green-100 text-green-800' :
                    row.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <PaginationControls {...pagination} />
      
      {/* Receipt Preview Modal */}
      {showReceiptPreview && quickSummaryInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl relative overflow-y-auto max-h-[95vh]">
            <button 
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" 
              onClick={() => {
                globalModalManager.unregister(receiptModalIdRef.current);
                setShowReceiptPreview(false);
                setQuickSummaryInvoice(null);
                setInvoicePayments([]);
              }}
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4 text-center">Payment Receipts</h3>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Invoice Number:</strong> {quickSummaryInvoice.invoiceNo}</div>
                <div><strong>Date:</strong> {formatDate(quickSummaryInvoice.invoiceDate)}</div>
                <div><strong>Party:</strong> {quickSummaryInvoice.partyName}</div>
                <div><strong>Total Amount:</strong> {formatCurrency(quickSummaryInvoice.invoiceAmount)}</div>
              </div>
            </div>
            
            {invoicePayments.length > 0 ? (
              <div className="space-y-6">
                {invoicePayments.map((payment, idx) => (
                  <div key={payment.id || idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-semibold text-blue-600">
                        Receipt #{payment.receiptNumber || payment.paymentId || payment.id}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {formatDate(payment.paymentDate || payment.date)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <span className="text-sm text-gray-600">Total Amount:</span>
                        <div className="font-semibold text-green-600">
                          ₹{parseFloat(payment.totalAmount || payment.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Allocated Amount:</span>
                        <div className="font-semibold text-blue-600">
                          ₹{parseFloat(payment.allocatedAmount || payment.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Mode:</span>
                        <div className="font-medium">{payment.paymentMode || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Reference:</span>
                        <div className="font-medium">{payment.reference || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <span className="text-sm text-gray-600">Type:</span>
                        <div className="font-medium">{payment.paymentType || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Date:</span>
                        <div className="font-medium">{formatDate(payment.paymentDate || payment.date)}</div>
                      </div>
                    </div>
                    
                    {payment.notes && (
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Notes:</span>
                        <div className="text-sm italic">{payment.notes}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No payment receipts found for this invoice.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCollectionReport; 