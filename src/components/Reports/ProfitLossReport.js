import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import GlobalExportButtons from '../GlobalExportButtons';

const ProfitLossReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading, companyDetails }) => {
  const [plData, setPlData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [totalSummary, setTotalSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    grossProfit: 0,
    taxPayable: 0,
    paymentsIn: 0,
    paymentsOut: 0
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
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];

        // Get all sales in date range
        const salesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
          where('invoiceDate', '>=', startStr),
          where('invoiceDate', '<=', endStr),
          orderBy('invoiceDate', 'desc')
        );

        const salesSnapshot = await getDocs(salesQuery);
        // resolve helpers
        const resolvePartyId = (docData) => {
          const raw = docData.customFields?.party || docData.party || docData.partyId;
          if (raw && parties?.some(p => p.id === raw)) return raw;
          const byName = docData.partyName || docData.firmName || '';
          const match = (parties || []).find(p => (p.firmName || p.partyName) === byName);
          return match?.id || raw || '';
        };
        const resolvePartyName = (pid, docData) => {
          const p = (parties || []).find(pp => pp.id === pid);
          return docData.partyName || p?.firmName || p?.partyName || p?.name || pid || '';
        };

        let sales = salesSnapshot.docs.map(doc => {
          const d = doc.data();
          const pid = resolvePartyId(d);
          return {
            id: doc.id,
            date: d.invoiceDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            partyId: pid,
            invoiceNumber: d.invoiceNumber || d.number || doc.id,
            partyName: resolvePartyName(pid, d)
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          sales = sales.filter(sale => sale.partyId === selectedParty);
        }

        // Get all purchases in date range
        const purchasesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '>=', startStr),
          where('billDate', '<=', endStr),
          orderBy('billDate', 'desc')
        );

        const purchasesSnapshot = await getDocs(purchasesQuery);
        let purchases = purchasesSnapshot.docs.map(doc => {
          const d = doc.data();
          const pid = resolvePartyId(d);
          return {
            id: doc.id,
            date: d.billDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            partyId: pid,
            billNumber: d.billNumber || d.number || doc.id,
            partyName: resolvePartyName(pid, d)
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          purchases = purchases.filter(purchase => purchase.partyId === selectedParty);
        }

        // Fetch items for GST meta (to exactly match Taxes GSTR-3B)
        const itemsSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/items`));
        const itemMeta = {};
        itemsSnap.forEach(d => {
          const it = d.data() || {};
          itemMeta[d.id] = {
            gstPercentage: parseFloat(it.gstPercentage) || 0,
            compositionGstRate: parseFloat(it.compositionGstRate) || 0,
            itemType: it.itemType || 'Goods'
          };
        });

        // Get all expenses in date range
        const expensesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/expenses`),
          where('date', '>=', startStr),
          where('date', '<=', endStr),
          orderBy('date', 'desc')
        );

        const expensesSnapshot = await getDocs(expensesQuery);
        let expenses = expensesSnapshot.docs.map(doc => {
          const d = doc.data();
          const pid = d.partyId || d.party || d.customFields?.party || '';
          const p = (parties || []).find(pp => pp.id === pid);
          const docName = d.expenseNumber || d.voucherNumber || d.voucherNo || d.referenceNo || d.number || d.head || d.category || d.description || doc.id;
          return {
            id: doc.id,
            date: d.date,
            amount: parseFloat(d.amount || 0),
            partyId: pid,
            expenseNumber: docName,
            partyName: d.partyName || p?.firmName || p?.partyName || p?.name || '',
            head: d.head || d.category || d.expenseHead || (d.group === 'salaries' ? 'Salaries' : 'Operating Expenses'),
            group: d.group || ''
          };
        });

        // Salary payments collection
        const salarySnap = await getDocs(query(
          collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`),
          where('date', '>=', startStr), where('date', '<=', endStr), orderBy('date', 'asc')
        ));
        const salaryPaymentsRows = salarySnap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.date,
            amount: parseFloat(d.netAmount || d.totalEarnings || d.total || 0),
            partyId: d.employeeId || '',
            partyName: d.employeeName || 'Employee',
            head: 'Salaries',
            expenseNumber: d.month ? `${d.month}` : doc.id
          };
        });

        // Irregular labour/freelancer payments (Advances/Bonus/Incentive)
        const irregularSnap = await getDocs(query(
          collection(db, `artifacts/${appId}/users/${userId}/irregularPayments`),
          where('date', '>=', startStr), where('date', '<=', endStr), orderBy('date', 'asc')
        ));
        const irregularRows = irregularSnap.docs.map(doc => {
          const d = doc.data();
          const partyName = d.personType === 'Employee' ? (d.employeeName || 'Employee') : (d.personName || d.personType || 'Labour/Freelancer');
          return {
            id: doc.id,
            date: d.date,
            amount: parseFloat(d.amount || 0),
            partyId: d.employeeId || '',
            partyName,
            head: 'Labour/Advances',
            expenseNumber: d.paymentType || 'Irregular Payment'
          };
        });

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          expenses = expenses.filter(expense => expense.partyId === selectedParty);
        }

        // Fetch payments in the period (for info cards)
        const paymentsQueryRef = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          where('paymentDate', '>=', startStr),
          where('paymentDate', '<=', endStr),
          orderBy('paymentDate', 'asc')
        );
        const paymentsSnapshot = await getDocs(paymentsQueryRef);
        const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calculate P&L categories
        const plCategories = [];

        // Income categories (gross invoice values)
        const totalSales = sales.reduce((sum, sale) => sum + (parseFloat(sale.totalAmount) || 0), 0);
        plCategories.push({
          category: 'Sales',
          amount: totalSales,
          type: 'income',
          drillDownData: sales,
          description: 'Revenue from sales of goods/services'
        });

        // Cost of goods purchase (gross purchase bill values)
        const totalPurchases = purchases.reduce((sum, purchase) => sum + (parseFloat(purchase.totalAmount) || 0), 0);
        plCategories.push({
          category: 'Cost of Goods Purchase',
          amount: totalPurchases,
          type: 'expense',
          drillDownData: purchases,
          description: 'Direct costs of goods purchased'
        });

        // Operating expenses grouped by head/category; include salary payments and irregular payments
        const allExpenseEntries = [
          ...expenses,
          ...salaryPaymentsRows,
          ...irregularRows
        ];
        const expensesByHead = allExpenseEntries.reduce((acc, e) => {
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

        // Instead of recalculating, trace the exact GSTR-3B summary from Taxes (saved in localStorage)
        const gstMode = (companyDetails?.gstinType || companyDetails?.gstType || 'regular').toLowerCase();
        const cacheKey = `gstr3b:${appId}:${userId}:${startStr}:${endStr}:${gstMode}`;
        let traced = null;
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) traced = JSON.parse(raw);
        } catch {}

        let outward = { taxable: 0, cgst: 0, sgst: 0, igst: 0, compTax: 0 };
        let inward = { taxable: 0, cgst: 0, sgst: 0, igst: 0, compTax: 0 };
        if (traced && traced.summary) {
          outward = traced.summary.outward || outward;
          inward = traced.summary.inward || inward;
        }

        let taxPayable = 0;
        if (gstMode === 'regular') {
          const cg = outward.cgst - inward.cgst;
          const sg = outward.sgst - inward.sgst;
          const ig = outward.igst - inward.igst;
          taxPayable = Math.max(0, cg) + Math.max(0, sg) + Math.max(0, ig);
        } else {
          // Composition: payable equals outward composition tax; no ITC
          taxPayable = outward.compTax;
        }

        // Taxes category with drill-down
        const taxesDrillDown = [];
        if (gstMode === 'regular') {
          taxesDrillDown.push(
            { date: null, invoiceNumber: 'Outward GST (CGST+SGST+IGST)', partyName: '', amount: (outward.cgst + outward.sgst + outward.igst) },
            { date: null, invoiceNumber: 'Less: Inward ITC', partyName: '', amount: (inward.cgst + inward.sgst + inward.igst) },
            { date: null, invoiceNumber: 'Net GST Payable', partyName: '', amount: taxPayable }
          );
        } else {
          taxesDrillDown.push(
            { date: null, invoiceNumber: 'Outward Composition Tax', partyName: '', amount: outward.compTax },
            { date: null, invoiceNumber: 'Net Composition Payable', partyName: '', amount: taxPayable }
          );
        }

        plCategories.push({
          category: 'Taxes (GST Payable)',
          amount: taxPayable,
          type: 'expense',
          drillDownData: taxesDrillDown,
          description: gstMode === 'regular' ? 'GST payable = Outward tax − Inward ITC' : 'Composition tax on turnover (no ITC)'
        });

        // Payments info (does not affect P&L totals, informational)
        const paymentsIn = payments.filter(p => (p.type || '').toLowerCase() === 'receipt').reduce((s, p) => s + (parseFloat(p.amount || p.totalAmount || 0)), 0);
        const paymentsOut = payments.filter(p => (p.type || '').toLowerCase() === 'payment').reduce((s, p) => s + (parseFloat(p.amount || p.totalAmount || 0)), 0);

        setPlData(plCategories);

        // Calculate totals
        const income = plCategories.filter(cat => cat.type === 'income').reduce((sum, cat) => sum + cat.amount, 0);
        const totalExpenses = plCategories.filter(cat => cat.type === 'expense').reduce((sum, cat) => sum + cat.amount, 0);
        const grossProfit = income - totalPurchases;
        // Net Profit should already include Taxes category within totalExpenses.
        // Do NOT subtract taxPayable again, otherwise taxes are double-counted.
        const netProfit = income - totalExpenses;

        setTotalSummary({
          totalIncome: income,
          totalExpenses: totalExpenses,
          grossProfit: grossProfit,
          netProfit: netProfit,
          taxPayable,
          paymentsIn,
          paymentsOut
        });

        // Persist lightweight P&L summary for other modules (e.g., Balance Sheet)
        try {
          const cacheKeyPl = `pl:${appId}:${userId}:${startStr}:${endStr}`;
          localStorage.setItem(cacheKeyPl, JSON.stringify({
            totals: { income, purchases: totalPurchases, expenses: totalExpenses, taxPayable, netProfit },
            period: { start: startStr, end: endStr },
            savedAt: Date.now()
          }));
          try { window.dispatchEvent(new CustomEvent('pl-updated', { detail: { key: cacheKeyPl } })); } catch {}
        } catch {}

      } catch (error) {
        console.error('Error fetching P&L report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPLReport();
    // Listen for GSTR-3B updates and refetch totals automatically
    const onGstr3bUpdated = () => fetchPLReport();
    window.addEventListener('gstr3b-updated', onGstr3bUpdated);
    return () => window.removeEventListener('gstr3b-updated', onGstr3bUpdated);
  }, [db, userId, appId, dateRange, selectedParty, companyDetails]);

  // Prepare export data for GlobalExportButtons
  const getExportData = () => {
    const completeTableData = [
      // Income Section Header
      { category: 'INCOME', amount: '-' },
      // Income items
      ...displayData.filter(item => item.type === 'income').map(item => ({
        category: `  ${item.category}`,
        amount: item.amount
      })),
      // Total Income
      { category: 'Total Income', amount: totalSummary.totalIncome },
      // Empty row
      { category: '', amount: '' },
      // Expenses Section Header
      { category: 'EXPENSES', amount: '-' },
      // Expense items
      ...displayData.filter(item => item.type === 'expense').map(item => ({
        category: `  ${item.category}`,
        amount: item.amount
      })),
      // Total Expenses
      { category: 'Total Expenses', amount: totalSummary.totalExpenses },
      // Empty row
      { category: '', amount: '' },
      // Net Profit
      { category: 'Net Profit', amount: totalSummary.netProfit }
    ];
    return completeTableData;
  };

  const getExportColumns = () => [
    { key: 'category', label: 'Particulars' },
    { key: 'amount', label: 'Amount (INR)' }
  ];

  const getReportDetails = () => ({
    'Period': `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
    'Total Income': totalSummary.totalIncome,
    'Total Expenses': totalSummary.totalExpenses,
    'Gross Profit': totalSummary.grossProfit,
    'Net Profit': totalSummary.netProfit,
    dateRange
  });

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

  // ESC to close drill-down (LIFO if extended later)
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape' && showDrillDown) {
        handleBackFromDrillDown();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showDrillDown]);

  // Handle drill-down row click
  const handleDrillDownRowClick = (item) => {
    console.log('Open document:', item.id, item.invoiceNumber || item.billNumber || item.expenseNumber);
    // You can implement navigation logic here
  };

  const displayData = plData;



  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Profit & Loss Report</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Profit & Loss Report</h2>
            <p className="text-gray-600">
              Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
              {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
            </p>
          </div>
          
                     {/* Global Export/Print/Share Buttons */}
           <GlobalExportButtons
             data={getExportData()}
             columns={getExportColumns()}
             filename="PROFIT_LOSS"
             title="Profit & Loss Report"
             companyDetails={companyDetails}
             reportDetails={getReportDetails()}
             disabled={displayData.length === 0}
           />
        </div>
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
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Tax Payable (GST)</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totalSummary.taxPayable)}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 font-medium">Payments In / Out</div>
          <div className="text-lg font-bold text-gray-800">{formatCurrency(totalSummary.paymentsIn)} / {formatCurrency(totalSummary.paymentsOut)}</div>
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
            <table id="report-table" className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Particulars
                  </th>
                                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Amount (INR)
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
                      {item.date ? formatDate(item.date) : '-'}
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