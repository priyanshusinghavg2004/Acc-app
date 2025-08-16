import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency } from './CommonComponents';
import GlobalExportButtons from '../GlobalExportButtons';

const HsnGstSummaryReport = ({ db, userId, appId, dateRange, selectedParty, parties, loading, setLoading, forcedGstType, companyDetails }) => {
  const [rows, setRows] = useState([]);
  const gstType = forcedGstType || ((companyDetails?.gstinType || '').toLowerCase() === 'composition' ? 'composition' : 'regular');

  useEffect(() => {
    const load = async () => {
      if (!db || !userId || !appId) return;
      setLoading(true);
      try {
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];

        const [salesSnap, purchaseSnap, itemsSnap] = await Promise.all([
          getDocs(query(collection(db, `artifacts/${appId}/users/${userId}/salesBills`), where('invoiceDate', '>=', startStr), where('invoiceDate', '<=', endStr), orderBy('invoiceDate', 'desc'))),
          getDocs(query(collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`), where('billDate', '>=', startStr), where('billDate', '<=', endStr), orderBy('billDate', 'desc'))),
          getDocs(collection(db, `artifacts/${appId}/users/${userId}/items`))
        ]);

        const itemMeta = {};
        itemsSnap.forEach(d => {
          const it = d.data() || {};
          itemMeta[d.id] = { hsn: it.hsnCode || '', gst: parseFloat(it.gstPercentage) || 0, name: it.itemName || '' , itemType: it.itemType || 'Goods', compositionGstRate: parseFloat(it.compositionGstRate) || 0 };
        });

        let sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        let purchases = purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (selectedParty) {
          sales = sales.filter(s => (s.party || s.partyId) === selectedParty);
          purchases = purchases.filter(p => (p.party || p.partyId) === selectedParty);
        }

        const groups = new Map(); // key: hsn|rate
        const add = (hsn, rate, taxable, cgst, sgst, igst, itemId, itemName) => {
          const key = `${hsn}|${rate}`;
          if (!groups.has(key)) groups.set(key, { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, items: new Map() });
          const g = groups.get(key);
          g.taxable += taxable; g.cgst += cgst; g.sgst += sgst; g.igst += igst;
          if (itemId) {
            if (!g.items.has(itemId)) g.items.set(itemId, { itemId, name: itemName || '-', taxable: 0, cgst: 0, sgst: 0, igst: 0 });
            const it = g.items.get(itemId);
            it.taxable += taxable; it.cgst += cgst; it.sgst += sgst; it.igst += igst;
          }
        };

        const addFromRows = (billRows, isOutward) => {
          const list = Array.isArray(billRows) ? billRows : [];
          for (const r of list) {
            const base = parseFloat(r.amount) || 0;
            const meta = itemMeta[r.item] || {};
            const regularRate = (parseFloat(r.sgst) || 0) + (parseFloat(r.cgst) || 0) + (parseFloat(r.igst) || 0) || meta.gst || 0;
            let compRate = meta.compositionGstRate;
            if (!compRate) compRate = meta?.itemType === 'Service' ? 6 : 1;
            const rate = gstType === 'composition' ? compRate : regularRate;
            const hsn = r.hsn || meta.hsn || '';
            let cg, sg, ig;
            if (gstType === 'composition') {
              const totalGst = (base * (rate || 0)) / 100;
              cg = totalGst / 2;
              sg = totalGst / 2;
              ig = 0;
            } else {
              cg = ((parseFloat(r.cgst) || 0) * base) / 100;
              sg = ((parseFloat(r.sgst) || 0) * base) / 100;
              ig = ((parseFloat(r.igst) || 0) * base) / 100;
            }
            add(hsn, rate, base, cg, sg, ig, r.item, meta.name);
          }
        };

        sales.forEach(s => addFromRows(s.rows || s.items, true));
        purchases.forEach(p => addFromRows(p.rows || p.items, false));

        const groupsArray = Array.from(groups.values()).map(g => ({
          ...g,
          items: Array.from(g.items.values())
        }));
        setRows(groupsArray);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [db, userId, appId, dateRange, selectedParty]);

  const { sortedData, sortConfig, handleSort } = useTableSort(rows, { key: 'hsn', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // Quick totals computed from filtered/sorted data (not just current page)
  const quickTotals = useMemo(() => {
    const base = sortedData;
    const taxable = base.reduce((s, r) => s + (parseFloat(r.taxable) || 0), 0);
    const cgst = base.reduce((s, r) => s + (parseFloat(r.cgst) || 0), 0);
    const sgst = base.reduce((s, r) => s + (parseFloat(r.sgst) || 0), 0);
    const igst = base.reduce((s, r) => s + (parseFloat(r.igst) || 0), 0);
    const totalGST = cgst + sgst + (gstType === 'regular' ? igst : 0);
    return { taxable, cgst, sgst, igst, totalGST, groups: base.length };
  }, [sortedData, gstType]);


  const buildExportRows = () => {
    const rows = [];
    sortedData.forEach(g => {
      const totalGST = (g.cgst||0)+(g.sgst||0)+(gstType==='regular'?(g.igst||0):0);
      rows.push({ hsn: g.hsn || '-', item: (g.items?.length>1?'Multiple items':(g.items?.[0]?.name||'-')), rate: (g.rate||0).toFixed(2)+'%', taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: gstType==='regular'?g.igst:0, total: totalGST });
      if (Array.isArray(g.items) && g.items.length > 1) {
        g.items.forEach(it => {
          rows.push({ _isSub:true, hsn:'', item: it.name, rate: (g.rate||0).toFixed(2)+'%', taxable: it.taxable, cgst: it.cgst, sgst: it.sgst, igst: gstType==='regular'?it.igst:0, total: (it.cgst||0)+(it.sgst||0)+(gstType==='regular'?(it.igst||0):0) });
        });
      }
    });
    // Totals (only parent rows)
    const totals = rows.filter(r=>!r._isSub).reduce((acc,r)=>({
      taxable: acc.taxable + (parseFloat(r.taxable)||0),
      cgst: acc.cgst + (parseFloat(r.cgst)||0),
      sgst: acc.sgst + (parseFloat(r.sgst)||0),
      igst: acc.igst + (parseFloat(r.igst)||0),
      total: acc.total + (parseFloat(r.total)||0)
    }), {taxable:0,cgst:0,sgst:0,igst:0,total:0});
    rows.push({ hsn:'', item:'TOTAL', rate:'', ...totals });
    return rows;
  };

  // Prepare export data for GlobalExportButtons
  const getExportData = () => buildExportRows();

  const getExportColumns = () => [
    { key: 'hsn', label: 'HSN Code' },
    { key: 'item', label: 'Item' },
    { key: 'rate', label: 'GST Rate %' },
    { key: 'taxable', label: 'Taxable Amount' },
    { key: 'cgst', label: 'CGST' },
    { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' },
    { key: 'total', label: 'Total GST' }
  ];

  const getReportDetails = () => ({
    'Period': `${new Date(dateRange.start).toLocaleDateString('en-IN')} to ${new Date(dateRange.end).toLocaleDateString('en-IN')}`,
    'Total Taxable': quickTotals.taxable,
    'Total CGST': quickTotals.cgst,
    'Total SGST': quickTotals.sgst,
    'Total IGST': quickTotals.igst,
    'Total GST': quickTotals.totalGST,
    dateRange
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">HSN-wise GST Summary ({gstType === 'regular' ? 'Regular' : 'Composition'})</h2>
          <p className="text-gray-600">Period: {new Date(dateRange.start).toLocaleDateString('en-IN')} to {new Date(dateRange.end).toLocaleDateString('en-IN')}</p>
        </div>
        {/* Global Export/Print/Share Buttons */}
        <GlobalExportButtons
          data={getExportData()}
          columns={getExportColumns()}
          filename="HSN_GST"
          title="HSN-wise GST Summary"
          companyDetails={companyDetails}
          reportDetails={getReportDetails()}
          disabled={rows.length === 0}
        />
      </div>

      {/* Quick Totals */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gstType==='regular' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4 mb-6`}>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-800">Groups</div>
          <div className="text-2xl font-semibold text-blue-900">{quickTotals.groups}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-800">Total Taxable</div>
          <div className="text-2xl font-semibold text-green-900">{formatCurrency(quickTotals.taxable)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-800">Total GST</div>
          <div className="text-2xl font-semibold text-purple-900">{formatCurrency(quickTotals.totalGST)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-800">CGST</div>
          <div className="text-2xl font-semibold text-yellow-900">{formatCurrency(quickTotals.cgst)}</div>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg">
          <div className="text-sm text-pink-800">SGST</div>
          <div className="text-2xl font-semibold text-pink-900">{formatCurrency(quickTotals.sgst)}</div>
        </div>
        {gstType === 'regular' && (
          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="text-sm text-indigo-800">IGST</div>
            <div className="text-2xl font-semibold text-indigo-900">{formatCurrency(quickTotals.igst)}</div>
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader columnKey="hsn" label="HSN" onSort={handleSort} sortConfig={sortConfig} />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <SortableHeader columnKey="rate" label="GST %" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="taxable" label="Taxable" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="cgst" label="CGST" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="sgst" label="SGST" onSort={handleSort} sortConfig={sortConfig} />
              {gstType === 'regular' && (
                <SortableHeader columnKey="igst" label="IGST" onSort={handleSort} sortConfig={sortConfig} />
              )}
              <SortableHeader columnKey="total" label="Total GST" onSort={handleSort} sortConfig={sortConfig} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagination.currentData.map((g, i) => {
              const totalGST = (g.cgst || 0) + (g.sgst || 0) + (g.igst || 0);
              const hasMultiple = (g.items || []).length > 1;
              return (
                <React.Fragment key={g.hsn + '|' + g.rate + '|' + i}>
                  <tr>
                    <td className="px-6 py-3">{g.hsn || '-'}</td>
                    <td className="px-6 py-3">{hasMultiple ? 'Multiple items' : (g.items?.[0]?.name || '-')}</td>
                    <td className="px-6 py-3 text-right">{(g.rate || 0).toFixed(2)}%</td>
                    <td className="px-6 py-3 text-right">{formatCurrency(g.taxable)}</td>
                    <td className="px-6 py-3 text-right">{formatCurrency(g.cgst)}</td>
                    <td className="px-6 py-3 text-right">{formatCurrency(g.sgst)}</td>
                    {gstType === 'regular' && (
                      <td className="px-6 py-3 text-right">{formatCurrency(g.igst)}</td>
                    )}
                    <td className="px-6 py-3 text-right">{formatCurrency(totalGST)}</td>
                  </tr>
                  {hasMultiple && g.items.map((it, idx) => (
                    <tr key={g.hsn + '|' + g.rate + '|item|' + idx} className="bg-gray-50">
                      <td className="px-6 py-2 text-xs text-gray-500"></td>
                      <td className="px-6 py-2 text-xs text-gray-700">{it.name}</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{(g.rate || 0).toFixed(2)}%</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(it.taxable)}</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(it.cgst)}</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(it.sgst)}</td>
                      {gstType === 'regular' && (
                        <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(it.igst)}</td>
                      )}
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency((it.cgst||0)+(it.sgst||0)+(it.igst||0))}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <PaginationControls {...pagination} />
      </div>
    </div>
  );
};

export default HsnGstSummaryReport;


