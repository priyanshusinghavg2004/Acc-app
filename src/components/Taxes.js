import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import GSTSummaryReport from './Reports/GSTSummaryReport';
import HsnGstSummaryReport from './Reports/HsnGstSummaryReport';
import TaxPaymentsTab from './Taxes/TaxPaymentsTab';

function getCurrentFinancialYearRange() {
  const now = new Date();
  const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return { start: new Date(year, 3, 1), end: new Date(year + 1, 2, 31, 23, 59, 59, 999) };
}

const Taxes = ({ db, userId, appId, isAuthReady }) => {
  const location = useLocation();
  const [selectedReport, setSelectedReport] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const tab = params.get('tab');
      return tab || 'tax-payments';
    } catch {
      return 'tax-payments';
    }
  });
  const [dateRange, setDateRange] = useState(() => {
    const r = getCurrentFinancialYearRange();
    return { start: new Date(r.start), end: new Date(r.end) };
  });
  const [financialYear, setFinancialYear] = useState(new Date().getFullYear());
  const [selectedParty, setSelectedParty] = useState('');
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !userId || !appId) return;
    const partiesQuery = query(collection(db, `artifacts/${appId}/users/${userId}/parties`), orderBy('firmName', 'asc'));
    const unsub = onSnapshot(partiesQuery, (snap) => setParties(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [db, userId, appId, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !userId || !appId) return;
    const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
    const unsub = onSnapshot(companyDocRef, (docSnap) => { if (docSnap.exists()) setCompanyDetails(docSnap.data()); });
    return () => unsub();
  }, [db, userId, appId, isAuthReady]);

  useEffect(() => {
    const start = new Date(financialYear, 3, 1);
    const end = new Date(financialYear + 1, 2, 31, 23, 59, 59, 999);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) setDateRange({ start, end });
  }, [financialYear]);

  const reportTypes = useMemo(() => {
    const gstType = (companyDetails?.gstinType || '').toLowerCase();
    const base = [{ value: 'tax-payments', label: 'Tax Payments' }];
    const addRegular = () => {
      base.push({ value: 'gstr1-regular', label: 'GSTR-1 (Monthly/Quarterly)' });
      base.push({ value: 'gstr3b-regular', label: 'GSTR-3B' });
      base.push({ value: 'hsn-regular', label: 'HSN-wise GST Summary (Regular)' });
    };
    const addComposition = () => {
      base.push({ value: 'gst-summary-composition', label: 'GST Summary (Composition)' });
      base.push({ value: 'hsn-composition', label: 'HSN-wise GST Summary (Composition)' });
    };
    if (!companyDetails) {
      addRegular();
      addComposition();
    } else if (gstType === 'regular') {
      addRegular();
    } else if (gstType === 'composition') {
      addComposition();
    }
    return base;
  }, [companyDetails]);

  useEffect(() => {
    if (!reportTypes.length) return;
    const exists = reportTypes.some(rt => rt.value === selectedReport);
    if (!exists) setSelectedReport(reportTypes[0].value);
  }, [reportTypes]);

  // Keep tab and basic filters in URL
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (params.get('tab') !== selectedReport) params.set('tab', selectedReport);
    if (dateRange?.start) params.set('start', new Date(dateRange.start).toISOString().slice(0,10));
    if (dateRange?.end) params.set('end', new Date(dateRange.end).toISOString().slice(0,10));
    params.set('fy', String(financialYear));
    if (selectedParty) params.set('party', selectedParty); else params.delete('party');
    const base = window.location.hash.split('?')[0] || '#/taxes';
    const next = `${base}?${params.toString()}`;
    if (window.location.hash !== next) window.location.hash = next;
  }, [hydrated, selectedReport, dateRange, financialYear, selectedParty]);

  // Read URL -> state (supports direct links and navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const tab = params.get('tab');
    if (tab && tab !== selectedReport) setSelectedReport(tab);
    const s = params.get('start');
    const e = params.get('end');
    const fy = params.get('fy');
    const party = params.get('party') || '';
    if (s && e) {
      const sd = new Date(s); const ed = new Date(e);
      if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) setDateRange({ start: sd, end: ed });
    }
    if (fy && !isNaN(parseInt(fy,10))) setFinancialYear(parseInt(fy,10));
    setSelectedParty(party);
    if (!hydrated) setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for hash changes to update selected tab and filters during active session
  useEffect(() => {
    const onHashChange = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const tab = params.get('tab');
      if (tab && tab !== selectedReport) setSelectedReport(tab);
      const s = params.get('start');
      const e = params.get('end');
      const fy = params.get('fy');
      const party = params.get('party') || '';
      if (s && e) {
        const sd = new Date(s); const ed = new Date(e);
        if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
          if (
            !dateRange ||
            new Date(dateRange.start).toDateString() !== sd.toDateString() ||
            new Date(dateRange.end).toDateString() !== ed.toDateString()
          ) {
            setDateRange({ start: sd, end: ed });
          }
        }
      }
      const fyNum = parseInt(fy || '', 10);
      if (!isNaN(fyNum) && fyNum !== financialYear) setFinancialYear(fyNum);
      if (party !== selectedParty) setSelectedParty(party);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [selectedReport, dateRange, financialYear, selectedParty]);

  const commonProps = useMemo(() => ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading, isAuthReady, companyDetails }), [db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, isAuthReady, companyDetails]);

  const renderReport = () => {
    switch (selectedReport) {
      case 'gstr1-regular':
        return <GSTSummaryReport {...commonProps} forcedGstType="regular" reportTypeDefault="gstr1" />;
      case 'gstr3b-regular':
        return <GSTSummaryReport {...commonProps} forcedGstType="regular" reportTypeDefault="gstr3b" />;
      case 'gst-summary-composition':
        return <GSTSummaryReport {...commonProps} forcedGstType="composition" reportTypeDefault="gstr1" />;
      case 'hsn-composition':
        return <HsnGstSummaryReport {...commonProps} forcedGstType="composition" />;
      case 'hsn-regular':
        return <HsnGstSummaryReport {...commonProps} forcedGstType="regular" />;
      case 'tax-payments':
        return <TaxPaymentsTab {...commonProps} />;
      default:
        return <div className="p-6 text-gray-600">Select a report to view.</div>;
    }
  };

  return (
    <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-6" id="taxes-container">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4 lg:mb-0">Taxes Dashboard</h1>
        </div>

        {/* Filters Panel */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
            {/** Safe formatter to avoid Invalid Date during render */}
            {(() => null)()}
            
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
                <input type="date" value={(dateRange?.start && !isNaN(new Date(dateRange.start).getTime())) ? new Date(dateRange.start).toISOString().split('T')[0] : ''} onChange={(e)=>{
                  const v = e.target.value; if (!v) return; const d = new Date(v);
                  if (!isNaN(d.getTime())) setDateRange(prev=>({ ...prev, start: d }));
                }} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" />
                <span className="text-gray-500 self-center">to</span>
                <input type="date" value={(dateRange?.end && !isNaN(new Date(dateRange.end).getTime())) ? new Date(dateRange.end).toISOString().split('T')[0] : ''} onChange={(e)=>{
                  const v = e.target.value; if (!v) return; const d = new Date(v);
                  if (!isNaN(d.getTime())) setDateRange(prev=>({ ...prev, end: d }));
                }} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" />
              </div>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">Financial Year</label>
              <select value={financialYear} onChange={(e)=>setFinancialYear(parseInt(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}-{year+1}</option>
                ))}
              </select>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">Party (Optional)</label>
              <select value={selectedParty} onChange={(e)=>setSelectedParty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0">
                <option value="">All Parties</option>
                {parties.map(p => (<option key={p.id} value={p.id}>{p.firmName || p.partyName}</option>))}
              </select>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
              {reportTypes.length ? (
                <select value={selectedReport} onChange={(e)=>setSelectedReport(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0">
                  {reportTypes.map(rt => (<option key={rt.value} value={rt.value}>{rt.label}</option>))}
                </select>
              ) : (
                <select disabled className="w-full border border-gray-300 bg-gray-100 text-gray-500 rounded-md px-3 py-2 text-sm min-w-0">
                  <option>Loading report types…</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white border border-gray-200 rounded-lg">
          {renderReport()}
        </div>
      </div>
    </div>
  );
};
export default Taxes;