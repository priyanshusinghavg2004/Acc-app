import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

const PurchaseBillsSummary = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading, companyDetails }) => {
  const [billsData, setBillsData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    totalGST: 0,
    totalPaid: 0,
    totalOutstanding: 0
  });
  const [itemNameMap, setItemNameMap] = useState({});

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(billsData, { key: 'partyName', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // Modal states (match sales summary behavior)
  const [showModal, setShowModal] = useState(false);
  const [modalParty, setModalParty] = useState(null);
  const [modalInvoices, setModalInvoices] = useState([]);
  const [showQuickSummary, setShowQuickSummary] = useState(false);
  const [quickSummaryInvoice, setQuickSummaryInvoice] = useState(null);

  // Fetch purchase bills data only
  useEffect(() => {
    const fetchBillsReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];

        // Get all purchases in date range
        const purchasesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '>=', startStr),
          where('billDate', '<=', endStr),
          orderBy('billDate', 'desc')
        );

        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchaseDocs = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch items for GST rate fallback
        const itemsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/items`));
        const itemMeta = {};
        const nameMap = {};
        itemsSnapshot.forEach(d => {
          const it = d.data() || {};
          itemMeta[d.id] = {
            gstPercentage: parseFloat(it.gstPercentage) || 0,
            itemType: it.itemType || 'Goods'
          };
          nameMap[d.id] = it.itemName || it.name || it.title || '';
        });
        setItemNameMap(nameMap);

        // Filter by selected party in JavaScript if needed
        let purchases = purchaseDocs.filter(p => !selectedParty || (p.party || p.partyId) === selectedParty);

        // Get all payments for status calculation
        const paymentsQueryRef = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
          where('paymentDate', '<=', endStr),
          orderBy('paymentDate', 'asc')
        );
        const paymentsSnapshot = await getDocs(paymentsQueryRef);
        const payments = paymentsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.paymentDate || d.date,
            partyId: d.partyId || d.party,
            amount: parseFloat(d.totalAmount || d.amount || 0),
            receiptNumber: d.receiptNumber,
            type: d.type,
            allocations: d.allocations || []
          };
        });

        // Helpers to resolve party id/name
        const resolvePartyId = (docData) => {
          const raw = docData.customFields?.party || docData.party || docData.partyId;
          if (raw && parties.some(p => p.id === raw)) return raw;
          const name = docData.partyName || docData.firmName || '';
          const match = parties.find(p => (p.firmName || p.partyName) === name);
          return match?.id || raw || '';
        };
        const resolvePartyName = (partyId, docData) => {
          const p = parties.find(pp => pp.id === partyId);
          return docData.partyName || p?.firmName || p?.partyName || p?.name || partyId || '';
        };

        // Group purchases by party and compute FIFO-paid amounts (partywise summary)
        const partyBills = {};
        purchases.forEach(billDoc => {
          const rows = billDoc.rows || billDoc.items || [];
          let cgst = 0, sgst = 0, igst = 0, taxable = 0;
          for (const r of rows) {
            const base = parseFloat(r.amount) || 0;
            const meta = itemMeta[r.item] || {};
            const rateSum = (parseFloat(r.sgst) || 0) + (parseFloat(r.cgst) || 0) + (parseFloat(r.igst) || 0) || meta.gstPercentage || 0;
            // If IGST present, take full to IGST; else split equally across CGST/SGST
            if ((parseFloat(r.igst) || 0) > 0) {
              igst += (base * rateSum) / 100;
            } else {
              const tax = (base * rateSum) / 100;
              cgst += tax / 2; sgst += tax / 2;
            }
            taxable += base;
          }
          const totalAmount = parseFloat(billDoc.totalAmount || billDoc.amount || taxable + cgst + sgst + igst || 0);
          const partyId = resolvePartyId(billDoc);
          const partyName = resolvePartyName(partyId, billDoc);
          const bill = {
            id: billDoc.id,
            partyId,
            partyName,
            totalAmount,
            gst: cgst + sgst + igst,
            date: billDoc.billDate || billDoc.date,
            number: billDoc.billNumber || billDoc.number || billDoc.id,
            rows: billDoc.rows || billDoc.items || []
          };
          if (!partyBills[partyId]) partyBills[partyId] = [];
          partyBills[partyId].push(bill);
        });

        // Group payments by party (purchase receipts PRP)
        const partyPayments = {};
        payments.filter(p => p.receiptNumber?.startsWith('PRP')).forEach(p => {
          if (!partyPayments[p.partyId]) partyPayments[p.partyId] = [];
          partyPayments[p.partyId].push(p);
        });

        // Build party summaries with FIFO allocation
        const summaries = [];
        Object.entries(partyBills).forEach(([partyId, bills]) => {
          const sorted = bills.sort((a, b) => new Date(a.date) - new Date(b.date));
          const pays = (partyPayments[partyId] || []).sort((a, b) => new Date(a.paymentDate || a.date) - new Date(b.paymentDate || b.date));
          let totalPaid = 0; let i = 0; let j = 0;
          while (i < sorted.length && j < pays.length) {
            const inv = sorted[i];
            const pay = pays[j];
            let outstanding = Number(inv.totalAmount) - (inv.paidAmount || 0);
            let remaining = Number(pay.totalAmount || pay.amount || 0) - (pay.usedAmount || 0);
            if (outstanding <= 0) { i++; continue; }
            if (remaining <= 0) { j++; continue; }
            const apply = Math.min(outstanding, remaining);
            inv.paidAmount = (inv.paidAmount || 0) + apply;
            pay.usedAmount = (pay.usedAmount || 0) + apply;
            totalPaid += apply;
          }
          let totalAmount = 0, totalGST = 0, lastDate = null;
          sorted.forEach(b => { totalAmount += Number(b.totalAmount); totalGST += b.gst || 0; lastDate = b.date || lastDate; });
          let outstanding = totalAmount - totalPaid; if (outstanding < 0) outstanding = 0;
          const partyObj = parties.find(p => p.id === partyId) || {};
          summaries.push({
            partyId,
            partyName: partyObj.firmName || partyObj.partyName || partyObj.name || partyId,
            totalInvoices: sorted.length,
            totalAmount,
            totalGST,
            totalPaid,
            totalOutstanding: outstanding,
            lastInvoiceDate: lastDate ? new Date(lastDate) : null,
            invoices: sorted.map(s => ({ id: s.id, invoiceNumber: s.number, date: s.date ? new Date(s.date) : null, totalAmount: s.totalAmount, paidAmount: s.paidAmount || 0, items: s.rows }))
          });
        });

        const reportRows = selectedParty ? summaries.filter(r => r.partyId === selectedParty) : summaries;
        setBillsData(reportRows);

        const totals = reportRows.reduce((acc, row) => ({
          totalInvoices: acc.totalInvoices + row.totalInvoices,
          totalAmount: acc.totalAmount + row.totalAmount,
          totalGST: acc.totalGST + row.totalGST,
          totalPaid: acc.totalPaid + row.totalPaid,
          totalOutstanding: acc.totalOutstanding + row.totalOutstanding
        }), { totalInvoices:0, totalAmount:0, totalGST:0, totalPaid:0, totalOutstanding:0 });

        setTotalSummary(totals);

      } catch (error) {
        console.error('Error fetching bills report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBillsReport();
  }, [db, userId, appId, dateRange, selectedParty, parties]);

  // ESC key handling for LIFO modal closing
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showQuickSummary) {
          setShowQuickSummary(false);
        } else if (showModal) {
          setShowModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showQuickSummary, showModal]);

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

  const displayData = billsData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Purchase Bill Summary</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && (() => { const p = parties.find(pp => pp.id === selectedParty); return ` | Party: ${p?.firmName || p?.partyName || p?.name || selectedParty}`; })()}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Invoices</div>
          <div className="text-2xl font-bold text-blue-800">{totalSummary.totalInvoices}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Amount</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalSummary.totalAmount)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total GST</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(totalSummary.totalGST)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Total Paid</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totalSummary.totalPaid)}</div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Invoices</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total GST</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Invoice Date</th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagination.currentData.map((row, idx) => (
              <tr key={row.partyId || idx} className="cursor-pointer hover:bg-blue-50" onClick={() => { setModalParty(row); setModalInvoices(row.invoices || []); setShowModal(true); }}>
                <td className="px-6 py-4 whitespace-nowrap">{row.partyName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{row.totalInvoices}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(row.totalAmount)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(row.totalGST)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(row.totalPaid)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(row.totalOutstanding)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <PaginationControls {...pagination} />
      </div>

      {/* Modal + Quick Summary like sales */}
      {showModal && modalParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowModal(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-2">{modalParty.partyName} - Purchase Bills</h3>
            <div className="mb-2 text-sm text-gray-600">Total Invoices: {modalParty.totalInvoices}</div>
            <div className="mb-4 text-sm text-gray-600">Total Amount: {formatCurrency(modalParty.totalAmount)}</div>
            <div className="max-h-72 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Bill No</th><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Amount</th><th className="px-4 py-2 text-left">Paid Amount</th></tr></thead>
                <tbody>
                  {modalInvoices.map((inv, i) => (
                    <tr key={inv.id || i}>
                      <td className="px-4 py-2"><button className="text-blue-600 hover:text-blue-800 underline" onClick={(e)=>{e.stopPropagation(); setQuickSummaryInvoice(inv); setShowQuickSummary(true);}}> {inv.invoiceNumber} </button></td>
                      <td className="px-4 py-2">{inv.date ? formatDate(inv.date) : ''}</td>
                      <td className="px-4 py-2">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-2">{formatCurrency(inv.paidAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showQuickSummary && quickSummaryInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowQuickSummary(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-center">Purchase Bill Summary</h3>
            <div className="space-y-3">
              <div><strong>Bill Number:</strong> {quickSummaryInvoice.invoiceNumber}</div>
              <div><strong>Date:</strong> {quickSummaryInvoice.date ? formatDate(quickSummaryInvoice.date) : ''}</div>
              <div><strong>Amount:</strong> {formatCurrency(quickSummaryInvoice.totalAmount)}</div>
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-2">Items</div>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(quickSummaryInvoice.items || []).map((r, idx) => {
                      const name = r.itemName || r.name || itemNameMap[r.item] || r.item || '-';
                      const qty = r.qty || r.quantity || r.nos || 0;
                      const rate = r.rate || r.price || 0;
                      const amount = r.amount || (Number(qty) * Number(rate));
                      return (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{name}</td>
                          <td className="px-3 py-2 text-right">{qty}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(rate)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {displayData.length === 0 && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No bills data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default PurchaseBillsSummary; 