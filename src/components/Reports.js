import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { useTableSort } from '../utils/tableSort';
import { useTablePagination } from '../utils/tablePagination';
import PaginationControls from '../utils/PaginationControls';
import { REPORT_CONSTANTS } from './Reports/ReportConstants';

// Report Components
import PartywiseSalesReport from './Reports/PartywiseSalesReport';
import CustomerLedgerReport from './Reports/CustomerLedgerReport';
import InvoiceCollectionReport from './Reports/InvoiceCollectionReport';
import PaymentRegisterReport from './Reports/PaymentRegisterReport';
import AgingReport from './Reports/AgingReport';
import ItemwiseSalesReport from './Reports/ItemwiseSalesReport';
import PurchaseBillsSummary from './Reports/BillsReport';
import StockReport from './Reports/StockReport';
// GST reports moved under Taxes section
import ProfitLossReport from './Reports/ProfitLossReport';
import BalanceSheetReport from './Reports/BalanceSheetReport';
import TrialBalanceReport from './Reports/TrialBalanceReport';
import CashFlowReport from './Reports/CashFlowReport';

// Helper to get current financial year start and end
function getCurrentFinancialYearRange() {
  const now = new Date();
  const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const start = new Date(year, 3, 1); // April 1
  const end = new Date(year + 1, 2, 31, 23, 59, 59, 999); // March 31
  return { start, end };
}

const Reports = ({ db, userId, isAuthReady, appId }) => {
  const [selectedReport, setSelectedReport] = useState('partywise-sales');
  const [dateRange, setDateRange] = useState(getCurrentFinancialYearRange());
  const [financialYear, setFinancialYear] = useState(new Date().getFullYear());
  const [selectedParty, setSelectedParty] = useState('');
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companyDetails, setCompanyDetails] = useState(null);

  // Sync date range when financial year changes
  useEffect(() => {
    if (!financialYear) return;
    const start = new Date(financialYear, 3, 1); // April 1 of selected FY
    const end = new Date(financialYear + 1, 2, 31, 23, 59, 59, 999); // March 31 of next year
    setDateRange({ start, end });
  }, [financialYear]);

  // Fetch parties for filters
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const fetchParties = async () => {
      try {
        const partiesQuery = query(
          collection(db, `artifacts/acc-app-e5316/users/${userId}/parties`),
          orderBy('firmName', 'asc')
        );
        
        const unsubscribe = onSnapshot(partiesQuery, (snapshot) => {
          const partiesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setParties(partiesData);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error fetching parties:', error);
      }
    };

    fetchParties();
  }, [db, userId, isAuthReady]);

  // Fetch company details
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const companyDocRef = doc(db, `artifacts/acc-app-e5316/users/${userId}/companyDetails`, 'myCompany');
    const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data());
      }
    });
    
    return () => unsubscribe();
  }, [db, userId, isAuthReady]);

  // Date range presets
  const datePresets = REPORT_CONSTANTS.DATE_PRESETS;

  const handleDatePreset = (preset) => {
    const now = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'this-week':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        start = new Date(now.getFullYear(), now.getMonth(), diff);
        end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'this-quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
        break;
      case 'this-year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last-quarter':
        const lastQuarter = Math.floor((now.getMonth() - 1) / 3);
        start = new Date(now.getFullYear(), lastQuarter * 3, 1);
        end = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 0, 23, 59, 59);
        break;
      case 'last-year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
      default:
        return;
    }

    setDateRange({ start, end });
  };

  // Filter report types based on company GST type
  const reportTypes = useMemo(() => {
    const all = REPORT_CONSTANTS.REPORT_TYPES;
    const type = (companyDetails?.gstinType || '').toLowerCase();
    return all.filter(rt => {
      if (rt.value === 'gst-summary-regular') return type === 'regular';
      if (rt.value === 'gst-summary-composition') return type === 'composition';
      if (rt.value === 'gst-hsn-summary-regular') return type === 'regular';
      if (rt.value === 'gst-hsn-summary-composition') return type === 'composition';
      return true;
    });
  }, [companyDetails]);



  // Memoize common props to prevent infinite re-renders
  const commonProps = useMemo(() => ({
    db,
    userId,
    appId,
    dateRange,
    financialYear,
    selectedParty,
    parties,
    loading,
    setLoading,
    isAuthReady,
    companyDetails
  }), [db, userId, appId, dateRange, financialYear, selectedParty, loading, isAuthReady, companyDetails]); // Removed parties from dependency array

  const renderReportComponent = () => {
    switch (selectedReport) {
      case 'partywise-sales':
        return <PartywiseSalesReport {...commonProps} />;
      case 'customer-ledger':
        return <CustomerLedgerReport db={db} userId={userId} dateRange={dateRange} selectedParty={selectedParty} parties={parties} loading={loading} setLoading={setLoading} />;
      case 'invoice-collection':
        return <InvoiceCollectionReport {...commonProps} />;
      case 'payment-register':
        return <PaymentRegisterReport {...commonProps} />;
      case 'aging-report':
        return <AgingReport {...commonProps} />;
      case 'itemwise-sales':
        return <ItemwiseSalesReport {...commonProps} />;
      case 'purchase-bills-summary':
        return <PurchaseBillsSummary {...commonProps} />;
      case 'stock-report':
        return <StockReport {...commonProps} />;
      case 'profit-loss':
        return <ProfitLossReport {...commonProps} />;
      case 'balance-sheet':
        return <BalanceSheetReport {...commonProps} />;
      case 'trial-balance':
        return <TrialBalanceReport {...commonProps} />;
      case 'cash-flow':
        return <CashFlowReport {...commonProps} />;
      default:
        return <PartywiseSalesReport {...commonProps} />;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center text-gray-600">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4 lg:mb-0">Reports Dashboard</h1>
          

        </div>

        {/* Report Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Report Type
          </label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="w-full lg:w-64 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {reportTypes.map((report) => (
              <option key={report.value} value={report.value}>
                {report.icon} {report.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filters Panel */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
            {/* Date Range */}
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
                <input
                  type="date"
                  value={dateRange.start.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                />
                <span className="text-gray-500 self-center">to</span>
                <input
                  type="date"
                  value={dateRange.end.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                />
              </div>
            </div>
            {/* Date Presets */}
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Presets
              </label>
              <select
                onChange={(e) => handleDatePreset(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              >
                <option value="">Select Preset</option>
                {datePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Financial Year */}
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Financial Year
              </label>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}-{year + 1}</option>
                ))}
              </select>
            </div>
            {/* Party Filter */}
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Party (Optional)
              </label>
              <select
                value={selectedParty}
                onChange={(e) => setSelectedParty(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              >
                <option value="">All Parties</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.firmName || party.partyName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white border border-gray-200 rounded-lg">
          {renderReportComponent()}
        </div>
      </div>
    </div>
  );
};

export default Reports; 