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
    const fetchData = async () => {
      try {
        const basePath = `artifacts/${appId}/users/${userId}`;
        // Fetch items
        const itemsQuery = query(collection(db, `${basePath}/items`), orderBy('itemName', 'asc'));
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Fetch purchases
        const purchasesQuery = query(
          collection(db, `${basePath}/purchaseBills`),
          where('billDate', '>=', dateRange.start),
          where('billDate', '<=', dateRange.end),
          orderBy('billDate', 'asc')
        );
        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Fetch sales
        const salesQuery = query(
          collection(db, `${basePath}/salesBills`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'asc')
        );
        const salesSnapshot = await getDocs(salesQuery);
        const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Calculate stock movement for each item
        const stockReport = items.map(item => {
          // Calculate purchased quantity
          const purchasedQty = purchases.reduce((total, purchase) => {
            if (purchase.rows && Array.isArray(purchase.rows)) {
              const itemInPurchase = purchase.rows.find(i => i.item === item.id);
              return total + (itemInPurchase?.qty || 0);
            }
            return total;
          }, 0);
          // Calculate sold quantity
          const soldQty = sales.reduce((total, sale) => {
            if (sale.rows && Array.isArray(sale.rows)) {
              const itemInSale = sale.rows.find(i => i.item === item.id);
              return total + (itemInSale?.qty || 0);
            }
            return total;
          }, 0);
          // Calculate in-hand stock
          const openingStock = parseFloat(item.openingStock || 0);
          const inHand = openingStock + purchasedQty - soldQty; // opening + purchases - sales
          // Determine status
          let status = 'Normal';
          if (inHand < 0) {
            status = 'Negative';
          } else if (inHand <= (item.reorderLevel || 10)) {
            status = 'Low Stock';
          }
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
        // Calculate totals
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
  }, [db, userId, dateRange, setLoading]);

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
                {columns.map(col => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                    {row[col.key]}
                  </td>
                ))}
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