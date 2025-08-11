import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const ProfitLossReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [plData, setPlData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [totalSummary, setTotalSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    grossProfit: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(plData, { key: 'category', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // Fetch Profit & Loss data
  useEffect(() => {
    const fetchPLReport = async () => {
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
            invoiceNumber: d.invoiceNumber || d.number || doc.id,
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
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            partyId: d.customFields?.party || d.party || d.partyId,
            billNumber: d.billNumber || d.number || doc.id,
            partyName: d.partyName || ''
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          purchases = purchases.filter(purchase => purchase.partyId === selectedParty);
        }

        // Get all expenses in date range
        const expensesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/expenses`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );

        const expensesSnapshot = await getDocs(expensesQuery);
        let expenses = expensesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.date,
            amount: parseFloat(d.amount || 0),
            partyId: d.partyId || d.party,
            expenseNumber: d.expenseNumber || d.number || doc.id,
            partyName: d.partyName || '',
            head: d.head || d.category || d.expenseHead || 'Operating Expenses',
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          expenses = expenses.filter(expense => expense.partyId === selectedParty);
        }

        // Calculate P&L categories
        const plCategories = [];

        // Income categories
        const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        plCategories.push({
          category: 'Sales',
          amount: totalSales,
          type: 'income',
          drillDownData: sales,
          description: 'Revenue from sales of goods/services'
        });

        // Cost of goods sold
        const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
        plCategories.push({
          category: 'Cost of Goods Sold',
          amount: totalPurchases,
          type: 'expense',
          drillDownData: purchases,
          description: 'Direct costs of goods sold'
        });

        // Operating expenses grouped by head/category
        const expensesByHead = expenses.reduce((acc, e) => {
          const key = e.head || 'Operating Expenses';
          if (!acc[key]) acc[key] = { amount: 0, items: [] };
          acc[key].amount += e.amount;
          acc[key].items.push(e);
          return acc;
        }, {});
        Object.entries(expensesByHead).forEach(([head, val]) => {
          plCategories.push({
            category: head,
            amount: val.amount,
            type: 'expense',
            drillDownData: val.items,
            description: head
          });
        });

        setPlData(plCategories);

        // Calculate totals
        const income = plCategories.filter(cat => cat.type === 'income').reduce((sum, cat) => sum + cat.amount, 0);
        const totalExpenses = plCategories.filter(cat => cat.type === 'expense').reduce((sum, cat) => sum + cat.amount, 0);
        const grossProfit = income - totalPurchases;
        const netProfit = income - totalExpenses;

        setTotalSummary({
          totalIncome: income,
          totalExpenses: totalExpenses,
          grossProfit: grossProfit,
          netProfit: netProfit
        });

      } catch (error) {
        console.error('Error fetching P&L report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPLReport();
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
  const sampleData = [
    {
      category: 'Sales',
      amount: 500000,
      type: 'income',
      drillDownData: [],
      description: 'Revenue from sales of goods/services'
    },
    {
      category: 'Other Income',
      amount: 20000,
      type: 'income',
      drillDownData: [],
      description: 'Other income sources'
    },
    {
      category: 'Cost of Goods Sold',
      amount: 300000,
      type: 'expense',
      drillDownData: [],
      description: 'Direct costs of goods sold'
    },
    {
      category: 'Salaries',
      amount: 50000,
      type: 'expense',
      drillDownData: [],
      description: 'Employee salaries and wages'
    },
    {
      category: 'Rent',
      amount: 20000,
      type: 'expense',
      drillDownData: [],
      description: 'Office and warehouse rent'
    },
    {
      category: 'Utilities',
      amount: 15000,
      type: 'expense',
      drillDownData: [],
      description: 'Electricity, water, internet, etc.'
    }
  ];

  // Use sample data if no real data
  const displayData = plData.length > 0 ? plData : sampleData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Profit & Loss Report</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Income</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalIncome)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Total Expenses</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totalSummary.totalExpenses)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Gross Profit</div>
          <div className="text-2xl font-bold text-blue-800">{formatCurrency(totalSummary.grossProfit)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Net Profit</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(totalSummary.netProfit)}</div>
        </div>
      </div>

      {/* Back Button for Drill-down */}
      {showDrillDown && (
        <div className="mb-4">
          <button
            onClick={handleBackFromDrillDown}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-300"
          >
            ← Back to P&L Summary
          </button>
        </div>
      )}

      {/* P&L Summary Table */}
      {!showDrillDown && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Particulars
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Income Section */}
                <tr className="bg-green-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-800">
                    INCOME
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-800 text-right">
                    -
                  </td>
                </tr>
                {displayData.filter(item => item.type === 'income').map((item, index) => (
                  <tr 
                    key={`income-${index}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleCategoryClick(item)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 pl-8">
                      {item.category}
                      {item.drillDownData && item.drillDownData.length > 0 && (
                        <span className="ml-2 text-blue-500 text-xs">(Click to view details)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-100">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-800">
                    Total Income
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-800 text-right">
                    {formatCurrency(totalSummary.totalIncome)}
                  </td>
                </tr>

                {/* Expenses Section */}
                <tr className="bg-red-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-800">
                    EXPENSES
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-800 text-right">
                    -
                  </td>
                </tr>
                {displayData.filter(item => item.type === 'expense').map((item, index) => (
                  <tr 
                    key={`expense-${index}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleCategoryClick(item)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 pl-8">
                      {item.category}
                      {item.drillDownData && item.drillDownData.length > 0 && (
                        <span className="ml-2 text-blue-500 text-xs">(Click to view details)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-red-100">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-800">
                    Total Expenses
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-800 text-right">
                    {formatCurrency(totalSummary.totalExpenses)}
                  </td>
                </tr>

                {/* Net Profit */}
                <tr className="bg-purple-100">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-800">
                    Net Profit
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-800 text-right">
                    {formatCurrency(totalSummary.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
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
                        {item.invoiceNumber || item.billNumber || item.expenseNumber || 'N/A'}
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
          <div className="text-gray-500 text-lg mb-2">No P&L data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default ProfitLossReport; 