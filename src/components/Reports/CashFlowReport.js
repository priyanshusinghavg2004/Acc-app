import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import GlobalExportButtons from '../GlobalExportButtons';

// Clean rebuild: Cash Flow + Daybook
// Mapping rules
// - Payment In: payments with receipt number prefix PRI or type === 'receipt'
// - Payment Out: payments with receipt number prefix PRP or type === 'payment'
// - Also Outflow: expenses and salaryPayments
// - Strict period filter (>= start, <= end). Opening balance fixed at 0 for the period.

const CashFlowReport = ({ db, userId, appId, dateRange, loading, setLoading }) => {
	const [rows, setRows] = useState([]);
	const [viewMode, setViewMode] = useState('cash'); // 'cash' | 'daybook'
	const [txnFilter, setTxnFilter] = useState('all'); // 'all' | 'cash' | 'bank'
  const [companyDetails, setCompanyDetails] = useState(null);

	const normalizeDate = (raw) => {
		if (!raw) return '';
		if (typeof raw === 'string' && raw.includes('/')) {
			const [dd, mm, yyyy] = raw.split('/');
			if (dd && mm && yyyy) return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
		}
		return raw;
	};

	const isInflow = (d) => {
		const rec = (d.receiptNumber || d.number || '').toString().toUpperCase();
		const t = String(d.type || '').toLowerCase();
		const docT = String(d.documentType || '').toLowerCase();
		return rec.startsWith('PRI') || t === 'receipt' || docT === 'sale' || docT === 'sales';
	};
	const isOutflow = (d) => {
		const rec = (d.receiptNumber || d.number || '').toString().toUpperCase();
		const t = String(d.type || '').toLowerCase();
		const docT = String(d.documentType || '').toLowerCase();
		return rec.startsWith('PRP') || t === 'payment' || docT === 'purchase' || docT === 'expense';
	};
	const modeOf = (m) => (String(m || '').toLowerCase().includes('cash') ? 'cash' : 'bank');

  useEffect(() => {
		const fetchData = async () => {
      if (!db || !userId || !appId) return;
      setLoading(true);
      try {
				// Default range: last 7 days including today, if not provided by parent
				const today = new Date();
				const d7 = new Date(today); d7.setDate(today.getDate() - 6);
				const startStr = new Date(dateRange?.start || d7).toISOString().split('T')[0];
				const endStr = new Date(dateRange?.end || today).toISOString().split('T')[0];

				// Company details (for letterhead)
				try {
					const compSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/companyDetails`));
					if (!compSnap.empty) setCompanyDetails(compSnap.docs[0].data());
				} catch {}

				// Payments within period
				const pq = query(
          collection(db, `artifacts/${appId}/users/${userId}/payments`),
					where('paymentDate', '>=', startStr), where('paymentDate', '<=', endStr), orderBy('paymentDate', 'asc')
				);
				const ps = await getDocs(pq);
				const payRows = ps.docs.map(d => {
					const v = d.data();
					const date = normalizeDate(v.paymentDate || v.date);
					const inflow = isInflow(v) ? Number(v.totalAmount || v.amount || 0) : 0;
					const outflow = isOutflow(v) ? Number(v.totalAmount || v.amount || 0) : 0;
					const docNo = v.receiptNumber || v.number || (inflow > 0 ? 'Receipt' : 'Payment');
					return inflow > 0 || outflow > 0 ? {
						id: `pay:${d.id}`,
						date,
						type: inflow > 0 ? 'Receipt' : 'Payment',
						inflow,
						outflow,
						docNo,
						partyName: v.partyName || v.partyFirmName || v.employeeName || '',
						mode: modeOf(v.paymentMode)
					} : null;
				}).filter(Boolean);

				// Expenses within period (Outflow)
				const eq = query(
					collection(db, `artifacts/${appId}/users/${userId}/expenses`),
					where('date', '>=', startStr), where('date', '<=', endStr), orderBy('date', 'asc')
				);
				const es = await getDocs(eq);
				const expRows = es.docs.map(d => {
					const v = d.data();
          return {
						id: `exp:${d.id}`,
						date: normalizeDate(v.date),
						type: 'Expense',
						inflow: 0,
						outflow: Number(v.amount || 0),
						docNo: v.expenseNumber || v.voucherNumber || v.referenceNo || v.head || v.category || 'Expense',
						partyName: v.partyName || v.head || v.category || '',
						mode: modeOf(v.paymentMode)
					};
				}).filter(r => r.outflow > 0);

				// Salary payments within period (Outflow)
				const sq = query(
					collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`),
					where('date', '>=', startStr), where('date', '<=', endStr), orderBy('date', 'asc')
				);
				const ss = await getDocs(sq);
				const salRows = ss.docs.map(d => {
					const v = d.data();
          return {
						id: `sal:${d.id}`,
						date: normalizeDate(v.date || v.paymentDate),
						type: 'Salary',
						inflow: 0,
						outflow: Number(v.netAmount || v.total || 0),
						docNo: v.month || v.employeeName || 'Salary',
						partyName: v.employeeName || 'Employee',
						mode: modeOf(v.paymentMode)
					};
				}).filter(r => r.outflow > 0);

				// Irregular labour/freelancer payments (Outflow)
				const iq = query(
					collection(db, `artifacts/${appId}/users/${userId}/irregularPayments`),
					where('date', '>=', startStr), where('date', '<=', endStr), orderBy('date', 'asc')
				);
				const isnap = await getDocs(iq);
				const irrRows = isnap.docs.map(d => {
					const v = d.data();
					return {
						id: `irr:${d.id}`,
						date: normalizeDate(v.date),
						type: 'Labour/Advance',
						inflow: 0,
						outflow: Number(v.amount || 0),
						docNo: v.paymentType || 'Irregular',
						partyName: v.personType === 'Employee' ? (v.employeeName || 'Employee') : (v.personName || v.personType || ''),
						mode: modeOf(v.paymentMode)
					};
				}).filter(r => r.outflow > 0);

				// Tax payments under Taxes module (Outflow)
				const tq = query(
					collection(db, `artifacts/${appId}/users/${userId}/taxPayments`),
					where('paymentDate', '>=', startStr), where('paymentDate', '<=', endStr), orderBy('paymentDate', 'asc')
				);
				const ts = await getDocs(tq);
				const taxRows = ts.docs.map(d => {
					const v = d.data();
					return {
						id: `tax:${d.id}`,
						date: normalizeDate(v.paymentDate),
						type: 'Tax',
          inflow: 0,
						outflow: Number(v.amount || 0),
						docNo: `${v.taxType||'TAX'} ${v.periodValue||''} ${v.reference||''}`.trim(),
						partyName: 'Tax',
						mode: modeOf(v.paymentMode)
					};
				}).filter(r => r.outflow > 0);

				const all = [...payRows, ...expRows, ...salRows, ...irrRows, ...taxRows].sort((a, b) => new Date(a.date) - new Date(b.date));
				let bal = 0;
				const withBal = all.map(r => { bal += (r.inflow || 0) - (r.outflow || 0); return { ...r, balance: bal }; });
				setRows(withBal);
			} catch (e) {
				console.error('CashFlow fetch error:', e);
				setRows([]);
      } finally {
        setLoading(false);
      }
    };
		fetchData();
	}, [db, userId, appId, dateRange]);

	// Sorting and pagination (filter before pagination)
	const { sortedData, sortConfig, handleSort } = useTableSort(rows, { key: 'date', direction: 'asc' });
	const filtered = sortedData.filter(r => txnFilter === 'all' ? true : r.mode === txnFilter);
	const pagination = useTablePagination(filtered, 25);

	const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
	const formatDate = (d) => new Date(d).toLocaleDateString('en-IN');

	const totals = filtered.reduce((acc, r) => ({ inflow: acc.inflow + (r.inflow || 0), outflow: acc.outflow + (r.outflow || 0) }), { inflow: 0, outflow: 0 });
	const summary = { inflow: totals.inflow, outflow: totals.outflow, net: totals.inflow - totals.outflow, closing: totals.inflow - totals.outflow };

	// Helpers for exports/print/share
	const effectiveRange = (() => {
		const today = new Date();
		const d7 = new Date(today); d7.setDate(today.getDate() - 6);
		const s = new Date(dateRange?.start || d7);
		const e = new Date(dateRange?.end || today);
		return { start: s, end: e };
	})();

	const buildExportRows = () => filtered.map(r => ({
		date: formatDate(r.date),
		docNo: r.docNo || '',
		type: r.type,
		party: r.partyName || '',
		inflow: Number(r.inflow || 0),
		outflow: Number(r.outflow || 0),
		balance: Number(r.balance || 0)
	}));

	const columnsDef = [
		{ key: 'date', label: 'Date', width: 26 },
		{ key: 'docNo', label: 'Doc No', width: 36 },
		{ key: 'type', label: 'Type', width: 22 },
		{ key: 'party', label: 'Party', width: 40 },
		{ key: 'inflow', label: 'Inflow', width: 24 },
		{ key: 'outflow', label: 'Outflow', width: 24 },
		{ key: 'balance', label: 'Balance', width: 26 }
	];

	// Prepare export data for GlobalExportButtons
	const getExportData = () => buildExportRows();

	const getExportColumns = () => columnsDef;

	const getReportDetails = () => ({
		'Period': `${effectiveRange.start.toLocaleDateString('en-IN')} to ${effectiveRange.end.toLocaleDateString('en-IN')}`,
		'Inflow': summary.inflow,
		'Outflow': summary.outflow,
		'Net': summary.net,
		dateRange: { start: effectiveRange.start, end: effectiveRange.end }
	});

  return (
    <div className="p-6">
      <div className="mb-6">
				<h2 className="text-xl font-bold text-gray-800 mb-2">Cash Flow / Daybook</h2>
				<p className="text-gray-600">Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}</p>
      </div>

      <div className="mb-6">
				<div className="flex items-start justify-between gap-4 flex-col md:flex-row">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:w-auto">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">View</label>
						<select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
							<option value="cash">Cash Flow</option>
							<option value="daybook">Daybook</option>
						</select>
					</div>
          <div>
						<label className="block text-sm font-medium text-gray-700 mb-2">Transaction Mode</label>
						<select value={txnFilter} onChange={(e) => setTxnFilter(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
							<option value="all">All</option>
							<option value="cash">Cash</option>
							<option value="bank">Bank</option>
            </select>
          </div>
        </div>
					{/* Global Export/Print/Share Buttons */}
					<GlobalExportButtons
						data={getExportData()}
						columns={getExportColumns()}
						filename="CASHFLOW"
						title="Cash Flow / Daybook"
						companyDetails={companyDetails}
						reportDetails={getReportDetails()}
						disabled={filtered.length === 0}
					/>
        </div>
      </div>

			{viewMode === 'cash' && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
					<div className="bg-green-50 p-4 rounded-lg"><div className="text-sm text-green-600 font-medium">Total Inflow</div><div className="text-2xl font-bold text-green-800">{formatCurrency(summary.inflow)}</div></div>
					<div className="bg-red-50 p-4 rounded-lg"><div className="text-sm text-red-600 font-medium">Total Outflow</div><div className="text-2xl font-bold text-red-800">{formatCurrency(summary.outflow)}</div></div>
					<div className="bg-blue-50 p-4 rounded-lg"><div className="text-sm text-blue-600 font-medium">Net Cash Flow</div><div className="text-2xl font-bold text-blue-800">{formatCurrency(summary.net)}</div></div>
					<div className="bg-yellow-50 p-4 rounded-lg"><div className="text-sm text-yellow-600 font-medium">Opening Balance</div><div className="text-2xl font-bold text-yellow-800">{formatCurrency(0)}</div></div>
					<div className="bg-purple-50 p-4 rounded-lg"><div className="text-sm text-purple-600 font-medium">Closing Balance</div><div className="text-2xl font-bold text-purple-800">{formatCurrency(summary.closing)}</div></div>
        </div>
      )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
								<SortableHeader columnKey="date" label="Date" onSort={handleSort} sortConfig={sortConfig} />
								<SortableHeader columnKey="docNo" label="Doc No" onSort={handleSort} sortConfig={sortConfig} />
								<SortableHeader columnKey="type" label="Type" onSort={handleSort} sortConfig={sortConfig} />
								<SortableHeader columnKey="partyName" label="Party" onSort={handleSort} sortConfig={sortConfig} />
								<SortableHeader columnKey="inflow" label="Inflow" onSort={handleSort} sortConfig={sortConfig} />
								<SortableHeader columnKey="outflow" label="Outflow" onSort={handleSort} sortConfig={sortConfig} />
								<SortableHeader columnKey="balance" label="Balance" onSort={handleSort} sortConfig={sortConfig} />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
							{pagination.currentData.map((r, idx) => (
								<tr key={r.id || idx} className="hover:bg-gray-50">
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(r.date)}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700">{r.docNo || '-'}</td>
									<td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 rounded text-xs font-medium ${r.inflow>0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.type}</span></td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.partyName || '-'}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{r.inflow>0?formatCurrency(r.inflow):'-'}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{r.outflow>0?formatCurrency(r.outflow):'-'}</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls {...pagination} />
        </div>

			{filtered.length === 0 && !loading && (
				<div className="text-center py-8"><div className="text-gray-500 text-lg mb-2">No entries found</div></div>
      )}
    </div>
  );
};

export default CashFlowReport; 

