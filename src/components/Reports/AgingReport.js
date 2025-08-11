import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import ShareButton from './ShareButton';

const AgingReport = ({ db, userId, appId, dateRange, selectedParty, parties, loading, setLoading }) => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ totalOutstanding: 0 });
  const [showPartyBillsModal, setShowPartyBillsModal] = useState(false);
  const [modalParty, setModalParty] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [companyDetails, setCompanyDetails] = useState(null);

  const parseDate = (input) => {
    if (!input) return null;
    if (input instanceof Date) return input;
    if (typeof input === 'object' && input.seconds) return new Date(input.seconds * 1000);
    const s = String(input).trim();
    let d = new Date(s.replace(/-/g, '/'));
    if (!isNaN(d.getTime())) return d;
    const f = new Date(s);
    return isNaN(f.getTime()) ? null : f;
  };

  const { sortedData, sortConfig, handleSort } = useTableSort(rows, { key: 'totalOutstanding', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 25);

  // ESC key: step-by-step LIFO closing (invoice details -> party modal)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedInvoice) {
          setSelectedInvoice(null);
        } else if (showPartyBillsModal) {
          setShowPartyBillsModal(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedInvoice, showPartyBillsModal]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!db || !userId) return;
      setLoading(true);
      try {
        const base = `artifacts/${appId || 'acc-app-e5316'}/users/${userId}`;

        // Company details (for letterhead)
        try {
          const compSnap = await getDocs(collection(db, `${base}/companyDetails`));
          if (!compSnap.empty) {
            setCompanyDetails(compSnap.docs[0].data());
          }
        } catch (e) {
          // non-fatal
          console.warn('Company details not found');
        }

        // Fetch all sales invoices up to end date (as-on)
        const invSnap = await getDocs(query(collection(db, `${base}/salesBills`), orderBy('invoiceDate', 'asc')));
        let invoices = invSnap.docs.map(doc => {
          const d = doc.data();
          return {
          id: doc.id,
            partyId: d.customFields?.party || d.party || d.partyId || d.customerId,
            date: d.invoiceDate || d.date,
            totalAmount: parseFloat(d.totalAmount || d.amount || 0),
            number: d.invoiceNumber || d.number || doc.id
          };
        }).filter(inv => {
          const d = parseDate(inv.date);
          return d && (!dateRange?.end || d <= parseDate(dateRange.end));
        });
        if (selectedParty) invoices = invoices.filter(i => i.partyId === selectedParty);

        // Fetch payments up to end date
        const paySnap = await getDocs(query(collection(db, `${base}/payments`), orderBy('paymentDate', 'asc')));
        const payments = paySnap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            partyId: d.partyId || d.party,
            date: d.paymentDate || d.date,
            total: parseFloat(d.totalAmount || d.amount || 0),
            allocations: d.allocations || [],
            advanceAllocations: d.advanceAllocations || []
          };
        }).filter(p => {
          const d = parseDate(p.date);
          return d && (!dateRange?.end || d <= parseDate(dateRange.end));
        });

        // Build per-invoice paid using allocations only (no FIFO yet), also track last payment date per invoice
        const invoicePaidMap = new Map();
        const invoiceLastPayDate = new Map();
        payments.forEach(p => {
          const payDate = parseDate(p.date);
          (p.allocations || []).forEach(a => {
            if (a.billType === 'invoice' && a.billId) {
              const amt = parseFloat(a.allocatedAmount || 0);
              invoicePaidMap.set(a.billId, (invoicePaidMap.get(a.billId) || 0) + amt);
              const prev = invoiceLastPayDate.get(a.billId);
              if (!prev || (payDate && payDate > prev)) {
                invoiceLastPayDate.set(a.billId, payDate);
              }
            }
          });
        });

        // Aggregate per party
        const partyAgg = new Map();
        invoices.forEach(inv => {
          if (!inv.partyId) return;
          const paid = invoicePaidMap.get(inv.id) || 0;
          const due = Math.max(0, (inv.totalAmount || 0) - paid);
          const lastPay = invoiceLastPayDate.get(inv.id) || null;
          const invInfo = {
            id: inv.id,
            number: inv.number,
            date: parseDate(inv.date),
            total: inv.totalAmount || 0,
            paid,
            balance: due,
            lastPaymentDate: lastPay
          };
          const entry = partyAgg.get(inv.partyId) || {
            partyId: inv.partyId,
            totalOutstanding: 0,
            invoices: [],
            lastPaidDateParty: null
          };
          entry.invoices.push(invInfo);
          if (due > 0) entry.totalOutstanding += due;
          partyAgg.set(inv.partyId, entry);
        });

        // Compute per-party derived metrics
        // Last paid date (any payment for party)
        const lastPaidDateByParty = new Map();
        payments.forEach(p => {
          const pid = p.partyId;
          const dt = parseDate(p.date);
          const prev = lastPaidDateByParty.get(pid);
          if (pid && dt && (!prev || dt > prev)) lastPaidDateByParty.set(pid, dt);
        });

        // Map to rows with names
        const rowsData = Array.from(partyAgg.values()).map(r => {
          const partyObj = (parties || []).find(p => p.id === r.partyId);
          // Outstanding invoices list
          const outstandingInvoices = (r.invoices || [])
            .filter(iv => iv.balance > 0)
            .sort((a, b) => (a.date || 0) - (b.date || 0));

          // Ageing metrics
          const lastPaidDateParty = lastPaidDateByParty.get(r.partyId) || null;
          const oldestOutstanding = outstandingInvoices[0] || null;
          const pendingRefDate = oldestOutstanding ? (oldestOutstanding.lastPaymentDate || oldestOutstanding.date) : null;

          return {
            partyId: r.partyId,
            partyName: partyObj?.firmName || partyObj?.name || r.partyId,
            totalOutstanding: r.totalOutstanding,
            outstandingCount: outstandingInvoices.length,
            outstandingInvoices,
            lastPaidDateParty,
            pendingRefDate
          };
        });

        const totalsCalc = rowsData.reduce((acc, r) => { acc.totalOutstanding += r.totalOutstanding; return acc; }, { totalOutstanding: 0 });
        setRows(rowsData);
        setTotals(totalsCalc);
      } catch (e) {
        console.error('Aging summary fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [db, userId, appId, dateRange, selectedParty, parties, setLoading]);

  const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
  const diffDays = (from) => {
    if (!from) return '—';
    const today = new Date();
    const ms = today.setHours(0,0,0,0) - new Date(from).setHours(0,0,0,0);
    return Math.max(0, Math.floor(ms / (1000*60*60*24)));
  };

  // Summary metrics
  const totalOutstandingBills = rows.reduce((acc, r) => acc + (r.outstandingCount || 0), 0);
  const avgAgeFromLastPaid = (() => {
    const vals = rows.map(r => r.lastPaidDateParty).filter(Boolean).map(d => diffDays(d)).filter(v => typeof v === 'number');
    if (vals.length === 0) return '—';
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  })();
  const avgAgeFromOldestPending = (() => {
    const vals = rows.map(r => r.pendingRefDate).filter(Boolean).map(d => diffDays(d)).filter(v => typeof v === 'number');
    if (vals.length === 0) return '—';
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  })();

  // Export/Print/Share
  const exportCSV = () => {
    const headers = ['Party', 'Outstanding', 'Outstanding Bills', 'Age From Last Paid (days)', 'Age From Oldest Pending (days)'];
    const lines = sortedData.map(r => [
      r.partyName,
      r.totalOutstanding,
      r.outstandingCount || 0,
      typeof diffDays(r.lastPaidDateParty) === 'number' ? diffDays(r.lastPaidDateParty) : '',
      typeof diffDays(r.pendingRefDate) === 'number' ? diffDays(r.pendingRefDate) : ''
    ]);
    const csv = [headers.join(','), ...lines.map(l => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aging_summary_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Letterhead
      const formatCurrencyPdf = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text(companyDetails?.firmName || 'Company Name', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      let y = 30;
      let line1 = '';
      if (companyDetails?.address) line1 += companyDetails.address;
      if (companyDetails?.city && companyDetails?.state) {
        if (line1) line1 += ', ';
        line1 += `${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}`;
      }
      if (line1) { doc.text(line1, pageWidth / 2, y, { align: 'center' }); y += 5; }
      let line2 = '';
      if (companyDetails?.gstin) line2 += `GSTIN: ${companyDetails.gstin}`;
      if (companyDetails?.contactNumber) { if (line2) line2 += ' | '; line2 += `Phone: ${companyDetails.contactNumber}`; }
      if (line2) { doc.text(line2, pageWidth / 2, y, { align: 'center' }); y += 5; }
      y += 8;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('AGING REPORT (SUMMARY)', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`As on: ${new Date(dateRange.end).toLocaleDateString('en-IN')}`, 14, y);
      y += 6;
      doc.text(`Total Outstanding: ${formatCurrencyPdf(totals.totalOutstanding)} | Total Bills: ${rows.reduce((a,b)=>a+(b.outstandingCount||0),0)}`, 14, y);
      y += 8;

      const data = sortedData.map(r => [
        r.partyName,
        formatCurrencyPdf(r.totalOutstanding),
        r.outstandingCount || 0,
        typeof diffDays(r.lastPaidDateParty) === 'number' ? diffDays(r.lastPaidDateParty) : '-',
        typeof diffDays(r.pendingRefDate) === 'number' ? diffDays(r.pendingRefDate) : '-'
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Party', 'Outstanding', '# Outstanding Bills', 'Age From Last Paid', 'Age From Oldest Pending']],
        body: data,
        styles: { fontSize: 9 },
        theme: 'grid'
      });
      doc.save(`aging_summary_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF export error:', e);
      alert('PDF export failed.');
    }
  };

  const printReport = () => {
    const w = window.open('', '_blank');
    const rowsHtml = sortedData.map(r => `
      <tr>
        <td style="text-align:center;">${r.partyName}</td>
        <td style="text-align:center;">Rs ${Number(r.totalOutstanding||0).toLocaleString('en-IN')}</td>
        <td style="text-align:center;">${r.outstandingCount || 0}</td>
        <td style="text-align:center;">${typeof diffDays(r.lastPaidDateParty) === 'number' ? diffDays(r.lastPaidDateParty) : '-'}</td>
        <td style="text-align:center;">${typeof diffDays(r.pendingRefDate) === 'number' ? diffDays(r.pendingRefDate) : '-'}</td>
      </tr>`).join('');
    w.document.write(`
      <html><head><title>Aging Summary</title>
      <style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}</style>
      </head><body>
      <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #333;padding-bottom:8px;">
        <div style="font-size:20px;font-weight:bold;">${companyDetails?.firmName || 'Company Name'}</div>
        <div style="font-size:12px;color:#555;">${companyDetails?.address || ''}${companyDetails?.city && companyDetails?.state ? `, ${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}` : ''}</div>
        <div style="font-size:12px;color:#555;">${companyDetails?.gstin ? `GSTIN: ${companyDetails.gstin}` : ''}${companyDetails?.gstin && companyDetails?.contactNumber ? ' | ' : ''}${companyDetails?.contactNumber ? `Phone: ${companyDetails.contactNumber}` : ''}</div>
      </div>
      <h3 style="margin:0 0 12px;text-align:center;">AGING REPORT (SUMMARY)</h3>
      <div style="margin-bottom:8px;">As on: ${new Date(dateRange.end).toLocaleDateString('en-IN')}</div>
      <table>
        <thead><tr>
          <th>Party</th><th>Outstanding</th><th># Outstanding Bills</th><th>Age From Last Paid</th><th>Age From Oldest Pending</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const shareLink = () => {
    const shareData = {
      title: 'Aging Report (Summary)',
      text: `Total Outstanding: Rs ${Number(totals.totalOutstanding||0).toLocaleString('en-IN')} | Bills: ${totalOutstandingBills}`,
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      const url = `https://wa.me/?text=${encodeURIComponent(`${shareData.title}\n${shareData.text}\n${shareData.url}`)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Aging Report (Summary)</h2>
          <p className="text-gray-600">As on: {new Date(dateRange.end).toLocaleDateString('en-IN')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm">📄 Export PDF</button>
          <button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm">📊 Export Excel</button>
          <button onClick={printReport} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm">🖨️ Print</button>
          <ShareButton onExportPDF={exportPDF} onExportExcel={exportCSV} onShareLink={shareLink} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-sm text-red-600 font-medium">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totals.totalOutstanding)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-sm text-blue-600 font-medium">Total Outstanding Bills</div>
          <div className="text-2xl font-bold text-blue-800">{totalOutstandingBills}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <div className="text-sm text-yellow-700 font-medium">Avg Age: From Last Paid</div>
          <div className="text-2xl font-bold text-yellow-800">{typeof avgAgeFromLastPaid === 'number' ? `${avgAgeFromLastPaid} days` : '—'}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-sm text-green-700 font-medium">Avg Age: From Oldest Pending</div>
          <div className="text-2xl font-bold text-green-800">{typeof avgAgeFromOldestPending === 'number' ? `${avgAgeFromOldestPending} days` : '—'}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader columnKey="partyName" label="Party" onSort={handleSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="totalOutstanding" label="Outstanding" onSort={handleSort} sortConfig={sortConfig} />
                <SortableHeader columnKey="outstandingCount" label="# Outstanding Bills" onSort={handleSort} sortConfig={sortConfig} />
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Age: From Last Paid</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Age: From Oldest Pending</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.map((r) => (
                <tr key={r.partyId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600">{r.partyName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-semibold">{formatCurrency(r.totalOutstanding)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <button
                      className="text-blue-600 underline hover:text-blue-800"
                      onClick={() => { setModalParty(r); setShowPartyBillsModal(true); setSelectedInvoice(null); }}
                      disabled={(r.outstandingCount || 0) === 0}
                    >
                      {r.outstandingCount || 0}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{diffDays(r.lastPaidDateParty)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{diffDays(r.pendingRefDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls {...pagination} />
      </div>

      {rows.length === 0 && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No data</div>
          <p className="text-gray-400">No outstanding invoices found as on the selected date.</p>
        </div>
      )}

      {/* Party Bills Modal */}
      {showPartyBillsModal && modalParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowPartyBillsModal(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4">Outstanding Bills - {modalParty.partyName}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Bill No</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Balance</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Last Payment</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(modalParty.outstandingInvoices || []).map((iv) => (
                    <tr key={iv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-center text-blue-600 underline cursor-pointer" onClick={() => setSelectedInvoice(iv)}>
                        {iv.number || iv.id}
                      </td>
                      <td className="px-4 py-2 text-center">{formatDate(iv.date)}</td>
                      <td className="px-4 py-2 text-center">{formatCurrency(iv.total)}</td>
                      <td className="px-4 py-2 text-center">{formatCurrency(iv.paid)}</td>
                      <td className="px-4 py-2 text-center text-red-600 font-semibold">{formatCurrency(iv.balance)}</td>
                      <td className="px-4 py-2 text-center">{formatDate(iv.lastPaymentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedInvoice && (
              <div className="mt-4 p-3 bg-gray-50 rounded border">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Bill Details: {selectedInvoice.number}</h4>
                  <button className="text-sm text-gray-600" onClick={() => setSelectedInvoice(null)}>Close</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><strong>Date:</strong> {formatDate(selectedInvoice.date)}</div>
                  <div><strong>Total:</strong> {formatCurrency(selectedInvoice.total)}</div>
                  <div><strong>Paid:</strong> {formatCurrency(selectedInvoice.paid)}</div>
                  <div><strong>Balance:</strong> {formatCurrency(selectedInvoice.balance)}</div>
                  <div><strong>Last Payment:</strong> {formatDate(selectedInvoice.lastPaymentDate)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgingReport; 