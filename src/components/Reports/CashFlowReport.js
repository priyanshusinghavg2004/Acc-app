import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const CashFlowReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [cashFlowData, setCashFlowData] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [transactionType, setTransactionType] = useState('all'); // all, cash, bank
  const [totalSummary, setTotalSummary] = useState({
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
    openingBalance: 0,
    closingBalance: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(cashFlowData, { key: 'date', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 25);

  // Fetch Cash Flow data
  useEffect(() => {
    const fetchCashFlowReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        // Get all payments
        let paymentsQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          where('paymentDate', '>=', dateRange.start),
          where('paymentDate', '<=', dateRange.end),
          orderBy('paymentDate', 'asc')
        );

        const paymentsSnapshot = await getDocs(paymentsQuery);
        const payments = paymentsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.paymentDate || d.date,
            amount: parseFloat(d.totalAmount || d.amount || 0),
            type: d.type || (d.receiptNumber?.startsWith('PRP') ? 'payment' : 'receipt'),
            paymentType: (d.paymentMode || '').toLowerCase().includes('cash') ? 'cash' : 'bank',
            description: d.notes || d.paymentType || '',
            documentNumber: d.receiptNumber || '',
            partyName: d.partyName || '',
            drillDownData: [d]
          };
        });

        // Get opening balance (payments before start date)
        const openingBalanceQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          where('paymentDate', '<', dateRange.start),
          orderBy('paymentDate', 'asc')
        );
        const openingBalanceSnapshot = await getDocs(openingBalanceQuery);
        const openingBalancePayments = openingBalanceSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.paymentDate || d.date,
            amount: parseFloat(d.totalAmount || d.amount || 0),
            type: d.type || (d.receiptNumber?.startsWith('PRP') ? 'payment' : 'receipt'),
            paymentType: (d.paymentMode || '').toLowerCase().includes('cash') ? 'cash' : 'bank'
          };
        });

        // Calculate opening balance
        const openingInflow = openingBalancePayments
          .filter(p => p.type === 'receipt')
          .reduce((sum, p) => sum + p.amount, 0);
        const openingOutflow = openingBalancePayments
          .filter(p => p.type === 'payment')
          .reduce((sum, p) => sum + p.amount, 0);
        const openingBalance = openingInflow - openingOutflow;

        // Process cash flow transactions
        const cashFlowTransactions = [];

        // Add opening balance entry
        cashFlowTransactions.push({
          date: dateRange.start,
          description: 'Opening Balance',
          type: 'opening',
          inflow: 0,
          outflow: 0,
          balance: openingBalance,
          docNo: '-',
          partyName: '-',
          paymentType: '-',
          drillDownData: []
        });

        // Process payments
        payments.forEach(payment => {
          const inflow = payment.type === 'receipt' ? payment.amount : 0;
          const outflow = payment.type === 'payment' ? payment.amount : 0;
          
          // Get previous balance
          const previousBalance = cashFlowTransactions.length > 0 
            ? cashFlowTransactions[cashFlowTransactions.length - 1].balance 
            : openingBalance;
          
          const newBalance = previousBalance + inflow - outflow;

          cashFlowTransactions.push({
            date: payment.date,
            description: payment.description || `${payment.type === 'receipt' ? 'Receipt' : 'Payment'} - ${payment.paymentType}`,
            type: payment.type,
            inflow: inflow,
            outflow: outflow,
            balance: newBalance,
            docNo: payment.paymentNumber || payment.documentNumber,
            partyName: payment.partyName,
            paymentType: payment.paymentType,
            drillDownData: [payment]
          });
        });

        setCashFlowData(cashFlowTransactions);

        // Calculate totals
        const totalInflow = cashFlowTransactions
          .filter(t => t.type === 'receipt')
          .reduce((sum, t) => sum + t.inflow, 0);
        const totalOutflow = cashFlowTransactions
          .filter(t => t.type === 'payment')
          .reduce((sum, t) => sum + t.outflow, 0);
        const netCashFlow = totalInflow - totalOutflow;
        const closingBalance = openingBalance + netCashFlow;

        setTotalSummary({
          totalInflow,
          totalOutflow,
          netCashFlow,
          openingBalance,
          closingBalance
        });

      } catch (error) {
        console.error('Error fetching cash flow data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCashFlowReport();
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

  // Handle transaction click for drill-down
  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
    setDrillDownData(transaction.drillDownData || []);
    setShowDrillDown(true);
  };

  // Handle back from drill-down
  const handleBackFromDrillDown = () => {
    setShowDrillDown(false);
    setSelectedTransaction(null);
    setDrillDownData([]);
  };

  // Handle drill-down row click
  const handleDrillDownRowClick = (item) => {
    console.log('Open document:', item.id, item.paymentNumber || item.documentNumber);
    // You can implement navigation logic here
  };

  // Filter data by transaction type
  const getFilteredData = () => {
    if (transactionType === 'all') return sortedData;
    return sortedData.filter(transaction => transaction.paymentType === transactionType);
  };

  // Sample data for testing
  const sampleData = [
    {
      date: '2025-04-01',
      description: 'Opening Balance',
      type: 'opening',
      inflow: 0,
      outflow: 0,
      balance: 50000,
      docNo: '-',
      partyName: '-',
      paymentType: '-',
      drillDownData: []
    },
    {
      date: '2025-04-02',
      description: 'Cash Sales',
      type: 'receipt',
      inflow: 25000,
      outflow: 0,
      balance: 75000,
      docNo: 'PRC25-26/1',
      partyName: 'Cash Sales',
      paymentType: 'cash',
      drillDownData: []
    },
    {
      date: '2025-04-03',
      description: 'Rent Paid',
      type: 'payment',
      inflow: 0,
      outflow: 20000,
      balance: 55000,
      docNo: 'PRP25-26/1',
      partyName: 'Landlord',
      paymentType: 'cash',
      drillDownData: []
    },
    {
      date: '2025-04-04',
      description: 'Customer Payment',
      type: 'receipt',
      inflow: 30000,
      outflow: 0,
      balance: 85000,
      docNo: 'PRC25-26/2',
      partyName: 'ABC Ltd',
      paymentType: 'bank',
      drillDownData: []
    },
    {
      date: '2025-04-05',
      description: 'Supplier Payment',
      type: 'payment',
      inflow: 0,
      outflow: 15000,
      balance: 70000,
      docNo: 'PRP25-26/2',
      partyName: 'XYZ Corp',
      paymentType: 'bank',
      drillDownData: []
    }
  ];

  // Use sample data if no real data
  const displayData = cashFlowData.length > 0 ? getFilteredData() : sampleData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Cash Flow / Daybook Report</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Transactions</option>
              <option value="cash">Cash Only</option>
              <option value="bank">Bank Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Inflow</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalInflow)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Total Outflow</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totalSummary.totalOutflow)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Net Cash Flow</div>
          <div className="text-2xl font-bold text-blue-800">{formatCurrency(totalSummary.netCashFlow)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Opening Balance</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totalSummary.openingBalance)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Closing Balance</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(totalSummary.closingBalance)}</div>
        </div>
      </div>

      {/* Back Button for Drill-down */}
      {showDrillDown && (
        <div className="mb-4">
          <button
            onClick={handleBackFromDrillDown}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-300"
          >
            ← Back to Cash Flow
          </button>
        </div>
      )}

      {/* Cash Flow Table */}
      {!showDrillDown && (
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
                    columnKey="description" 
                    label="Description" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="type" 
                    label="Type" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="inflow" 
                    label="Inflow" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="outflow" 
                    label="Outflow" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="balance" 
                    label="Balance" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagination.currentData.map((transaction, index) => (
                  <tr 
                    key={`transaction-${index}`}
                    className={`hover:bg-gray-50 transition-colors ${
                      transaction.type === 'opening' ? 'bg-gray-100' : 'cursor-pointer'
                    }`}
                    onClick={() => transaction.type !== 'opening' && handleTransactionClick(transaction)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <span>{transaction.description}</span>
                        {transaction.drillDownData && transaction.drillDownData.length > 0 && (
                          <span className="ml-2 text-blue-500 text-xs">(Click to view details)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.type === 'receipt' ? 'bg-green-100 text-green-800' :
                        transaction.type === 'payment' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.type === 'receipt' ? 'Credit' :
                         transaction.type === 'payment' ? 'Debit' :
                         transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {transaction.inflow > 0 ? formatCurrency(transaction.inflow) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {transaction.outflow > 0 ? formatCurrency(transaction.outflow) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(transaction.balance)}
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

      {/* Drill-down Table */}
      {showDrillDown && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Transaction Details
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedTransaction?.description} - {formatDate(selectedTransaction?.date)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doc No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drillDownData.map((item, index) => (
                  <tr 
                    key={item.id || index}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleDrillDownRowClick(item)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600 hover:underline">
                        {item.paymentNumber || item.documentNumber || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.partyName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.type === 'receipt' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.type === 'receipt' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {displayData.length === 0 && !loading && !showDrillDown && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No cash flow data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default CashFlowReport; 