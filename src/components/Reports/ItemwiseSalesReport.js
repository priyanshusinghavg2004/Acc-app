import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where, doc, getDoc } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency } from './CommonComponents';

// Helper to compute amount for a row reliably
const computeRowAmount = (row) => {
  const explicitAmount = parseFloat(row?.amount) || 0;
  if (explicitAmount) return explicitAmount;
  const qty = (parseFloat(row?.qty) || ((parseFloat(row?.nos) || 0) * (parseFloat(row?.length) || 1) * (parseFloat(row?.height) || 1))) || 0;
  const rate = parseFloat(row?.rate) || 0;
  return qty * rate;
};

const computeRowQty = (row) => {
  const qty = parseFloat(row?.qty);
  if (!Number.isNaN(qty) && qty) return qty;
  return (parseFloat(row?.nos) || 0) * (parseFloat(row?.length) || 1) * (parseFloat(row?.height) || 1);
};

const ItemwiseSalesReport = ({ db, userId, appId, dateRange, selectedParty, parties, loading, setLoading }) => {
  const [rowsByItem, setRowsByItem] = useState([]);
  const [billListModal, setBillListModal] = useState(null); // { type: 'sales'|'purchase', itemRow }
  const [billSummaryModal, setBillSummaryModal] = useState(null); // { type, bill }
  const [itemIdToName, setItemIdToName] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !userId || !appId || !dateRange?.start || !dateRange?.end) return;

      setLoading && setLoading(true);
      try {
        // Bills store dates as 'YYYY-MM-DD' strings; compare using string boundaries
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];

        // Build queries
        const salesQ = query(
          collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
          where('invoiceDate', '>=', startStr),
          where('invoiceDate', '<=', endStr),
          orderBy('invoiceDate', 'desc')
        );

        const purchaseQ = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '>=', startStr),
          where('billDate', '<=', endStr),
          orderBy('billDate', 'desc')
        );

        const itemsCol = collection(db, `artifacts/${appId}/users/${userId}/items`);

        const [salesSnap, purchaseSnap, itemsSnap] = await Promise.all([
          getDocs(salesQ),
          getDocs(purchaseQ),
          getDocs(itemsCol)
        ]);

        // Map item id to name
        const itemNameMap = {};
        itemsSnap.forEach((d) => {
          const data = d.data() || {};
          itemNameMap[d.id] = data.itemName || data.name || d.id;
        });
        setItemIdToName(itemNameMap);

        // Collect bills
        let salesBills = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        let purchaseBills = purchaseSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (selectedParty) {
          salesBills = salesBills.filter((b) => (b.party || b.partyId) === selectedParty);
          purchaseBills = purchaseBills.filter((b) => (b.party || b.partyId) === selectedParty);
        }

        // Aggregate by item
        const aggregate = new Map();

        // Sales
        for (const bill of salesBills) {
          const billNumber = bill.number || bill.invoiceNumber || '';
          const rows = bill.rows || bill.items || [];
          for (const row of rows) {
            const itemId = row.item;
            if (!itemId) continue;
            const amt = computeRowAmount(row);
            if (!aggregate.has(itemId)) {
              aggregate.set(itemId, {
                itemId,
                itemName: itemNameMap[itemId] || itemId,
                totalSalesAmount: 0,
                totalPurchaseAmount: 0,
                salesBillNumbers: new Set(),
                purchaseBillNumbers: new Set(),
                salesBills: [],
                purchaseBills: [],
              });
            }
            const entry = aggregate.get(itemId);
            entry.totalSalesAmount += amt;
            if (billNumber) {
              const prevSize = entry.salesBillNumbers.size;
              entry.salesBillNumbers.add(billNumber);
              if (entry.salesBillNumbers.size !== prevSize) {
                entry.salesBills.push({ id: bill.id, number: billNumber, date: bill.invoiceDate, amount: bill.amount || 0 });
              }
            }
          }
        }

        // Purchases
        for (const bill of purchaseBills) {
          const billNumber = bill.number || bill.billNumber || '';
          const rows = bill.rows || bill.items || [];
          for (const row of rows) {
            const itemId = row.item;
            if (!itemId) continue;
            const amt = computeRowAmount(row);
            if (!aggregate.has(itemId)) {
              aggregate.set(itemId, {
                itemId,
                itemName: itemNameMap[itemId] || itemId,
                totalSalesAmount: 0,
                totalPurchaseAmount: 0,
                salesBillNumbers: new Set(),
                purchaseBillNumbers: new Set(),
                salesBills: [],
                purchaseBills: [],
              });
            }
            const entry = aggregate.get(itemId);
            entry.totalPurchaseAmount += amt;
            if (billNumber) {
              const prevSize = entry.purchaseBillNumbers.size;
              entry.purchaseBillNumbers.add(billNumber);
              if (entry.purchaseBillNumbers.size !== prevSize) {
                entry.purchaseBills.push({ id: bill.id, number: billNumber, date: bill.billDate, amount: bill.amount || 0 });
              }
            }
          }
        }

        // Convert to array with computed fields
        const rowsArray = Array.from(aggregate.values()).map((r) => ({
          ...r,
          stockValueInHand: (r.totalPurchaseAmount || 0) - (r.totalSalesAmount || 0),
          salesBillNumbers: Array.from(r.salesBillNumbers).sort(),
          purchaseBillNumbers: Array.from(r.purchaseBillNumbers).sort(),
        }));

        setRowsByItem(rowsArray);
      } catch (err) {
        console.error('Error loading Item-wise Sales/Purchase report:', err);
        setRowsByItem([]);
      } finally {
        setLoading && setLoading(false);
      }
    };

    fetchData();
  }, [db, userId, appId, dateRange?.start, dateRange?.end, selectedParty]);

  // ESC key handler (LIFO close for modals)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (billSummaryModal) {
        setBillSummaryModal(null);
        return;
      }
      if (billListModal) {
        setBillListModal(null);
        return;
      }
    };

    if (billSummaryModal || billListModal) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [billSummaryModal, billListModal]);

  // Sort and paginate
  const { sortedData, sortConfig, handleSort } = useTableSort(rowsByItem, { key: 'stockValueInHand', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // Totals
  const totals = useMemo(() => {
    return rowsByItem.reduce(
      (acc, r) => {
        acc.items += 1;
        acc.sales += r.totalSalesAmount || 0;
        acc.purchases += r.totalPurchaseAmount || 0;
        acc.stock += (r.totalPurchaseAmount || 0) - (r.totalSalesAmount || 0);
        return acc;
      },
      { items: 0, sales: 0, purchases: 0, stock: 0 }
    );
  }, [rowsByItem]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Item-wise Sales and Purchase (Amount-wise)</h2>
        <p className="text-gray-600">
          Period: {new Date(dateRange.start).toLocaleDateString('en-IN')} to {new Date(dateRange.end).toLocaleDateString('en-IN')}
          {selectedParty && ` | Party: ${parties?.find?.((p) => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Items</div>
          <div className="text-2xl font-bold text-blue-800">{totals.items}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Sales</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totals.sales)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total Purchase</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(totals.purchases)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Stock Value in Hand</div>
          <div className={`text-2xl font-bold ${totals.stock < 0 ? 'text-red-700' : totals.stock > 0 ? 'text-green-700' : 'text-yellow-800'}`}>{formatCurrency(totals.stock)}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12.5%' }} />
              <col style={{ width: '12.5%' }} />
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader columnKey="itemName" label="Item" onSort={handleSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="totalSalesAmount" label="Total Sales" onSort={handleSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="totalPurchaseAmount" label="Total Purchase" onSort={handleSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="stockValueInHand" label="Stock Value in Hand" onSort={handleSort} sortConfig={sortConfig} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Bills</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Bills</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.map((row, idx) => (
                <tr key={row.itemId || idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 whitespace-normal break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{row.itemName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(row.totalSalesAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(row.totalPurchaseAmount)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right ${row.stockValueInHand < 0 ? 'text-red-700' : row.stockValueInHand > 0 ? 'text-green-700' : 'text-gray-700'}`}>{formatCurrency(row.stockValueInHand)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {row.salesBillNumbers.length > 0 ? (
                      <button className="underline" onClick={() => setBillListModal({ type: 'sales', itemRow: row })}>{row.salesBillNumbers.length}</button>
                    ) : '-' }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {row.purchaseBillNumbers.length > 0 ? (
                      <button className="underline" onClick={() => setBillListModal({ type: 'purchase', itemRow: row })}>{row.purchaseBillNumbers.length}</button>
                    ) : '-' }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...pagination} />
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}

      {/* Bill List Modal */}
      {billListModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setBillListModal(null)}>&times;</button>
            <h3 className="text-lg font-bold mb-4">{billListModal.type === 'sales' ? 'Sales' : 'Purchase'} Invoices ({(billListModal.itemRow[billListModal.type === 'sales' ? 'salesBills' : 'purchaseBills'] || []).length})</h3>
            <div className="max-h-80 overflow-auto divide-y">
              {(billListModal.itemRow[billListModal.type === 'sales' ? 'salesBills' : 'purchaseBills'] || []).map((b) => (
                <div key={b.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.number}</div>
                    <div className="text-xs text-gray-500">{b.date}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-700">{formatCurrency(b.amount)}</div>
                    <button className="text-blue-600 underline" onClick={() => setBillSummaryModal({ type: billListModal.type, bill: b })}>View</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bill Summary Modal */}
      {billSummaryModal && (
        <BillSummaryModal
          db={db}
          appId={appId}
          userId={userId}
          type={billSummaryModal.type}
          bill={billSummaryModal.bill}
          itemIdToName={itemIdToName}
          parties={parties}
          onClose={() => setBillSummaryModal(null)}
        />
      )}
    </div>
  );
};

// Modal component to fetch and display bill details with party and item rows
const BillSummaryModal = ({ db, appId, userId, type, bill, itemIdToName, parties, onClose }) => {
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const load = async () => {
      const coll = type === 'sales' ? 'salesBills' : 'purchaseBills';
      try {
        const ref = doc(db, `artifacts/${appId}/users/${userId}/${coll}`, bill.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const partyFromId = (pid) => (parties?.find?.((p) => p.id === pid)?.firmName) || (parties?.find?.((p) => p.id === pid)?.name) || pid || '';
          setDetails({
            number: data.number || bill.number,
            date: (type === 'sales' ? data.invoiceDate : data.billDate) || bill.date,
            partyName: data.partyName || data.partyFirmName || partyFromId(data.party) || partyFromId(bill.partyId),
            amount: data.amount || bill.amount || 0,
            rows: Array.isArray(data.rows) ? data.rows : (Array.isArray(data.items) ? data.items : []),
          });
        }
      } catch (e) {
        // fallback: minimal details
        const partyFromId = (pid) => (parties?.find?.((p) => p.id === pid)?.firmName) || (parties?.find?.((p) => p.id === pid)?.name) || pid || '';
        setDetails({ number: bill.number, date: bill.date, amount: bill.amount || 0, rows: [], partyName: partyFromId(bill.partyId) });
      }
    };
    load();
  }, [db, appId, userId, type, bill, parties]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={onClose}>&times;</button>
        <h3 className="text-lg font-bold mb-4">{type === 'sales' ? 'Sales Bill Summary' : 'Purchase Bill Summary'} <span className="ml-2 text-xs text-gray-400">Press ESC to close</span></h3>
        {!details ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div><span className="font-medium">Invoice Number:</span> {details.number}</div>
            <div><span className="font-medium">Date:</span> {new Date(details.date).toLocaleDateString('en-IN')}</div>
            {details.partyName && (
              <div><span className="font-medium">Party:</span> {details.partyName}</div>
            )}
            <div><span className="font-medium">Amount:</span> {formatCurrency(details.amount)}</div>
            {details.rows && details.rows.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold mb-1">Items Sold:</div>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  {details.rows.map((r, i) => (
                    <li key={i}>
                      {itemIdToName[r.item] || r.description || r.item || 'Item'} (Qty: {computeRowQty(r)}, Rate: {formatCurrency(parseFloat(r.rate) || 0)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemwiseSalesReport;