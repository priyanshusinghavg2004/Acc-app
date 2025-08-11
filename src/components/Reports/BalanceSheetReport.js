import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const BalanceSheetReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [balanceSheetData, setBalanceSheetData] = useState({ assets: [], liabilities: [] });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [totalSummary, setTotalSummary] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(balanceSheetData.assets, { key: 'category', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // Fetch Balance Sheet data
  useEffect(() => {
    const fetchBalanceSheetReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        // Get all sales for debtors calculation
        let salesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
          where('invoiceDate', '<=', dateRange.end),
          orderBy('invoiceDate', 'desc')
        );

        const salesSnapshot = await getDocs(salesQuery);
        const sales = salesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.invoiceDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0)
          };
        });

        // Get all purchases for creditors calculation
        let purchasesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '<=', dateRange.end),
          orderBy('billDate', 'desc')
        );

        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchases = purchasesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.billDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0)
          };
        });

        // Get all payments for cash/bank balance calculation
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

        // Get all expenses for outstanding expenses calculation
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

        // Calculate Assets
        const assets = [];

        // Cash in Hand (from payments)
        const cashInflow = payments.filter(p => p.paymentType === 'cash' && p.type === 'receipt').reduce((s, p) => s + p.amount, 0);
        const cashOutflow = payments.filter(p => p.paymentType === 'cash' && p.type === 'payment').reduce((s, p) => s + p.amount, 0);
        const cashInHand = cashInflow - cashOutflow;

        assets.push({
          category: 'Cash in Hand',
          amount: Math.max(0, cashInHand),
          type: 'current',
          drillDownData: payments.filter(p => p.paymentType === 'cash'),
          description: 'Cash balance in hand'
        });

        // Bank Balance
        const bankInflow = payments.filter(p => p.paymentType === 'bank' && p.type === 'receipt').reduce((s, p) => s + p.amount, 0);
        const bankOutflow = payments.filter(p => p.paymentType === 'bank' && p.type === 'payment').reduce((s, p) => s + p.amount, 0);
        const bankBalance = bankInflow - bankOutflow;

        assets.push({
          category: 'Bank Balance',
          amount: Math.max(0, bankBalance),
          type: 'current',
          drillDownData: payments.filter(p => p.paymentType === 'bank'),
          description: 'Bank account balance'
        });

        // Debtors (accounts receivable)
        const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const salesPayments = payments.filter(p => p.type === 'receipt' && p.documentType === 'sale').reduce((s, p) => s + p.amount, 0);
        const debtors = totalSales - salesPayments;

        assets.push({
          category: 'Debtors',
          amount: Math.max(0, debtors),
          type: 'current',
          drillDownData: sales,
          description: 'Amount receivable from customers'
        });

        // Fixed Assets (sample data)
        assets.push({
          category: 'Fixed Assets',
          amount: 200000,
          type: 'fixed',
          drillDownData: [],
          description: 'Property, plant, and equipment'
        });

        // Calculate Liabilities
        const liabilities = [];

        // Capital Account (sample - you can make this configurable)
        liabilities.push({
          category: 'Capital Account',
          amount: 400000,
          type: 'equity',
          drillDownData: [],
          description: 'Owner\'s capital investment'
        });

        // Creditors (accounts payable)
        const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
        const purchasePayments = payments.filter(p => p.type === 'payment' && p.documentType === 'purchase').reduce((s, p) => s + p.amount, 0);
        const creditors = totalPurchases - purchasePayments;

        liabilities.push({
          category: 'Creditors',
          amount: Math.max(0, creditors),
          type: 'current',
          drillDownData: purchases,
          description: 'Amount payable to suppliers'
        });

        // Loans (sample data)
        liabilities.push({
          category: 'Loans',
          amount: 100000,
          type: 'long-term',
          drillDownData: [],
          description: 'Long-term borrowings'
        });

        // Outstanding Expenses
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const expensePayments = payments
          .filter(p => p.type === 'payment' && p.documentType === 'expense')
          .reduce((sum, p) => sum + p.amount, 0);
        const outstandingExpenses = totalExpenses - expensePayments;

        liabilities.push({
          category: 'Outstanding Expenses',
          amount: Math.max(0, outstandingExpenses),
          type: 'current',
          drillDownData: expenses,
          description: 'Unpaid expenses'
        });

        setBalanceSheetData({ assets, liabilities });

        // Calculate totals
        const totalAssets = assets.reduce((sum, asset) => sum + asset.amount, 0);
        const totalLiabilities = liabilities.reduce((sum, liability) => sum + liability.amount, 0);
        const netWorth = totalAssets - totalLiabilities;

        setTotalSummary({
          totalAssets,
          totalLiabilities,
          netWorth
        });

      } catch (error) {
        console.error('Error fetching balance sheet data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalanceSheetReport();
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

  // Handle category click for drill-down
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setDrillDownData(category.drillDownData || []);
    setShowDrillDown(true);
  };

  // Handle back from drill-down
  const handleBackFromDrillDown = () => {
    setShowDrillDown(false);
    setSelectedCategory(null);
    setDrillDownData([]);
  };

  // Handle drill-down row click
  const handleDrillDownRowClick = (item) => {
    console.log('Open document:', item.id, item.invoiceNumber || item.billNumber || item.expenseNumber);
    // You can implement navigation logic here
  };

  // Sample data for testing
  const sampleAssets = [
    {
      category: 'Cash in Hand',
      amount: 50000,
      type: 'current',
      drillDownData: [],
      description: 'Cash balance in hand'
    },
    {
      category: 'Bank Balance',
      amount: 100000,
      type: 'current',
      drillDownData: [],
      description: 'Bank account balance'
    },
    {
      category: 'Debtors',
      amount: 200000,
      type: 'current',
      drillDownData: [],
      description: 'Amount receivable from customers'
    },
    {
      category: 'Fixed Assets',
      amount: 200000,
      type: 'fixed',
      drillDownData: [],
      description: 'Property, plant, and equipment'
    }
  ];

  const sampleLiabilities = [
    {
      category: 'Capital Account',
      amount: 400000,
      type: 'equity',
      drillDownData: [],
      description: 'Owner\'s capital investment'
    },
    {
      category: 'Creditors',
      amount: 120000,
      type: 'current',
      drillDownData: [],
      description: 'Amount payable to suppliers'
    },
    {
      category: 'Loans',
      amount: 100000,
      type: 'long-term',
      drillDownData: [],
      description: 'Long-term borrowings'
    },
    {
      category: 'Outstanding Expenses',
      amount: 30000,
      type: 'current',
      drillDownData: [],
      description: 'Unpaid expenses'
    }
  ];

  // Use sample data if no real data
  const displayAssets = balanceSheetData.assets.length > 0 ? balanceSheetData.assets : sampleAssets;
  const displayLiabilities = balanceSheetData.liabilities.length > 0 ? balanceSheetData.liabilities : sampleLiabilities;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Balance Sheet Report</h2>
        <p className="text-gray-600">
          As on: {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Assets</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalAssets)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Total Liabilities</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totalSummary.totalLiabilities)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Net Worth</div>
          <div className="text-2xl font-bold text-blue-800">{formatCurrency(totalSummary.netWorth)}</div>
        </div>
      </div>

      {/* Back Button for Drill-down */}
      {showDrillDown && (
        <div className="mb-4">
          <button
            onClick={handleBackFromDrillDown}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-300"
          >
            ← Back to Balance Sheet
          </button>
        </div>
      )}

      {/* Balance Sheet Table */}
      {!showDrillDown && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-green-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-green-800">ASSETS</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assets
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayAssets.map((asset, index) => (
                    <tr 
                      key={`asset-${index}`}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleCategoryClick(asset)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.category}
                        {asset.drillDownData && asset.drillDownData.length > 0 && (
                          <span className="ml-2 text-blue-500 text-xs">(Click to view details)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(asset.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-green-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-800">
                      Total Assets
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-800 text-right">
                      {formatCurrency(totalSummary.totalAssets)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Liabilities */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-red-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-red-800">LIABILITIES</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Liabilities
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayLiabilities.map((liability, index) => (
                    <tr 
                      key={`liability-${index}`}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleCategoryClick(liability)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {liability.category}
                        {liability.drillDownData && liability.drillDownData.length > 0 && (
                          <span className="ml-2 text-blue-500 text-xs">(Click to view details)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(liability.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-red-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-800">
                      Total Liabilities
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-800 text-right">
                      {formatCurrency(totalSummary.totalLiabilities)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Table */}
      {showDrillDown && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              {selectedCategory?.category} - Details
            </h3>
            <p className="text-sm text-gray-600 mt-1">{selectedCategory?.description}</p>
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
      {displayAssets.length === 0 && displayLiabilities.length === 0 && !loading && !showDrillDown && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No balance sheet data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default BalanceSheetReport; 