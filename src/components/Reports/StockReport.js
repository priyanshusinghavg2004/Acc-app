import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { formatCurrency } from './CommonComponents';

const StockReport = ({ db, userId, appId, dateRange, setLoading }) => {
  const [stockData, setStockData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalItems: 0,
    totalValue: 0,
    negativeStock: 0,
    lowStock: 0
  });
  const [showQuickSummary, setShowQuickSummary] = useState(false);
  const [quickSummaryItem, setQuickSummaryItem] = useState(null);

  // ESC key handler for closing modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showQuickSummary) {
          console.log('ESC: Closing Quick Summary modal');
          setShowQuickSummary(false);
          setQuickSummaryItem(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showQuickSummary]);

  // Handle item click for quick summary
  const handleItemClick = (item) => {
    setQuickSummaryItem(item);
    setShowQuickSummary(true);
  };

  useEffect(() => {
    if (!db || !userId) return;
    setLoading(true);

    // Compute quantity from a row (supports nos x length x height pattern)
    const computeRowQty = (row) => {
      const direct = parseFloat(row?.qty);
      if (!Number.isNaN(direct) && direct) return direct;
      return (parseFloat(row?.nos) || 0) * (parseFloat(row?.length) || 1) * (parseFloat(row?.height) || 1);
    };

    const fetchData = async () => {
      try {
        const basePath = `artifacts/${appId}/users/${userId}`;
        // Date strings for filtering
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];

        // Fetch items
        const itemsQueryRef = query(collection(db, `${basePath}/items`), orderBy('itemName', 'asc'));
        const itemsSnapshot = await getDocs(itemsQueryRef);
        const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch purchases in date range (by billDate string)
        const purchasesQueryRef = query(
          collection(db, `${basePath}/purchaseBills`),
          where('billDate', '>=', startStr),
          where('billDate', '<=', endStr),
          orderBy('billDate', 'asc')
        );
        const purchasesSnapshot = await getDocs(purchasesQueryRef);
        const purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch sales in date range (by invoiceDate string)
        const salesQueryRef = query(
          collection(db, `${basePath}/salesBills`),
          where('invoiceDate', '>=', startStr),
          where('invoiceDate', '<=', endStr),
          orderBy('invoiceDate', 'asc')
        );
        const salesSnapshot = await getDocs(salesQueryRef);
        const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calculate stock movement for each item
        const stockReport = items.map(item => {
          const purchasedQty = purchases.reduce((total, purchase) => {
            const rows = Array.isArray(purchase.rows) ? purchase.rows : (Array.isArray(purchase.items) ? purchase.items : []);
            const sum = rows.reduce((s, r) => s + (r.item === item.id ? computeRowQty(r) : 0), 0);
            return total + sum;
          }, 0);

          const soldQty = sales.reduce((total, sale) => {
            const rows = Array.isArray(sale.rows) ? sale.rows : (Array.isArray(sale.items) ? sale.items : []);
            const sum = rows.reduce((s, r) => s + (r.item === item.id ? computeRowQty(r) : 0), 0);
            return total + sum;
          }, 0);

          // Opening stock as of start date: sum of all transactions before start
          const startDateStr = new Date(dateRange.start).toISOString().split('T')[0];
          const purchasedBefore = purchases.reduce((total, purchase) => {
            const pDate = purchase.billDate || purchase.date || '';
            if (pDate < startDateStr) {
              const rows = Array.isArray(purchase.rows) ? purchase.rows : (Array.isArray(purchase.items) ? purchase.items : []);
              const qty = rows.reduce((s, r) => s + (r.item === item.id ? computeRowQty(r) : 0), 0);
              return total + qty;
            }
            return total;
          }, 0);
          const soldBefore = sales.reduce((total, sale) => {
            const sDate = sale.invoiceDate || sale.date || '';
            if (sDate < startDateStr) {
              const rows = Array.isArray(sale.rows) ? sale.rows : (Array.isArray(sale.items) ? sale.items : []);
              const qty = rows.reduce((s, r) => s + (r.item === item.id ? computeRowQty(r) : 0), 0);
              return total + qty;
            }
            return total;
          }, 0);
          const openingStock = (parseFloat(item.openingStock || 0) || 0) + purchasedBefore - soldBefore;
          const inHand = openingStock + purchasedQty - soldQty; // opening + purchases - sales

          let status = 'Normal';
          if (inHand < 0) status = 'Negative';
          else if (inHand <= (item.reorderLevel || 10)) status = 'Low Stock';

          return {
            itemId: item.id,
            itemName: item.itemName,
            openingStock: openingStock,
            purchased: purchasedQty,
            sold: soldQty,
            inHand: inHand,
            reorderLevel: item.reorderLevel || 10,
            status: status,
            averageRate: item.defaultRate || 0
          };
        });

        setStockData(stockReport);

        const totals = stockReport.reduce((acc, item) => ({
          totalItems: acc.totalItems + 1,
          totalValue: acc.totalValue + (item.inHand * item.averageRate),
          negativeStock: acc.negativeStock + (item.inHand < 0 ? 1 : 0),
          lowStock: acc.lowStock + (item.status === 'Low Stock' ? 1 : 0)
        }), {
          totalItems: 0,
          totalValue: 0,
          negativeStock: 0,
          lowStock: 0
        });
        setTotalSummary(totals);
      } catch (error) {
        console.error('Error fetching stock report data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db, userId, appId, dateRange, setLoading]);

  // Table columns
  const columns = [
    { key: 'itemName', label: 'Item Name' },
    { key: 'openingStock', label: 'Opening Stock' },
    { key: 'purchased', label: 'Purchased' },
    { key: 'sold', label: 'Sold' },
    { key: 'inHand', label: 'In Hand' },
    { key: 'reorderLevel', label: 'Reorder Level' },
    { key: 'status', label: 'Status' }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Stock Report (Auto Calculated)</h2>
        <p className="text-gray-600">
          Period: {new Date(dateRange.start).toLocaleDateString('en-IN')} to {new Date(dateRange.end).toLocaleDateString('en-IN')}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Items</div>
          <div className="text-2xl font-bold text-blue-800">{totalSummary.totalItems}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Value</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalValue)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Negative Stock</div>
          <div className="text-2xl font-bold text-red-800">{totalSummary.negativeStock}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Low Stock</div>
          <div className="text-2xl font-bold text-yellow-800">{totalSummary.lowStock}</div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stockData.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-gray-400">No data found</td></tr>
            ) : stockData.map((row, idx) => (
              <tr key={row.itemId || idx} className="cursor-pointer hover:bg-blue-50" onClick={() => handleItemClick(row)}>
                {columns.map(col => {
                  const isInHand = col.key === 'inHand';
                  const cls = isInHand
                    ? (row.inHand < 0 ? 'text-red-700' : row.inHand > 0 ? 'text-green-700' : 'text-gray-700')
                    : '';
                  return (
                    <td key={col.key} className={`px-6 py-4 whitespace-nowrap ${cls}`}>
                      {row[col.key]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Quick Summary Modal */}
      {showQuickSummary && quickSummaryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowQuickSummary(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-center">Stock Item Summary</h3>
            <div className="space-y-3">
              <div><strong>Item Name:</strong> {quickSummaryItem.itemName}</div>
              <div><strong>Item ID:</strong> {quickSummaryItem.itemId}</div>
              <div><strong>Opening Stock:</strong> {quickSummaryItem.openingStock}</div>
              <div><strong>Purchased:</strong> {quickSummaryItem.purchased}</div>
              <div><strong>Sold:</strong> {quickSummaryItem.sold}</div>
              <div><strong>In Hand:</strong> {quickSummaryItem.inHand}</div>
              <div><strong>Reorder Level:</strong> {quickSummaryItem.reorderLevel}</div>
              <div><strong>Average Rate:</strong> {formatCurrency(quickSummaryItem.averageRate)}</div>
              <div><strong>Stock Value:</strong> {formatCurrency(quickSummaryItem.inHand * quickSummaryItem.averageRate)}</div>
              <div><strong>Status:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  quickSummaryItem.status === 'Normal' ? 'bg-green-100 text-green-800' :
                  quickSummaryItem.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {quickSummaryItem.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockReport; 