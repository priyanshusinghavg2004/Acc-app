import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import GlobalExportButtons from '../GlobalExportButtons';

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

  // Fetch Balance Sheet data (Lite): Cash, Bank, Debtors, Creditors, GST Payable, Capital, Current Profit
  useEffect(() => {
    const fetchBalanceSheetReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];
        // Get sales (JS filter by date range)
        const salesSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/salesBills`));
        const sales = salesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.invoiceDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            number: d.number || d.invoiceNumber,
            partyName: d.partyName || ''
          };
        }).filter(s => {
          const dt = new Date(s.date);
          return (!dateRange?.start || dt >= new Date(dateRange.start)) && (!dateRange?.end || dt <= new Date(dateRange.end));
        });

        // Get purchases (JS filter by date range)
        const purchasesSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`));
        const purchases = purchasesSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.billDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            billNumber: d.billNumber || d.number,
            partyName: d.partyName || ''
          };
        }).filter(p => {
          const dt = new Date(p.date);
          return (!dateRange?.start || dt >= new Date(dateRange.start)) && (!dateRange?.end || dt <= new Date(dateRange.end));
        });

        // Get all payments for cash/bank balance calculation
        const paymentsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/payments`));
        const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => {
          const dt = new Date(p.paymentDate || p.date);
          return (!dateRange?.start || dt >= new Date(dateRange.start)) && (!dateRange?.end || dt <= new Date(dateRange.end));
        });

        // Get all expenses for outstanding expenses calculation
        const expensesSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/expenses`));
        const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(e => {
          const dt = new Date(e.date);
          return (!dateRange?.start || dt >= new Date(dateRange.start)) && (!dateRange?.end || dt <= new Date(dateRange.end));
        });

        // Salaries (from salaryPayments)
        const salariesSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`));
        const salaryRows = salariesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => {
          const dt = new Date(s.date || s.paymentDate);
          return (!dateRange?.start || dt >= new Date(dateRange.start)) && (!dateRange?.end || dt <= new Date(dateRange.end));
        });

        // Irregular labour/freelancer payments
        const irregularSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/irregularPayments`));
        const irregularRows = irregularSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(r => {
          const dt = new Date(r.date);
          return (!dateRange?.start || dt >= new Date(dateRange.start)) && (!dateRange?.end || dt <= new Date(dateRange.end));
        });

        // Calculate Assets
        const assets = [];

        // Build Payment Mode-style mapping from raw payments
        const isCashMode = (mode) => String(mode || '').toLowerCase().includes('cash');
        const recNoUpper = (r) => (r.receiptNumber || r.number || '').toString().toUpperCase();
        const isSalesReceipt = (r) => recNoUpper(r).startsWith('PRI') || (String(r.type||'').toLowerCase()==='receipt' && ((r.documentType||'').toString().toLowerCase()==='sale'));
        const normalizedPayments = payments.map(p => ({ id:p.id, date:p.paymentDate || p.date, amount:Number(p.totalAmount || p.amount || 0), mode:p.paymentMode || '', partyName:p.partyName || p.partyFirmName || '', receiptNumber:p.receiptNumber || p.number || '', type:p.type, documentType:p.documentType }));
        const salesReceipts = normalizedPayments.filter(isSalesReceipt);
        const cashSales = salesReceipts.filter(r => isCashMode(r.mode));
        const bankSales = salesReceipts.filter(r => !isCashMode(r.mode));
        const cashInHand = cashSales.reduce((s,r)=>s+(r.amount||0),0);
        const cashInBank = bankSales.reduce((s,r)=>s+(r.amount||0),0);

        assets.push({
          category: 'Cash in Hand',
          amount: Math.max(0, cashInHand),
          type: 'current',
          drillDownData: cashSales.map(r => ({ id:r.id, date:r.date, amount:r.amount, partyName:r.partyName, paymentNumber:r.receiptNumber })),
          description: 'Total cash receipts from sales'
        });

        // Bank Balance
        assets.push({
          category: 'Cash in Bank',
          amount: Math.max(0, cashInBank),
          type: 'current',
          drillDownData: bankSales.map(r => ({ id:r.id, date:r.date, amount:r.amount, partyName:r.partyName, paymentNumber:r.receiptNumber })),
          description: 'Total bank/UPI/cheque receipts from sales'
        });

        // Debtors (accounts receivable)
        const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const salesPayments = salesReceipts.reduce((s, p) => s + (p.amount||0), 0);
        const debtors = totalSales - salesPayments;

        assets.push({
          category: 'Debtors',
          amount: Math.max(0, debtors),
          type: 'current',
          drillDownData: sales.map(s => ({ id:s.id, date:s.date, amount:s.totalAmount, invoiceNumber:s.number || s.invoiceNumber, partyName:s.partyName })),
          description: 'Amount receivable from customers'
        });

        // No fixed assets in Lite

        // Calculate Liabilities
        const liabilities = [];

        // Capital Account from simple opening (optional)
        const openingBalancesDoc = { openingCapital: 0, openingCash: 0, openingBank: 0 };
        liabilities.push({
          category: 'Capital (Opening)',
          amount: openingBalancesDoc.openingCapital || 0,
          type: 'equity',
          drillDownData: [],
          description: 'Opening capital (settings)'
        });

        // Creditors (accounts payable)
        const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
        const purchasePaymentRows = payments
          .filter(p => (p.receiptNumber || '').toString().toUpperCase().startsWith('PRP') || ((p.type||'').toString().toLowerCase()==='payment' && ((p.documentType||'').toString().toLowerCase()==='purchase')) )
          .map(p => ({ id:p.id, date:p.paymentDate || p.date, amount:Number(p.totalAmount || p.amount || 0), receiptNumber:p.receiptNumber || p.number || '', partyName:p.partyName || p.partyFirmName || '' }));
        const purchasePayments = purchasePaymentRows.reduce((s, p) => s + Number(p.amount || 0), 0);
        const creditors = totalPurchases - purchasePayments;

        liabilities.push({
          category: 'Creditors',
          amount: Math.max(0, creditors),
          type: 'current',
          drillDownData: purchases,
          description: 'Amount payable to suppliers'
        });

        // Payments made against purchase bills (allocation summary)
        if (purchasePayments > 0) {
          liabilities.push({
            category: 'Payments Made (Purchase)',
            amount: purchasePayments,
            type: 'current',
            drillDownData: purchasePaymentRows,
            description: 'Payment receipts allocated to purchase bills'
          });
        }

        // No loans in Lite

        // Outstanding Expenses
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const expensePayments = payments
          .filter(p => p.type === 'payment' && p.documentType === 'expense')
          .reduce((sum, p) => sum + p.amount, 0);
        const outstandingExpenses = totalExpenses - expensePayments;

        // Expenses (excluding salaries)
        const expTotal = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
        if (expTotal > 0) {
          liabilities.push({
            category: 'Expenses',
            amount: expTotal,
            type: 'current',
            drillDownData: expenses.map(e => ({ id:e.id, date:e.date, amount:Number(e.amount||0), receiptNumber:e.head || e.description || '', partyName:e.head || '' })),
            description: 'Expenses excluding salaries'
          });
        }

        // Salaries
        const salTotal = salaryRows.reduce((s,e)=>s+Number(e.netAmount || e.total || 0),0);
        if (salTotal > 0) {
          liabilities.push({
            category: 'Salaries',
            amount: salTotal,
            type: 'current',
            drillDownData: salaryRows.map(s => ({ id:s.id, date:s.date || s.paymentDate, amount:Number(s.netAmount || s.total || 0), receiptNumber:s.employeeName || 'Salary', partyName:s.employeeName || '' })),
            description: 'Salary payments'
          });
        }

        // Labour/Advances (Irregular payments)
        const irrTotal = irregularRows.reduce((s,e)=>s+Number(e.amount || 0),0);
        if (irrTotal > 0) {
          liabilities.push({
            category: 'Labour/Advances',
            amount: irrTotal,
            type: 'current',
            drillDownData: irregularRows.map(r => ({ id:r.id, date:r.date, amount:Number(r.amount||0), receiptNumber:r.paymentType || 'Irregular', partyName: r.personType==='Employee' ? (r.employeeName||'Employee') : (r.personName||r.personType||'') })),
            description: 'Irregular labour/freelancer payments (advance, bonus, incentive)'
          });
        }

        // GST Payable traced from Taxes GSTR-3B cache
        const gstType = 'regular';
        const cacheKey = `gstr3b:${appId}:${userId}:${startStr}:${endStr}:${gstType}`;
        let gstrCache = null;
        try { const raw = localStorage.getItem(cacheKey); if (raw) gstrCache = JSON.parse(raw); } catch {}
        let gstPayable = 0;
        if (gstrCache?.summary) {
          const out = gstrCache.summary.outward || { cgst:0, sgst:0, igst:0 };
          const inn = gstrCache.summary.inward || { cgst:0, sgst:0, igst:0 };
          gstPayable = Math.max(0, (out.cgst - inn.cgst)) + Math.max(0, (out.sgst - inn.sgst)) + Math.max(0, (out.igst - inn.igst));
        }
        if (gstPayable > 0) {
          liabilities.push({
            category: 'GST Payable',
            amount: gstPayable,
            type: 'current',
            drillDownData: [],
            description: 'Net GST payable (from Taxes)'
          });
        }

        // Pull Net Profit from P&L cache for equity side
        let netProfit = 0;
        try {
          const plKey = `pl:${appId}:${userId}:${startStr}:${endStr}`;
          const plRaw = localStorage.getItem(plKey);
          if (plRaw) {
            const plObj = JSON.parse(plRaw);
            netProfit = plObj?.totals?.netProfit || 0;
          }
        } catch {}

        if (netProfit !== 0) {
          liabilities.push({
            category: netProfit >= 0 ? 'Current Profit' : 'Current Loss',
            amount: Math.abs(netProfit),
            type: 'equity',
            drillDownData: [],
            description: 'From Profit & Loss'
          });
        }

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
    const onGstrUpdate = () => fetchBalanceSheetReport();
    const onPlUpdate = () => fetchBalanceSheetReport();
    window.addEventListener('gstr3b-updated', onGstrUpdate);
    window.addEventListener('pl-updated', onPlUpdate);
    return () => { window.removeEventListener('gstr3b-updated', onGstrUpdate); window.removeEventListener('pl-updated', onPlUpdate); };
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

    // Prepare export data for GlobalExportButtons
  const getExportData = () => {
    // Combine assets and liabilities for export
    return [
      ...displayAssets.map(asset => ({ category: `ASSET: ${asset.category}`, amount: asset.amount })),
      ...displayLiabilities.map(liability => ({ category: `LIABILITY: ${liability.category}`, amount: liability.amount }))
    ];
  };

  const getExportColumns = () => [
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount (INR)' }
  ];

  const getReportDetails = () => ({
    'As on': formatDate(dateRange.end),
    'Total Assets': totalSummary.totalAssets,
    'Total Liabilities': totalSummary.totalLiabilities,
    'Net Worth': totalSummary.netWorth,
    dateRange
  });

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Balance Sheet Report</h2>
            <p className="text-gray-600">
              As on: {formatDate(dateRange.end)}
              {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
            </p>
          </div>
          
          {/* Global Export/Print/Share Buttons */}
          <GlobalExportButtons
            data={getExportData()}
            columns={getExportColumns()}
            filename="BALANCE_SHEET"
            title="Balance Sheet Report"
            companyDetails={null}
            reportDetails={getReportDetails()}
            disabled={displayAssets.length === 0 && displayLiabilities.length === 0}
          />
        </div>
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