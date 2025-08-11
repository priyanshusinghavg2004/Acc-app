import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const BillsReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [billsData, setBillsData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalBills: 0,
    totalAmount: 0,
    totalGST: 0,
    paidBills: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(billsData, { key: 'date', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 25);

  // Fetch bills data
  useEffect(() => {
    const fetchBillsReport = async () => {
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
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            partyId: d.customFields?.party || d.party || d.partyId,
            partyName: d.partyName || '',
            docType: 'Invoice',
            invoiceNumber: d.invoiceNumber || d.number || doc.id
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
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            partyId: d.customFields?.party || d.party || d.partyId,
            partyName: d.partyName || '',
            docType: 'Purchase',
            billNumber: d.billNumber || d.number || doc.id
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          purchases = purchases.filter(purchase => purchase.partyId === selectedParty);
        }

        // Get all challans in date range
        const challansQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/challans`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );

        const challansSnapshot = await getDocs(challansQuery);
        let challans = challansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          challans = challans.filter(challan => challan.partyId === selectedParty);
        }

        // Get all payments for status calculation
        const paymentsQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          where('paymentDate', '<=', dateRange.end),
          orderBy('paymentDate', 'asc')
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const payments = paymentsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.paymentDate || d.date,
            partyId: d.partyId || d.party,
            amount: parseFloat(d.totalAmount || d.amount || 0),
            receiptNumber: d.receiptNumber,
            type: d.type,
            allocations: d.allocations || []
          };
        });

        // Combine all bills
        const allBills = [...sales, ...purchases, ...challans];

        // Apply FIFO payment logic to determine status
        const billsWithStatus = allBills.map(bill => {
          const partyPayments = payments
            .filter(p => p.partyId === bill.partyId)
            .filter(p => bill.docType === 'Invoice' ? (p.type === 'invoice' || p.receiptNumber?.startsWith('PRI') || (p.allocations || []).some(a => a.billType === 'invoice')) : (p.type === 'purchase' || p.receiptNumber?.startsWith('PRP') || (p.allocations || []).some(a => a.billType === 'purchase')))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          let totalPaid = 0;
          let remainingAmount = bill.totalAmount;

          // Apply payments using FIFO
          for (const payment of partyPayments) {
            if (remainingAmount <= 0) break;
            
            const amountToApply = Math.min(payment.amount, remainingAmount);
            totalPaid += amountToApply;
            remainingAmount -= amountToApply;
          }

          const status = totalPaid >= bill.totalAmount ? 'Paid' : 
                        totalPaid > 0 ? 'Partially Paid' : 'Pending';

          return {
            date: bill.date,
            docType: bill.docType,
            docNo: bill.invoiceNumber || bill.billNumber || bill.challanNumber || bill.number,
            partyName: bill.partyName,
            amount: bill.totalAmount,
            gst: bill.totalGST || 0,
            status: status,
            billId: bill.id
          };
        });

        setBillsData(billsWithStatus);

        // Calculate totals
        const totals = billsWithStatus.reduce((acc, bill) => ({
          totalBills: acc.totalBills + 1,
          totalAmount: acc.totalAmount + bill.amount,
          totalGST: acc.totalGST + bill.gst,
          paidBills: acc.paidBills + (bill.status === 'Paid' ? 1 : 0)
        }), {
          totalBills: 0,
          totalAmount: 0,
          totalGST: 0,
          paidBills: 0
        });

        setTotalSummary(totals);

      } catch (error) {
        console.error('Error fetching bills report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBillsReport();
  }, [db, userId, appId, dateRange, selectedParty]);

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
  const handleRowClick = (bill) => {
    console.log('Open document:', bill.billId, bill.docType);
    // You can implement navigation logic here
  };

  // Sample data for testing
  const sampleData = [
    {
      date: '2025-04-01',
      docType: 'Invoice',
      docNo: 'INV25-26/1',
      partyName: 'ABC Traders',
      amount: 25000,
      gst: 2250,
      status: 'Paid',
      billId: 'sample1'
    },
    {
      date: '2025-04-02',
      docType: 'Challan',
      docNo: 'CHA25-26/1',
      partyName: 'XYZ Ltd',
      amount: 15000,
      gst: 1350,
      status: 'Pending',
      billId: 'sample2'
    },
    {
      date: '2025-04-03',
      docType: 'Purchase',
      docNo: 'PRB25-26/1',
      partyName: 'Supplier Corp',
      amount: 30000,
      gst: 2700,
      status: 'Partially Paid',
      billId: 'sample3'
    }
  ];

  // Use sample data if no real data
  const displayData = billsData.length > 0 ? billsData : sampleData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Bills Report (Grouped View)</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Bills</div>
          <div className="text-2xl font-bold text-blue-800">{totalSummary.totalBills}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Amount</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalAmount)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total GST</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(totalSummary.totalGST)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Paid Bills</div>
          <div className="text-2xl font-bold text-yellow-800">{totalSummary.paidBills}</div>
        </div>
      </div>

      {/* Bills Table */}
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
                  columnKey="docType" 
                  label="Doc Type" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="docNo" 
                  label="Doc No" 
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
                  columnKey="amount" 
                  label="Amount" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="gst" 
                  label="GST" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="status" 
                  label="Status" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.map((bill, index) => (
                <tr 
                  key={bill.billId || index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(bill)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(bill.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      bill.docType === 'Invoice' ? 'bg-blue-100 text-blue-800' :
                      bill.docType === 'Purchase' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {bill.docType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600 hover:underline">
                      {bill.docNo}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bill.partyName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(bill.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(bill.gst)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      bill.status === 'Paid' ? 'bg-green-100 text-green-800' :
                      bill.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {bill.status}
                    </span>
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
          <div className="text-gray-500 text-lg mb-2">No bills data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default BillsReport; 