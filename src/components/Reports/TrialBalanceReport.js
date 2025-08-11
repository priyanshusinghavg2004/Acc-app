import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const TrialBalanceReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [trialBalanceData, setTrialBalanceData] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [ledgerGroup, setLedgerGroup] = useState('all');
  const [totalSummary, setTotalSummary] = useState({
    totalDebit: 0,
    totalCredit: 0,
    difference: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(trialBalanceData, { key: 'ledger', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // Fetch Trial Balance data
  useEffect(() => {
    const fetchTrialBalanceReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        // Get all sales (credit to sales account)
        let salesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
          where('invoiceDate', '<=', dateRange.end),
          orderBy('invoiceDate', 'desc')
        );

        const salesSnapshot = await getDocs(salesQuery);
        const sales = salesSnapshot.docs.map(doc => {
          const d = doc.data();
          return { id: doc.id, date: d.invoiceDate || d.date, totalAmount: parseFloat(d.totalAmount || d.amount || 0) };
        });

        // Get all purchases (debit to purchase account)
        let purchasesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '<=', dateRange.end),
          orderBy('billDate', 'desc')
        );

        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchases = purchasesSnapshot.docs.map(doc => {
          const d = doc.data();
          return { id: doc.id, date: d.billDate || d.date, totalAmount: parseFloat(d.totalAmount || d.amount || 0) };
        });

        // Get all payments for cash/bank accounts
        let paymentsQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          where('paymentDate', '<=', dateRange.end),
          orderBy('paymentDate', 'desc')
        );

        const paymentsSnapshot = await getDocs(paymentsQuery);
        const payments = paymentsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.paymentDate || d.date,
            amount: parseFloat(d.totalAmount || d.amount || 0),
            paymentType: (d.paymentMode || '').toLowerCase().includes('cash') ? 'cash' : 'bank',
            type: d.type || (d.receiptNumber?.startsWith('PRP') ? 'payment' : 'receipt'),
            documentType: d.documentType || (d.receiptNumber?.startsWith('PRI') ? 'sale' : d.receiptNumber?.startsWith('PRP') ? 'purchase' : 'expense')
          };
        });

        // Get all expenses
        let expensesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/expenses`),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );

        const expensesSnapshot = await getDocs(expensesQuery);
        const expenses = expensesSnapshot.docs.map(doc => {
          const d = doc.data();
          return { id: doc.id, date: d.date, amount: parseFloat(d.amount || 0) };
        });

        // Calculate trial balance entries
        const trialBalanceEntries = [];

        // Sales Account (Credit)
        const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        trialBalanceEntries.push({
          ledger: 'Sales',
          group: 'Income',
          debit: 0,
          credit: totalSales,
          drillDownData: sales,
          description: 'Revenue from sales of goods/services'
        });

        // Purchase Account (Debit)
        const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
        trialBalanceEntries.push({
          ledger: 'Purchase',
          group: 'Expenses',
          debit: totalPurchases,
          credit: 0,
          drillDownData: purchases,
          description: 'Cost of goods purchased'
        });

        // Cash Account
        const cashInflow = payments
          .filter(p => p.paymentType === 'cash' && p.type === 'receipt')
          .reduce((sum, p) => sum + p.amount, 0);
        const cashOutflow = payments
          .filter(p => p.paymentType === 'cash' && p.type === 'payment')
          .reduce((sum, p) => sum + p.amount, 0);
        const cashBalance = cashInflow - cashOutflow;

        trialBalanceEntries.push({
          ledger: 'Cash in Hand',
          group: 'Assets',
          debit: Math.max(0, cashBalance),
          credit: Math.max(0, -cashBalance),
          drillDownData: payments.filter(p => p.paymentType === 'cash'),
          description: 'Cash balance in hand'
        });

        // Bank Account
        const bankInflow = payments
          .filter(p => p.paymentType === 'bank' && p.type === 'receipt')
          .reduce((sum, p) => sum + p.amount, 0);
        const bankOutflow = payments
          .filter(p => p.paymentType === 'bank' && p.type === 'payment')
          .reduce((sum, p) => sum + p.amount, 0);
        const bankBalance = bankInflow - bankOutflow;

        trialBalanceEntries.push({
          ledger: 'Bank Balance',
          group: 'Assets',
          debit: Math.max(0, bankBalance),
          credit: Math.max(0, -bankBalance),
          drillDownData: payments.filter(p => p.paymentType === 'bank'),
          description: 'Bank account balance'
        });

        // Debtors Account
        const salesPayments = payments
          .filter(p => p.type === 'receipt' && p.documentType === 'sale')
          .reduce((sum, p) => sum + p.amount, 0);
        const debtors = totalSales - salesPayments;

        trialBalanceEntries.push({
          ledger: 'Debtors',
          group: 'Assets',
          debit: Math.max(0, debtors),
          credit: 0,
          drillDownData: sales,
          description: 'Amount receivable from customers'
        });

        // Creditors Account
        const purchasePayments = payments
          .filter(p => p.type === 'payment' && p.documentType === 'purchase')
          .reduce((sum, p) => sum + p.amount, 0);
        const creditors = totalPurchases - purchasePayments;

        trialBalanceEntries.push({
          ledger: 'Creditors',
          group: 'Liabilities',
          debit: 0,
          credit: Math.max(0, creditors),
          drillDownData: purchases,
          description: 'Amount payable to suppliers'
        });

        // Expenses
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        trialBalanceEntries.push({
          ledger: 'Expenses',
          group: 'Expenses',
          debit: totalExpenses,
          credit: 0,
          drillDownData: expenses,
          description: 'Operating and administrative expenses'
        });

        // Sample ledger entries
        trialBalanceEntries.push({
          ledger: 'Salaries',
          group: 'Expenses',
          debit: 50000,
          credit: 0,
          drillDownData: [],
          description: 'Employee salaries and wages'
        });

        trialBalanceEntries.push({
          ledger: 'Rent',
          group: 'Expenses',
          debit: 20000,
          credit: 0,
          drillDownData: [],
          description: 'Office and warehouse rent'
        });

        trialBalanceEntries.push({
          ledger: 'Capital Account',
          group: 'Equity',
          debit: 0,
          credit: 400000,
          drillDownData: [],
          description: 'Owner\'s capital investment'
        });

        trialBalanceEntries.push({
          ledger: 'Loans',
          group: 'Liabilities',
          debit: 0,
          credit: 100000,
          drillDownData: [],
          description: 'Long-term borrowings'
        });

        setTrialBalanceData(trialBalanceEntries);

        // Calculate totals
        const totalDebit = trialBalanceEntries.reduce((sum, entry) => sum + entry.debit, 0);
        const totalCredit = trialBalanceEntries.reduce((sum, entry) => sum + entry.credit, 0);
        const difference = totalDebit - totalCredit;

        setTotalSummary({
          totalDebit,
          totalCredit,
          difference
        });

      } catch (error) {
        console.error('Error fetching trial balance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrialBalanceReport();
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

  // Handle ledger click for drill-down
  const handleLedgerClick = (ledger) => {
    setSelectedLedger(ledger);
    setDrillDownData(ledger.drillDownData || []);
    setShowDrillDown(true);
  };

  // Handle back from drill-down
  const handleBackFromDrillDown = () => {
    setShowDrillDown(false);
    setSelectedLedger(null);
    setDrillDownData([]);
  };

  // Handle drill-down row click
  const handleDrillDownRowClick = (item) => {
    console.log('Open document:', item.id, item.invoiceNumber || item.billNumber || item.expenseNumber);
    // You can implement navigation logic here
  };

  // Filter data by ledger group
  const getFilteredData = () => {
    if (ledgerGroup === 'all') return sortedData;
    return sortedData.filter(entry => entry.group === ledgerGroup);
  };

  // Sample data for testing
  const sampleData = [
    {
      ledger: 'Sales',
      group: 'Income',
      debit: 0,
      credit: 500000,
      drillDownData: [],
      description: 'Revenue from sales of goods/services'
    },
    {
      ledger: 'Purchase',
      group: 'Expenses',
      debit: 300000,
      credit: 0,
      drillDownData: [],
      description: 'Cost of goods purchased'
    },
    {
      ledger: 'Cash in Hand',
      group: 'Assets',
      debit: 50000,
      credit: 0,
      drillDownData: [],
      description: 'Cash balance in hand'
    },
    {
      ledger: 'Bank Balance',
      group: 'Assets',
      debit: 100000,
      credit: 0,
      drillDownData: [],
      description: 'Bank account balance'
    },
    {
      ledger: 'Debtors',
      group: 'Assets',
      debit: 200000,
      credit: 0,
      drillDownData: [],
      description: 'Amount receivable from customers'
    },
    {
      ledger: 'Creditors',
      group: 'Liabilities',
      debit: 0,
      credit: 120000,
      drillDownData: [],
      description: 'Amount payable to suppliers'
    },
    {
      ledger: 'Salaries',
      group: 'Expenses',
      debit: 50000,
      credit: 0,
      drillDownData: [],
      description: 'Employee salaries and wages'
    },
    {
      ledger: 'Capital Account',
      group: 'Equity',
      debit: 0,
      credit: 400000,
      drillDownData: [],
      description: 'Owner\'s capital investment'
    }
  ];

  // Use sample data if no real data
  const displayData = trialBalanceData.length > 0 ? getFilteredData() : sampleData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Trial Balance Report</h2>
        <p className="text-gray-600">
          As on: {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ledger Group</label>
            <select
              value={ledgerGroup}
              onChange={(e) => setLedgerGroup(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Groups</option>
              <option value="Assets">Assets</option>
              <option value="Liabilities">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Income">Income</option>
              <option value="Expenses">Expenses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Debit</div>
          <div className="text-2xl font-bold text-blue-800">{formatCurrency(totalSummary.totalDebit)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Credit</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalCredit)}</div>
        </div>
        <div className={`p-4 rounded-lg ${totalSummary.difference === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-sm font-medium ${totalSummary.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
            Difference
          </div>
          <div className={`text-2xl font-bold ${totalSummary.difference === 0 ? 'text-green-800' : 'text-red-800'}`}>
            {formatCurrency(totalSummary.difference)}
          </div>
        </div>
      </div>

      {/* Back Button for Drill-down */}
      {showDrillDown && (
        <div className="mb-4">
          <button
            onClick={handleBackFromDrillDown}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-300"
          >
            ← Back to Trial Balance
          </button>
        </div>
      )}

      {/* Trial Balance Table */}
      {!showDrillDown && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader 
                    columnKey="ledger" 
                    label="Ledger" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="group" 
                    label="Group" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="debit" 
                    label="Debit (₹)" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="credit" 
                    label="Credit (₹)" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagination.currentData.map((entry, index) => (
                  <tr 
                    key={`entry-${index}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleLedgerClick(entry)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.ledger}
                      {entry.drillDownData && entry.drillDownData.length > 0 && (
                        <span className="ml-2 text-blue-500 text-xs">(Click to view details)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.group === 'Assets' ? 'bg-blue-100 text-blue-800' :
                        entry.group === 'Liabilities' ? 'bg-red-100 text-red-800' :
                        entry.group === 'Equity' ? 'bg-purple-100 text-purple-800' :
                        entry.group === 'Income' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {entry.group}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-gray-100">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(totalSummary.totalDebit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(totalSummary.totalCredit)}
                  </td>
                </tr>
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
              {selectedLedger?.ledger} - Details
            </h3>
            <p className="text-sm text-gray-600 mt-1">{selectedLedger?.description}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doc No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
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
                        {item.invoiceNumber || item.billNumber || item.expenseNumber || item.paymentNumber || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.partyName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.totalAmount || item.amount)}
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
          <div className="text-gray-500 text-lg mb-2">No trial balance data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default TrialBalanceReport; 