import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const GSTSummaryReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [gstData, setGstData] = useState([]);
  const [reportType, setReportType] = useState('gstr1'); // gstr1 or gstr3b
  const [invoiceType, setInvoiceType] = useState('all'); // all, b2b, b2c, export
  const [totalSummary, setTotalSummary] = useState({
    totalInvoices: 0,
    totalTaxable: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalAmount: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(gstData, { key: 'date', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 25);

  // Fetch GST data
  useEffect(() => {
    const fetchGSTReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        // Get all sales in date range
        const salesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
          where('invoiceDate', '>=', dateRange.start),
          where('invoiceDate', '<=', dateRange.end),
          orderBy('invoiceDate', 'desc')
        );

        const salesSnapshot = await getDocs(salesQuery);
        let sales = salesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.invoiceDate || d.date,
            invoiceNumber: d.invoiceNumber || d.number || doc.id,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            totalGST: parseFloat(d.totalGST || d.gst || 0),
            partyId: d.customFields?.party || d.party || d.partyId,
            partyName: d.partyName || ''
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          sales = sales.filter(sale => sale.partyId === selectedParty);
        }

        // Get all purchases in date range
        const purchasesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '>=', dateRange.start),
          where('billDate', '<=', dateRange.end),
          orderBy('billDate', 'desc')
        );

        const purchasesSnapshot = await getDocs(purchasesQuery);
        let purchases = purchasesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.billDate || d.date,
            billNumber: d.billNumber || d.number || doc.id,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            totalGST: parseFloat(d.totalGST || d.gst || 0),
            partyId: d.customFields?.party || d.party || d.partyId,
            partyName: d.partyName || ''
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          purchases = purchases.filter(purchase => purchase.partyId === selectedParty);
        }

        // Process GST data
        const gstRecords = [];

        // Process sales (outward supplies)
        sales.forEach(sale => {
          const party = parties.find(p => p.id === sale.partyId) || {};
          const isRegular = (party.gstin && party.gstin.trim() !== '') || true;
          const isInterState = party && party.state !== 'Maharashtra'; // Assuming Maharashtra as base state
          
          gstRecords.push({
            date: sale.date,
            docNo: sale.invoiceNumber,
            docType: 'Invoice',
            partyName: sale.partyName,
            supplyState: party?.state || 'Maharashtra',
            invoiceType: party?.gstin ? 'B2B' : 'B2C',
            taxable: sale.totalAmount - (sale.totalGST || 0),
            cgst: isRegular ? (isInterState ? 0 : (sale.totalGST || 0) / 2) : 0,
            sgst: isRegular ? (isInterState ? 0 : (sale.totalGST || 0) / 2) : 0,
            igst: isRegular ? (isInterState ? (sale.totalGST || 0) : 0) : 0,
            total: sale.totalAmount,
            recordType: 'outward',
            docId: sale.id
          });
        });

        // Process purchases (inward supplies for ITC)
        purchases.forEach(purchase => {
          const party = parties.find(p => p.id === purchase.partyId) || {};
          const isRegular = (party.gstin && party.gstin.trim() !== '') || true;
          const isInterState = party && party.state !== 'Maharashtra';
          
          gstRecords.push({
            date: purchase.date,
            docNo: purchase.billNumber,
            docType: 'Purchase',
            partyName: purchase.partyName,
            supplyState: party?.state || 'Maharashtra',
            invoiceType: party?.gstin ? 'B2B' : 'B2C',
            taxable: purchase.totalAmount - (purchase.totalGST || 0),
            cgst: isRegular ? (isInterState ? 0 : (purchase.totalGST || 0) / 2) : 0,
            sgst: isRegular ? (isInterState ? 0 : (purchase.totalGST || 0) / 2) : 0,
            igst: isRegular ? (isInterState ? (purchase.totalGST || 0) : 0) : 0,
            total: purchase.totalAmount,
            recordType: 'inward',
            docId: purchase.id
          });
        });

        setGstData(gstRecords);

        // Calculate totals
        const totals = gstRecords.reduce((acc, record) => ({
          totalInvoices: acc.totalInvoices + 1,
          totalTaxable: acc.totalTaxable + record.taxable,
          totalCGST: acc.totalCGST + record.cgst,
          totalSGST: acc.totalSGST + record.sgst,
          totalIGST: acc.totalIGST + record.igst,
          totalAmount: acc.totalAmount + record.total
        }), {
          totalInvoices: 0,
          totalTaxable: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalIGST: 0,
          totalAmount: 0
        });

        setTotalSummary(totals);

      } catch (error) {
        console.error('Error fetching GST report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGSTReport();
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

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN');
  };

  // Handle row click - open document
  const handleRowClick = (record) => {
    console.log('Open document:', record.docId, record.docType);
    // You can implement navigation logic here
  };

  // Filter data based on report type and invoice type
  const getFilteredData = () => {
    let filtered = sortedData;
    
    if (reportType === 'gstr1') {
      filtered = filtered.filter(record => record.recordType === 'outward');
    } else if (reportType === 'gstr3b') {
      // For GSTR-3B, we'll show summary
      return filtered;
    }
    
    if (invoiceType !== 'all') {
      filtered = filtered.filter(record => record.invoiceType === invoiceType);
    }
    
    return filtered;
  };

  // Sample data for testing
  const sampleData = [
    {
      date: '2025-04-01',
      docNo: 'INV25-26/1',
      docType: 'Invoice',
      partyName: 'ABC Pvt Ltd',
      supplyState: 'Maharashtra',
      invoiceType: 'B2B',
      taxable: 10000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      total: 11800,
      recordType: 'outward',
      docId: 'sample1'
    },
    {
      date: '2025-04-02',
      docNo: 'INV25-26/2',
      docType: 'Invoice',
      partyName: 'XYZ Ltd',
      supplyState: 'Delhi',
      invoiceType: 'B2B',
      taxable: 15000,
      cgst: 0,
      sgst: 0,
      igst: 2700,
      total: 17700,
      recordType: 'outward',
      docId: 'sample2'
    },
    {
      date: '2025-04-03',
      docNo: 'PRB25-26/1',
      docType: 'Purchase',
      partyName: 'Supplier Corp',
      supplyState: 'Maharashtra',
      invoiceType: 'B2B',
      taxable: 20000,
      cgst: 1800,
      sgst: 1800,
      igst: 0,
      total: 23600,
      recordType: 'inward',
      docId: 'sample3'
    }
  ];

  // Use sample data if no real data
  const displayData = gstData.length > 0 ? getFilteredData() : sampleData;

  // GSTR-3B Summary calculation
  const getGSTR3BSummary = () => {
    const outward = displayData.filter(record => record.recordType === 'outward');
    const inward = displayData.filter(record => record.recordType === 'inward');
    
    const outwardSummary = outward.reduce((acc, record) => ({
      taxable: acc.taxable + record.taxable,
      cgst: acc.cgst + record.cgst,
      sgst: acc.sgst + record.sgst,
      igst: acc.igst + record.igst
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    const inwardSummary = inward.reduce((acc, record) => ({
      taxable: acc.taxable + record.taxable,
      cgst: acc.cgst + record.cgst,
      sgst: acc.sgst + record.sgst,
      igst: acc.igst + record.igst
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    return {
      outward: outwardSummary,
      inward: inwardSummary,
      netPayable: {
        cgst: outwardSummary.cgst - inwardSummary.cgst,
        sgst: outwardSummary.sgst - inwardSummary.sgst,
        igst: outwardSummary.igst - inwardSummary.igst
      }
    };
  };

  const gstr3bSummary = getGSTR3BSummary();

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">GST Summary Report</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Report Type and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="gstr1">GSTR-1 (Outward Supplies)</option>
            <option value="gstr3b">GSTR-3B (Summary)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Type</label>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="export">Export</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
          <select className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Invoices</div>
          <div className="text-2xl font-bold text-blue-800">{totalSummary.totalInvoices}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Taxable</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalTaxable)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total GST</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(totalSummary.totalCGST + totalSummary.totalSGST + totalSummary.totalIGST)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Total Amount</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totalSummary.totalAmount)}</div>
        </div>
      </div>

      {/* GSTR-3B Summary View */}
      {reportType === 'gstr3b' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">GSTR-3B Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CGST</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SGST</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IGST</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Tax</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Outward</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.taxable)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.cgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.sgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.igst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.cgst + gstr3bSummary.outward.sgst + gstr3bSummary.outward.igst)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Inward ITC</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.taxable)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.cgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.sgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.igst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.cgst + gstr3bSummary.inward.sgst + gstr3bSummary.inward.igst)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Net Payable</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">-</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.cgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.sgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.igst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.cgst + gstr3bSummary.netPayable.sgst + gstr3bSummary.netPayable.igst)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GST Records Table */}
      {reportType === 'gstr1' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader 
                    columnKey="date" 
                    label="Date" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="docNo" 
                    label="Invoice No" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="partyName" 
                    label="Party" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="supplyState" 
                    label="Supply State" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="invoiceType" 
                    label="Type" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="taxable" 
                    label="Taxable" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="cgst" 
                    label="CGST" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="sgst" 
                    label="SGST" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="igst" 
                    label="IGST" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="total" 
                    label="Total" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagination.currentData.map((record, index) => (
                  <tr 
                    key={record.docId || index} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(record)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600 hover:underline">
                        {record.docNo}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.partyName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.supplyState}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.invoiceType === 'B2B' ? 'bg-blue-100 text-blue-800' :
                        record.invoiceType === 'B2C' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {record.invoiceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.taxable)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.cgst)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.sgst)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.igst)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <PaginationControls {...pagination} />
        </div>
      )}

      {/* No Data Message */}
      {displayData.length === 0 && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No GST data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default GSTSummaryReport; 