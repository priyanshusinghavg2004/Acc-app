import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency, formatDate } from './CommonComponents';

const ItemwiseSalesReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading }) => {
  const [itemData, setItemData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalAmount: 0,
    slowMovingItems: 0
  });
  const [showQuickSummary, setShowQuickSummary] = useState(false);
  const [quickSummaryItem, setQuickSummaryItem] = useState(null);
  const [itemNames, setItemNames] = useState({});

  // Sample data for testing
  const sampleData = [
    {
      itemId: 'sample1',
      itemName: 'Laptop',
      quantitySold: 25,
      totalAmount: 1250000,
      averageRate: 50000,
      totalInvoices: 15,
      category: 'Normal'
    },
    {
      itemId: 'sample2',
      itemName: 'Mouse',
      quantitySold: 100,
      totalAmount: 50000,
      averageRate: 500,
      totalInvoices: 25,
      category: 'Normal'
    },
    {
      itemId: 'sample3',
      itemName: 'Old Keyboard',
      quantitySold: 3,
      totalAmount: 3000,
      averageRate: 1000,
      totalInvoices: 2,
      category: 'Slow-moving'
    },
    {
      itemId: 'sample4',
      itemName: 'Discontinued Monitor',
      quantitySold: 0,
      totalAmount: 0,
      averageRate: 0,
      totalInvoices: 0,
      category: 'Non-moving'
    }
  ];

  // Use sample data if no real data
  const displayData = itemData.length > 0 ? itemData : sampleData;

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(displayData, { key: 'quantitySold', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 25);

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

  // Function to fetch item names from items collection
  const fetchItemNames = async (itemIds) => {
    if (!itemIds || itemIds.length === 0) return {};
    
    try {
      const basePath = `artifacts/acc-app-e5316/users/${userId}`;
      const itemsQuery = query(
        collection(db, `${basePath}/items`),
        where('__name__', 'in', itemIds)
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      const itemNames = {};
      itemsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        itemNames[doc.id] = data.name || data.itemName || data.productName || doc.id;
      });
      return itemNames;
    } catch (error) {
      console.error('Error fetching item names:', error);
      return {};
    }
  };

  // Handle item click for quick summary
  const handleItemClick = async (item) => {
    setQuickSummaryItem(item);
    setShowQuickSummary(true);
    
    // Fetch item names for this item
    if (item.itemId) {
      const names = await fetchItemNames([item.itemId]);
      console.log('Fetched item names:', names);
      setItemNames(names);
    }
  };

  // Fetch itemwise sales data
  useEffect(() => {
    const fetchItemwiseSales = async () => {
      if (!db || !userId || !appId) return;
      
      // Don't proceed if parties array is empty (still loading)
      if (parties.length === 0) {
        return;
      }
      
      setLoading(true);
      try {
        // Get all sales in date range (without partyId filter to avoid composite index)
        const salesQuery = query(
          collection(db, `users/${userId}/apps/${appId}/sales`),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        );

        const salesSnapshot = await getDocs(salesQuery);
        let sales = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          sales = sales.filter(sale => sale.partyId === selectedParty);
        }

        // Aggregate sales by item
        const itemSummary = {};
        
        sales.forEach(sale => {
          if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
              const itemId = item.itemId;
              if (!itemSummary[itemId]) {
                itemSummary[itemId] = {
                  itemId: itemId,
                  itemName: item.itemName,
                  quantitySold: 0,
                  totalAmount: 0,
                  averageRate: 0,
                  totalInvoices: 0
                };
              }
              
              itemSummary[itemId].quantitySold += item.quantity || 0;
              itemSummary[itemId].totalAmount += item.totalAmount || 0;
              itemSummary[itemId].totalInvoices++;
            });
          }
        });

        // Calculate average rates and categorize items
        const itemReport = Object.values(itemSummary).map(item => {
          const avgRate = item.quantitySold > 0 ? item.totalAmount / item.quantitySold : 0;
          
          // Categorize items
          let category = 'Normal';
          if (item.quantitySold === 0) {
            category = 'Non-moving';
          } else if (item.quantitySold <= 5) {
            category = 'Slow-moving';
          }

          return {
            ...item,
            averageRate: avgRate,
            category: category
          };
        });

        setItemData(itemReport);

        // Calculate totals
        const totals = itemReport.reduce((acc, item) => ({
          totalItems: acc.totalItems + 1,
          totalQuantity: acc.totalQuantity + item.quantitySold,
          totalAmount: acc.totalAmount + item.totalAmount,
          slowMovingItems: acc.slowMovingItems + (item.category === 'Slow-moving' || item.category === 'Non-moving' ? 1 : 0)
        }), {
          totalItems: 0,
          totalQuantity: 0,
          totalAmount: 0,
          slowMovingItems: 0
        });

        setTotalSummary(totals);
      } catch (error) {
        console.error('Error fetching itemwise sales data:', error);
        setItemData([]);
        setTotalSummary({
          totalItems: 0,
          totalQuantity: 0,
          totalAmount: 0,
          slowMovingItems: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchItemwiseSales();
  }, [db, userId, appId, dateRange, selectedParty, parties]);

  // Calculate totals from displayData (including sample data)
  const displayTotals = displayData.reduce((acc, item) => ({
    totalItems: acc.totalItems + 1,
    totalQuantity: acc.totalQuantity + item.quantitySold,
    totalAmount: acc.totalAmount + item.totalAmount,
    slowMovingItems: acc.slowMovingItems + (item.category === 'Slow-moving' || item.category === 'Non-moving' ? 1 : 0)
  }), {
    totalItems: 0,
    totalQuantity: 0,
    totalAmount: 0,
    slowMovingItems: 0
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

  // Handle row click - view item details
  const handleRowClick = (item) => {
    console.log('View item details:', item.itemId);
    handleItemClick(item);
  };

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Itemwise Sales Report</h2>
        <p className="text-gray-600">
          Period: {new Date(dateRange.start).toLocaleDateString('en-IN')} to {new Date(dateRange.end).toLocaleDateString('en-IN')}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Items</div>
          <div className="text-2xl font-bold text-blue-800">{displayTotals.totalItems}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Quantity</div>
          <div className="text-2xl font-bold text-green-800">{displayTotals.totalQuantity}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total Amount</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(displayTotals.totalAmount)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Slow/Non-moving</div>
          <div className="text-2xl font-bold text-yellow-800">{displayTotals.slowMovingItems}</div>
        </div>
      </div>

      {/* Item Sales Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader 
                  columnKey="itemName" 
                  label="Item Name" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="quantitySold" 
                  label="Quantity Sold" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="totalAmount" 
                  label="Total Amount" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="averageRate" 
                  label="Avg. Rate" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="totalInvoices" 
                  label="Total Invoices" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
                <SortableHeader 
                  columnKey="category" 
                  label="Category" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.map((item, index) => (
                <tr 
                  key={item.itemId || index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(item)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600 hover:underline">
                      {item.itemName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {item.quantitySold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(item.totalAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(item.averageRate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {item.totalInvoices}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.category === 'Normal' ? 'bg-green-100 text-green-800' :
                      item.category === 'Slow-moving' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.category}
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
          <div className="text-gray-500 text-lg mb-2">No item sales data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}

      {/* Category Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Item Categories</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p><strong>Normal:</strong> Items with good sales volume</p>
              <p><strong>Slow-moving:</strong> Items with ≤5 units sold (consider discounting)</p>
              <p><strong>Non-moving:</strong> Items with 0 sales (consider discontinuing)</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Summary Modal */}
      {showQuickSummary && quickSummaryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowQuickSummary(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-center">Item Sales Summary</h3>
            <div className="space-y-3">
              <div><strong>Item Name:</strong> {quickSummaryItem.itemName}</div>
              <div><strong>Item ID:</strong> {quickSummaryItem.itemId}</div>
              <div><strong>Quantity Sold:</strong> {quickSummaryItem.quantitySold}</div>
              <div><strong>Total Amount:</strong> {formatCurrency(quickSummaryItem.totalAmount)}</div>
              <div><strong>Average Rate:</strong> {formatCurrency(quickSummaryItem.averageRate)}</div>
              <div><strong>Total Invoices:</strong> {quickSummaryItem.totalInvoices}</div>
              <div><strong>Category:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  quickSummaryItem.category === 'Normal' ? 'bg-green-100 text-green-800' :
                  quickSummaryItem.category === 'Slow-moving' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {quickSummaryItem.category}
                </span>
              </div>
              
              {/* Item Details */}
              {quickSummaryItem.itemDetails && quickSummaryItem.itemDetails.length > 0 && (
                <div>
                  <strong>Recent Sales:</strong>
                  <div className="ml-4 mt-1 space-y-1">
                    {quickSummaryItem.itemDetails.slice(0, 5).map((detail, idx) => (
                      <div key={idx} className="text-sm">
                        Invoice: {detail.invoiceNo} - Qty: {detail.quantity} - Rate: ₹{detail.rate} - Date: {formatDate(detail.date)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemwiseSalesReport; 