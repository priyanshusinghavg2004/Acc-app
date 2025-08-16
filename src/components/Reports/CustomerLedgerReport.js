import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency, formatDate } from './CommonComponents';
import GlobalExportButtons from '../GlobalExportButtons';

const CustomerLedgerReport = ({ db, userId, dateRange, selectedParty, parties, loading, setLoading }) => {
  const [ledgerData, setLedgerData] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [showQuickSummary, setShowQuickSummary] = useState(false);
  const [quickSummaryEntry, setQuickSummaryEntry] = useState(null);
  const [itemNames, setItemNames] = useState({});
  const [totals, setTotals] = useState({
    totalDebit: 0,
    totalCredit: 0,
    totalOutstanding: 0
  });
  const [companyDetails, setCompanyDetails] = useState(null);

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(ledgerData, { key: 'date', direction: 'asc' });
  const pagination = useTablePagination(sortedData, 25);

  // ESC key handler for closing modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showQuickSummary) {
          console.log('ESC: Closing Quick Summary modal');
          setShowQuickSummary(false);
          setQuickSummaryEntry(null);
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

  // Prepare export data for GlobalExportButtons
  const getExportData = () => {
    if (!selectedParty) return [];
    
    const data = sortedData.map(row => ({
      date: formatDate(row.date),
      type: row.type,
      refNo: row.refNo,
      description: row.description,
      debit: row.debit > 0 ? row.debit : 0,
      credit: row.credit > 0 ? row.credit : 0,
      balance: row.balance
    }));
    
    // Add totals row
    if (ledgerData.length > 0) {
      data.push({
        date: 'TOTALS:',
        type: '',
        refNo: '',
        description: '',
        debit: totals.totalDebit,
        credit: totals.totalCredit,
        balance: totals.totalOutstanding
      });
    }
    
    return data;
  };

  const getExportColumns = () => [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'refNo', label: 'Ref No' },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit' },
    { key: 'credit', label: 'Credit' },
    { key: 'balance', label: 'Balance (Rs)' }
  ];

  const getReportDetails = () => ({
    'Party': selectedParty ? `${parties.find(p => p.id === selectedParty)?.firmName || 'N/A'} (${parties.find(p => p.id === selectedParty)?.partyType || 'N/A'})` : 'N/A',
    'Period': `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
    'Total Debit': totals.totalDebit,
    'Total Credit': totals.totalCredit,
    'Outstanding': totals.totalOutstanding >= 0 
      ? `+${totals.totalOutstanding.toLocaleString()} (Receivable)` 
      : `-${Math.abs(totals.totalOutstanding).toLocaleString()} (Payable)`,
    dateRange
  });

  // Handle entry click for quick summary
  const handleEntryClick = async (entry) => {
    setQuickSummaryEntry(entry);
    setShowQuickSummary(true);
    
    // Fetch item names for this entry if it has items
    if (entry.items && entry.items.length > 0) {
      const itemIds = entry.items.map(item => item.item || item.id || item.itemId || item.productId).filter(Boolean);
      console.log('Item IDs to fetch:', itemIds);
      if (itemIds.length > 0) {
        const names = await fetchItemNames(itemIds);
        console.log('Fetched item names:', names);
        setItemNames(names);
      }
    }
  };

  // Fetch company details
  useEffect(() => {
    if (!db || !userId) return;
    
    const companyDocRef = doc(db, `artifacts/acc-app-e5316/users/${userId}/companyDetails`, 'myCompany');
    const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data());
      }
    });
    
    return () => unsubscribe();
  }, [db, userId]);

  // Fetch ledger data
  useEffect(() => {
    console.log('CustomerLedgerReport useEffect triggered:', {
      db: !!db,
      userId,
      selectedParty,
      partiesCount: parties.length
    });
    
    if (!db || !userId || !selectedParty) {
      setLedgerData([]);
      setTotals({ totalDebit: 0, totalCredit: 0, totalOutstanding: 0 });
      return;
    }

    setLoading(true);
    
    const fetchLedgerData = async () => {
      try {
        const basePath = `artifacts/acc-app-e5316/users/${userId}`;
        
        // Fetch sales bills - simplified to avoid complex index requirements
        const salesQuery = query(
          collection(db, `${basePath}/salesBills`),
          where('partyId', '==', selectedParty)
        );
        
        // Also try alternative collection names
        const salesQueryAlt = query(
          collection(db, `${basePath}/sales`),
          where('partyId', '==', selectedParty)
        );
        
        // Try alternative party ID field names
        const salesQueryAlt2 = query(
          collection(db, `${basePath}/salesBills`),
          where('party', '==', selectedParty)
        );
        
        const salesQueryAlt3 = query(
          collection(db, `${basePath}/salesBills`),
          where('customerId', '==', selectedParty)
        );
        
        // Fetch purchase bills - simplified to avoid complex index requirements
        const purchaseQuery = query(
          collection(db, `${basePath}/purchaseBills`),
          where('partyId', '==', selectedParty)
        );
        
        // Also try alternative collection names
        const purchaseQueryAlt = query(
          collection(db, `${basePath}/purchases`),
          where('partyId', '==', selectedParty)
        );
        
        // Try alternative party ID field names
        const purchaseQueryAlt2 = query(
          collection(db, `${basePath}/purchaseBills`),
          where('party', '==', selectedParty)
        );
        
        const purchaseQueryAlt3 = query(
          collection(db, `${basePath}/purchaseBills`),
          where('supplierId', '==', selectedParty)
        );
        
        // Fetch payments - simplified to avoid complex index requirements
        const paymentsQuery = query(
          collection(db, `${basePath}/payments`),
          where('partyId', '==', selectedParty)
        );
        
        // Try alternative party ID field names for payments
        const paymentsQueryAlt = query(
          collection(db, `${basePath}/payments`),
          where('party', '==', selectedParty)
        );

        const [salesSnap, salesSnapAlt, salesSnapAlt2, salesSnapAlt3, purchaseSnap, purchaseSnapAlt, purchaseSnapAlt2, purchaseSnapAlt3, paymentsSnap, paymentsSnapAlt] = await Promise.all([
          getDocs(salesQuery),
          getDocs(salesQueryAlt),
          getDocs(salesQueryAlt2),
          getDocs(salesQueryAlt3),
          getDocs(purchaseQuery),
          getDocs(purchaseQueryAlt),
          getDocs(purchaseQueryAlt2),
          getDocs(purchaseQueryAlt3),
          getDocs(paymentsQuery),
          getDocs(paymentsQueryAlt)
        ]);

        // Combine data from all collection names and field variations
        const allSales = [
          ...salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...salesSnapAlt.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...salesSnapAlt2.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...salesSnapAlt3.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ];
        
        const allPurchases = [
          ...purchaseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...purchaseSnapAlt.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...purchaseSnapAlt2.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...purchaseSnapAlt3.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ];
        
        const allPayments = [
          ...paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...paymentsSnapAlt.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ];
        
        // Filter by date range on client side
        const sales = allSales.filter(sale => {
          const saleDate = sale.invoiceDate || sale.date;
          if (!saleDate) return false;
          const date = new Date(saleDate);
          return date >= dateRange.start && date <= dateRange.end;
        });
        
        const purchases = allPurchases.filter(purchase => {
          const purchaseDate = purchase.billDate || purchase.date;
          if (!purchaseDate) return false;
          const date = new Date(purchaseDate);
          return date >= dateRange.start && date <= dateRange.end;
        });
        
        const payments = allPayments.filter(payment => {
          const paymentDate = payment.paymentDate || payment.date;
          if (!paymentDate) return false;
          const date = new Date(paymentDate);
          return date >= dateRange.start && date <= dateRange.end;
        });
        
        console.log('Raw Data Debug:', {
          allSalesCount: allSales.length,
          allPurchasesCount: allPurchases.length,
          allPaymentsCount: allPayments.length,
          filteredSalesCount: sales.length,
          filteredPurchasesCount: purchases.length,
          filteredPaymentsCount: payments.length,
          sampleSale: sales[0],
          samplePurchase: purchases[0],
          samplePayment: payments[0],
          dateRange: {
            start: dateRange.start.toISOString().split('T')[0],
            end: dateRange.end.toISOString().split('T')[0]
          }
        });

        // Calculate opening balance (transactions before start date) - simplified
        const openingQuery = query(
          collection(db, `${basePath}/salesBills`),
          where('partyId', '==', selectedParty)
        );
        
        const openingPurchaseQuery = query(
          collection(db, `${basePath}/purchaseBills`),
          where('partyId', '==', selectedParty)
        );
        
        const openingPaymentsQuery = query(
          collection(db, `${basePath}/payments`),
          where('partyId', '==', selectedParty)
        );

        const [openingSalesSnap, openingPurchaseSnap, openingPaymentsSnap] = await Promise.all([
          getDocs(openingQuery),
          getDocs(openingPurchaseQuery),
          getDocs(openingPaymentsQuery)
        ]);

        const allOpeningSales = openingSalesSnap.docs.map(doc => doc.data());
        const allOpeningPurchases = openingPurchaseSnap.docs.map(doc => doc.data());
        const allOpeningPayments = openingPaymentsSnap.docs.map(doc => doc.data());

        // Filter opening transactions by date on client side
        const openingSales = allOpeningSales.filter(sale => {
          const saleDate = sale.invoiceDate || sale.date;
          if (!saleDate) return false;
          const date = new Date(saleDate);
          return date < dateRange.start;
        });
        
        const openingPurchases = allOpeningPurchases.filter(purchase => {
          const purchaseDate = purchase.billDate || purchase.date;
          if (!purchaseDate) return false;
          const date = new Date(purchaseDate);
          return date < dateRange.start;
        });
        
        const openingPayments = allOpeningPayments.filter(payment => {
          const paymentDate = payment.paymentDate || payment.date;
          if (!paymentDate) return false;
          const date = new Date(paymentDate);
          return date < dateRange.start;
        });

        let openingBalance = 0;
        
        // Add sales (receivable)
        openingSales.forEach(sale => {
          const totalAmount = parseFloat(sale.totalAmount || sale.grandTotal || 0);
          openingBalance += totalAmount;
        });
        
        // Subtract purchases (payable)
        openingPurchases.forEach(purchase => {
          const totalAmount = parseFloat(purchase.totalAmount || purchase.grandTotal || 0);
          openingBalance -= totalAmount;
        });
        
        // Add payments received (ignore ADV-INV advance allocations)
        openingPayments.forEach(payment => {
          const ref = (payment.receiptNumber || payment.paymentId || payment.number || '').toString().toUpperCase();
          if (ref.startsWith('ADV-INV')) return; // ignore advance allocation adjustments
          const amount = parseFloat(payment.amount || 0);
          openingBalance -= amount; // Payment reduces receivable
        });

        setOpeningBalance(openingBalance);

        // Process current period transactions (collect first; compute balances after sorting)
        const ledgerEntries = [];

        // Add sales entries (Debit)
        sales.forEach(sale => {
          const totalAmount = parseFloat(sale.totalAmount || sale.grandTotal || sale.amount || sale.invoiceAmount || 0);
          if (totalAmount > 0) {
            ledgerEntries.push({
              transactionId: sale.id,
              date: sale.invoiceDate || sale.date,
              type: 'Sale',
              refNo: sale.invoiceNo || sale.billNo || sale.invoiceNumber || sale.number || sale.id,
              description: `Sale Invoice - ${sale.invoiceNo || sale.billNo || sale.invoiceNumber || sale.number || sale.id}`,
              debit: totalAmount,
              credit: 0,
              balance: 0,
              items: sale.rows || sale.items || []
            });
          }
        });

        // Add purchase entries
        purchases.forEach(purchase => {
          const totalAmount = parseFloat(purchase.totalAmount || purchase.grandTotal || purchase.amount || purchase.billAmount || 0);
          if (totalAmount > 0) {
            ledgerEntries.push({
              transactionId: purchase.id,
              date: purchase.billDate || purchase.date,
              type: 'Purchase',
              refNo: purchase.billNo || purchase.invoiceNo || purchase.billNumber || purchase.number || purchase.id,
              description: `Purchase Bill - ${purchase.billNo || purchase.invoiceNo || purchase.billNumber || purchase.number || purchase.id}`,
              debit: 0,
              credit: totalAmount,
              balance: 0,
              items: purchase.rows || purchase.items || []
            });
          }
        });

        // Add payments: classify by receipt number prefix
        payments.forEach(payment => {
          const amount = parseFloat(payment.amount || payment.totalAmount || payment.paymentAmount || 0);
          const ref = (payment.receiptNumber || payment.paymentId || payment.number || '').toString().toUpperCase();
          if (amount <= 0) return;

          // Skip advance allocation to invoice (re-entry): ADV-INV*
          if (ref.startsWith('ADV-INV')) {
            return; // ignore from ledger and totals
          }

          const isPRI = ref.startsWith('PRI'); // Payment received against sales → Credit
          const isPRP = ref.startsWith('PRP'); // Payment paid against purchase → Debit

          if (isPRI) {
            ledgerEntries.push({
              transactionId: payment.id,
              date: payment.paymentDate || payment.date,
              type: 'Payment (PRI)',
              refNo: payment.receiptNumber || payment.paymentId || payment.number || payment.id,
              description: `Payment Received - ${payment.paymentMode || 'Cash'}${payment.reference ? ` (${payment.reference})` : ''}`,
              debit: 0,
              credit: amount,
              balance: 0,
              items: []
            });
            return;
          }

          if (isPRP) {
            ledgerEntries.push({
              transactionId: payment.id,
              date: payment.paymentDate || payment.date,
              type: 'Payment (PRP)',
              refNo: payment.receiptNumber || payment.paymentId || payment.number || payment.id,
              description: `Payment Against Purchase - ${payment.paymentMode || 'Cash'}${payment.reference ? ` (${payment.reference})` : ''}`,
              debit: amount,
              credit: 0,
              balance: 0,
              items: []
            });
            return;
          }

          // Fallback: if no prefix, treat as received (credit)
          ledgerEntries.push({
            transactionId: payment.id,
            date: payment.paymentDate || payment.date,
            type: 'Payment',
            refNo: payment.receiptNumber || payment.paymentId || payment.number || payment.id,
            description: `Payment - ${payment.paymentMode || 'Cash'}${payment.reference ? ` (${payment.reference})` : ''}`,
            debit: 0,
            credit: amount,
            balance: 0,
            items: []
          });
        });

        // Sort chronologically: by date, then by trailing numeric in refNo
        const getSeq = (ref) => {
          const m = (ref || '').toString().match(/(\d+)(?!.*\d)/);
          return m ? parseInt(m[1], 10) : 0;
        };
        const typeWeight = (t) => {
          // Keep it simple but stable if date+seq tie
          if (t?.startsWith('Sale')) return 1;
          if (t === 'Purchase') return 2;
          if (t === 'Payment (PRP)') return 3;
          if (t === 'Payment (PRI)') return 4;
          if (t === 'Payment') return 5;
          return 9;
        };
        ledgerEntries.sort((a, b) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          if (da !== db) return da - db;
          const sa = getSeq(a.refNo);
          const sb = getSeq(b.refNo);
          if (sa !== sb) return sa - sb;
          return typeWeight(a.type) - typeWeight(b.type);
        });

        // Recompute running balance and totals strictly in sorted order
        let currentBalance = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;
        for (let i = 0; i < ledgerEntries.length; i += 1) {
          const e = ledgerEntries[i];
          if (e.debit) {
            currentBalance += e.debit;
            totalDebit += e.debit;
          }
          if (e.credit) {
            currentBalance -= e.credit;
            totalCredit += e.credit;
          }
          e.balance = currentBalance;
        }

        console.log('Customer Ledger Debug:', {
          sales: sales.length,
          purchases: purchases.length,
          payments: payments.length,
          ledgerEntries: ledgerEntries.length,
          openingBalance,
          currentBalance,
          totalDebit,
          totalCredit
        });
        
        setLedgerData(ledgerEntries);
        setClosingBalance(currentBalance);
        setTotals({
          totalDebit,
          totalCredit,
          totalOutstanding: currentBalance
        });

      } catch (error) {
        console.error('Error fetching ledger data:', error);
        setLedgerData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLedgerData();
  }, [db, userId, selectedParty, dateRange, setLoading]);

  // Check if party is selected
  if (!selectedParty) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">No Party Selected</h3>
            <p>Please select a party from the "Party (Optional)" filter above to view their ledger.</p>
          </div>
          {parties.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Available parties:</p>
              <div className="text-sm text-gray-500">
                {parties.slice(0, 5).map(party => (
                  <div key={party.id} className="mb-1">
                    • {party.firmName} ({party.partyType || 'Unknown Type'})
                  </div>
                ))}
                {parties.length > 5 && <div>... and {parties.length - 5} more</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedPartyObj = parties.find(p => p.id === selectedParty);
  
  if (!selectedPartyObj) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          Selected party not found
        </div>
      </div>
    );
  }

  // Letterhead component
  const Letterhead = () => (
    <div className="mb-6 border-b-2 border-gray-300 pb-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {companyDetails?.logoUrl && (
            <img 
              src={companyDetails.logoUrl} 
              alt="Company Logo" 
              className="h-16 mb-2"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {companyDetails?.firmName || 'Company Name'}
          </h1>
          <div className="text-sm text-gray-600 space-y-1">
            {companyDetails?.address && <p>{companyDetails.address}</p>}
            {companyDetails?.city && companyDetails?.state && (
              <p>{companyDetails.city}, {companyDetails.state} {companyDetails?.pincode}</p>
            )}
            {companyDetails?.gstin && <p>GSTIN: {companyDetails.gstin}</p>}
            {companyDetails?.contactNumber && <p>Phone: {companyDetails.contactNumber}</p>}
            {companyDetails?.email && <p>Email: {companyDetails.email}</p>}
          </div>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Report Type: Party Ledger</p>
          <p>Generated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );

  // Main return statement
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Party Ledger ({selectedPartyObj?.firmName} - {selectedPartyObj?.partyType})
            </h2>
            <p className="text-gray-600">
              Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
            </p>
          </div>

          {/* Global Export/Print/Share Buttons */}
          <GlobalExportButtons
            data={getExportData()}
            columns={getExportColumns()}
            filename="CUSTOMER_LEDGER"
            title="Customer Ledger Report"
            companyDetails={companyDetails}
            reportDetails={getReportDetails()}
            disabled={ledgerData.length === 0}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-800">Opening Balance</div>
          <div className={`text-2xl font-semibold ${openingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {openingBalance >= 0 ? `${formatCurrency(openingBalance)} Cr` : `${formatCurrency(Math.abs(openingBalance))} Dr`}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-800">Total Debit</div>
          <div className="text-2xl font-semibold text-green-900">{formatCurrency(totals.totalDebit)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-800">Total Credit</div>
          <div className="text-2xl font-semibold text-red-900">{formatCurrency(totals.totalCredit)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-800">Closing Balance</div>
          <div className={`text-2xl font-semibold ${closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {closingBalance >= 0 ? `${formatCurrency(closingBalance)} Cr` : `${formatCurrency(Math.abs(closingBalance))} Dr`}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader columnKey="date" label="Date" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="type" label="Type" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="refNo" label="Ref No" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="description" label="Description" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="debit" label="Debit" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="credit" label="Credit" onSort={handleSort} sortConfig={sortConfig} />
              <SortableHeader columnKey="balance" label="Balance" onSort={handleSort} sortConfig={sortConfig} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pagination.currentData.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No ledger entries found</td></tr>
            ) : pagination.currentData.map((row, idx) => (
              <tr key={row.transactionId || idx} className="cursor-pointer hover:bg-blue-50" onClick={() => handleEntryClick(row)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(row.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                  {row.refNo}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {row.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.debit > 0 ? formatCurrency(row.debit) : ''}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.credit > 0 ? formatCurrency(row.credit) : ''}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${row.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {row.balance >= 0 ? `${formatCurrency(row.balance)} Cr` : `${formatCurrency(Math.abs(row.balance))} Dr`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <PaginationControls {...pagination} />
      
      {/* Quick Summary Modal */}
      {showQuickSummary && quickSummaryEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowQuickSummary(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-center">Transaction Summary</h3>
            <div className="space-y-3">
              <div><strong>Date:</strong> {formatDate(quickSummaryEntry.date)}</div>
              <div><strong>Type:</strong> {quickSummaryEntry.type}</div>
              <div><strong>Reference:</strong> {quickSummaryEntry.refNo}</div>
              <div><strong>Description:</strong> {quickSummaryEntry.description}</div>
              <div><strong>Debit:</strong> {quickSummaryEntry.debit > 0 ? formatCurrency(quickSummaryEntry.debit) : '-'}</div>
              <div><strong>Credit:</strong> {quickSummaryEntry.credit > 0 ? formatCurrency(quickSummaryEntry.credit) : '-'}</div>
              <div><strong>Balance:</strong> 
                <span className={`ml-2 ${quickSummaryEntry.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {quickSummaryEntry.balance >= 0 ? `${formatCurrency(quickSummaryEntry.balance)} Cr` : `${formatCurrency(Math.abs(quickSummaryEntry.balance))} Dr`}
                </span>
              </div>

              {/* Items List */}
              {quickSummaryEntry.items && quickSummaryEntry.items.length > 0 && (
                <div>
                  <strong>Items:</strong>
                  <div className="mt-2 space-y-1">
                    {quickSummaryEntry.items.map((item, index) => (
                      <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                        <div><strong>Item:</strong> {itemNames[item.item] || item.item || 'Unknown Item'}</div>
                        <div><strong>Qty:</strong> {item.qty || item.nos || 0}</div>
                        <div><strong>Rate:</strong> {formatCurrency(item.rate || 0)}</div>
                        <div><strong>Amount:</strong> {formatCurrency(item.amount || item.total || 0)}</div>
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

export default CustomerLedgerReport; 