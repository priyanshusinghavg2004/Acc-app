import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { formatCurrency, formatDate } from './CommonComponents';

const PartywiseSalesReport = ({ db, userId, appId, dateRange, selectedParty, parties, loading, setLoading, companyDetails }) => {
  const [reportData, setReportData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    totalGST: 0,
    totalPaid: 0,
    totalOutstanding: 0
  });
  const [showModal, setShowModal] = useState(false);
  const [modalParty, setModalParty] = useState(null);
  const [modalInvoices, setModalInvoices] = useState([]);
  const [showQuickSummary, setShowQuickSummary] = useState(false);
  const [quickSummaryInvoice, setQuickSummaryInvoice] = useState(null);
  const [itemNames, setItemNames] = useState({});
  const [localCompanyDetails, setLocalCompanyDetails] = useState(null);
  const [itemMap, setItemMap] = useState({});

  // ESC key handler for closing modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        // Step by step: First close Quick Summary, then Party Summary
        if (showQuickSummary) {
          console.log('ESC: Closing Quick Summary modal');
          setShowQuickSummary(false);
          setQuickSummaryInvoice(null);
          return; // Stop here, don't close other modal
        }
        if (showModal) {
          console.log('ESC: Closing Party Summary modal');
          setShowModal(false);
          setModalParty(null);
          setModalInvoices([]);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showQuickSummary, showModal]);

  // Normalize party id that may be saved as a path like "parties/{id}" or a document ref-like string
  const normalizePartyId = (raw) => {
    if (!raw) return '';
    let val = raw;
    if (typeof val === 'object') {
      // Some systems store references; try common shapes
      val = val.id || val._key || val._path || String(val);
    }
    if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/');
      return parts[parts.length - 1];
    }
    return String(val);
  };

  const partyIdToName = React.useMemo(() => {
    const map = {};
    (parties || []).forEach(p => {
      map[p.id] = p.firmName || p.name || p.partyName || p.displayName || p.id;
    });
    return map;
  }, [parties]);

  // Function to calculate GST for an invoice using rows and item master
  const calculateGST = (rows, effectiveCompanyDetails, effectiveItemMap) => {
    console.log('🧮 GST CALCULATION START 🧮');
    console.log('Rows to process:', rows?.length || 0);
    console.log('Company Details:', effectiveCompanyDetails);
    
    // Always calculate GST from rows first (regardless of company status)
    let totalSGST = 0, totalCGST = 0, totalIGST = 0;
    
    if (Array.isArray(rows)) {
      rows.forEach((row, index) => {
        const itemId = row.item || row.id || row.itemId || row.productId;
        const itemDef = effectiveItemMap[itemId] || {};
        const qty = Number(row.qty || row.quantity || 0);
        const rate = Number(row.rate || row.price || 0);
        const taxable = Number(row.amount || row.total || (qty && rate ? qty * rate : 0) || 0);

        // Determine company GST mode
        const gstType = (effectiveCompanyDetails?.gstinType || effectiveCompanyDetails?.gstType || 'regular').toLowerCase();

        let sgst = 0, cgst = 0, igst = 0;

        if (gstType === 'composition') {
          const itemType = (itemDef.itemType || itemDef.type || '').toLowerCase();
          const compRate = Number(itemDef.compositionGstRate ?? (itemType === 'services' ? 6 : itemType === 'restaurant' || itemType === 'restaurants' ? 5 : 1));
          const tax = taxable * (compRate / 100);
          sgst = tax / 2;
          cgst = tax / 2;
          igst = 0;
        } else {
          // Regular mode: derive rate from row percents or item master
          const rowRateFromPercents = Number(row.sgst || 0) + Number(row.cgst || 0) + Number(row.igst || 0);
          const effectiveRate = rowRateFromPercents > 0 ? rowRateFromPercents : Number(row.gstPercent ?? itemDef.gstPercentage ?? 0);
          const tax = taxable * (effectiveRate / 100);
          if (Number(row.igst || 0) > 0) {
            igst = tax;
          } else {
            sgst = tax / 2;
            cgst = tax / 2;
          }
        }

        totalSGST += sgst;
        totalCGST += cgst;
        totalIGST += igst;

        console.log(`Row ${index}: SGST=${sgst}, CGST=${cgst}, IGST=${igst}, Row Total=${sgst + cgst + igst}`);
      });
    }
    
    const totalGST = totalSGST + totalCGST + totalIGST;
    console.log('🧮 GST CALCULATION END 🧮');
    console.log('Final Result:', { totalSGST, totalCGST, totalIGST, totalGST });
    
    // If company details are available, apply business rules
    if (effectiveCompanyDetails) {
      const gstStatus = effectiveCompanyDetails.gstStatus || effectiveCompanyDetails.registrationStatus || 'registered';
      const gstType = (effectiveCompanyDetails.gstinType || effectiveCompanyDetails.gstType || 'regular').toLowerCase();

      // Not registered or unregistered - no GST
      if (gstStatus === 'unregistered' || gstStatus === 'not_registered') {
        console.log('Company unregistered - GST set to 0');
        return { totalSGST: 0, totalCGST: 0, totalIGST: 0, totalGST: 0 };
      }

      // Composition scheme - no GST collection on individual items
      if (gstType === 'composition') {
        // Compute composition tax based on item-wise composition rate
        let compTax = 0;
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            const taxable = Number(row.amount || row.total || (row.qty || row.quantity || 0) * (row.rate || row.price || 0) || 0);
            const itemId = row.item || row.id || row.itemId || row.productId;
            const itemDef = effectiveItemMap[itemId] || {};
            const itemType = (itemDef.itemType || itemDef.type || '').toLowerCase();
            const rateFromItem = Number(itemDef.compositionGstRate ?? (
              itemType === 'services' ? 6 : itemType === 'restaurant' || itemType === 'restaurants' ? 5 : 1
            ));
            const lineTax = taxable * (rateFromItem / 100);
            compTax += lineTax;
          });
        }
        const half = compTax / 2;
        return { totalSGST: half, totalCGST: half, totalIGST: 0, totalGST: compTax };
      }
    }
    
    // Return calculated GST (default behavior)
    return { totalSGST, totalCGST, totalIGST, totalGST };
  };

  // Function to fetch item names from items collection
  const fetchItemNames = async (itemIds) => {
    if (!itemIds || itemIds.length === 0) return {};
    
    try {
      const basePath = `artifacts/${appId}/users/${userId}`;
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

  useEffect(() => {
    if (!db || !userId || !appId) return;
    setLoading(true);
    const fetchData = async () => {
      // Fetch company details for GST calculation
      let fetchedCompanyDetails = companyDetails || localCompanyDetails || null;
      try {
        if (!fetchedCompanyDetails) {
          const ref = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
          const snap = await getDoc(ref);
          if (snap.exists()) {
            fetchedCompanyDetails = snap.data();
            setLocalCompanyDetails(fetchedCompanyDetails);
          }
        }
      } catch (error) {
        console.error('Error fetching company details:', error);
      }

      // Fetch items map for GST rates and names
      try {
        const itemsSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/items`));
        const map = {};
        itemsSnap.forEach(docSnap => {
          const data = docSnap.data();
          map[docSnap.id] = {
            name: data.name || data.itemName || data.productName,
            gstPercentage: Number(data.gstPercentage ?? data.taxRate ?? 0),
            compositionGstRate: Number(data.compositionGstRate ?? data.compGstRate ?? undefined),
            itemType: data.itemType || data.type || ''
          };
        });
        setItemMap(map);
      } catch (error) {
        console.error('Error fetching items for GST map:', error);
      }
      
      try {
        const basePath = `artifacts/${appId}/users/${userId}`;
        // Fetch sales
        const salesQuery = query(
          collection(db, `${basePath}/salesBills`),
          orderBy('invoiceDate', 'desc')
        );
        const salesSnapshot = await getDocs(salesQuery);
        let sales = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Parse invoiceDate as Date
          let saleDate = data.invoiceDate;
          let saleDateObj = saleDate ? new Date(saleDate) : null;
          
          // Try to get partyId from customFields or party field and normalize
          let partyId = normalizePartyId(data.customFields?.party || data.party || data.partyId || '');
          
          // Resolve party name using map with fallbacks
          let partyName = partyIdToName[partyId] || data.partyName || data.customerName || partyId || 'Unknown';
          
          // Try to get invoice number from multiple fields
          let invoiceNumber = data.customFields?.number || data.invoiceNumber || data.billNumber || data.number || data.invoiceNo || doc.id;
          
          // FIX: Handle advance invoices (ADV-INV) as negative amounts
          let baseAmount = Number(data.amount) || 0;
          let isAdvanceInvoice = invoiceNumber && invoiceNumber.startsWith('ADV-INV');
          let totalAmount = isAdvanceInvoice ? -baseAmount : baseAmount; // Negative for advance invoices
          
          // GST calculation based on company registration status
           const { totalSGST, totalCGST, totalIGST, totalGST } = calculateGST(data.rows, fetchedCompanyDetails, itemMap);
          
          console.log('GST Calculation Debug:', {
            invoiceId: doc.id,
            invoiceNumber: invoiceNumber,
            partyName: partyName,
            totalAmount: totalAmount,
            rows: data.rows?.length || 0,
            calculatedGST: { totalSGST, totalCGST, totalIGST, totalGST },
            rowData: data.rows?.map((row, index) => ({
              rowIndex: index,
              sgst: row.sgst || 0,
              cgst: row.cgst || 0,
              igst: row.igst || 0,
              amount: row.amount || row.total || 0,
              gstPercent: row.gstPercent || 0
            })) || 'No rows'
          });
          
          return {
            id: doc.id,
            partyId,
            partyName,
            totalAmount: totalAmount,
            sgst: totalSGST,
            cgst: totalCGST,
            igst: totalIGST,
            gst: totalGST,
            date: saleDateObj,
            invoiceNumber,
            items: data.rows || [],
            payments: data.payments || [],
            isAdvanceInvoice: isAdvanceInvoice,
            ...data
          };
        });
        console.log('📊 SALES DATA DEBUG:', {
          totalSales: sales.length,
          dateRange: { start: dateRange.start, end: dateRange.end },
          selectedParty: selectedParty
        });
        
        // JS filter for date
        sales = sales.filter(sale => sale.date && sale.date >= dateRange.start && sale.date <= dateRange.end);
        
        console.log('📊 FILTERED SALES DEBUG:', {
          filteredSales: sales.length,
          sampleSales: sales.slice(0, 3).map(s => ({
            invoiceNumber: s.invoiceNumber,
            partyName: s.partyName,
            totalAmount: s.totalAmount,
            date: s.date
          }))
        });
        
        // Filter by selected party if needed
        if (selectedParty) {
          sales = sales.filter(sale => sale.partyId === selectedParty);
        }
        // Fetch payments
        const paymentsQuery = query(
          collection(db, `${basePath}/payments`),
          where('paymentDate', '<=', dateRange.end),
          orderBy('paymentDate', 'asc')
        );
        // PATCH: Fetch all payments without any filter for debugging
        const paymentsSnapshot = await getDocs(collection(db, `${basePath}/payments`));
        const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // JS date filter for payments AND receipt number prefix (only PRI for sales)
        const filteredPayments = payments.filter(p => {
          if (!p.paymentDate) return false;
          const payDate = new Date(p.paymentDate);
          const isDateInRange = payDate >= dateRange.start && payDate <= dateRange.end;
          
          // Only consider PRI (Payment Receipt Invoice) payments for sales reports
          const isSalesPayment = p.receiptNumber && p.receiptNumber.startsWith('PRI');
          
          console.log(`Payment ${p.receiptNumber}: dateInRange=${isDateInRange}, isSalesPayment=${isSalesPayment}`);
          
          return isDateInRange && isSalesPayment;
        });
        // Helper to normalize bill/invoice/receipt numbers for matching
        function normalizeBillNumber(str) {
          if (!str) return '';
          return str.replace(/^(PRI|PRC|INV|ADV-INV|PRP|PRB)/, '').replace(/[^0-9/-]/g, '');
        }
        // Group sales by party
        const partyInvoices = {};
        sales.forEach(invoice => {
          const partyId = normalizePartyId(invoice.partyId);
          if (!partyInvoices[partyId]) {
            partyInvoices[partyId] = [];
          }
          partyInvoices[partyId].push(invoice);
        });
        // Group payments by party
        const partyPayments = {};
        filteredPayments.forEach(payment => {
          const partyId = normalizePartyId(payment.partyId);
          if (!partyPayments[partyId]) {
            partyPayments[partyId] = [];
          }
          partyPayments[partyId].push(payment);
        });
        // True FIFO/Khata logic: partywise allocation
        const partySummary = {};
        Object.entries(partyInvoices).forEach(([partyId, invoices]) => {
          console.log(`\n=== Processing Party: ${partyId} ===`);
          // Sort invoices by date (FIFO)
          const sortedInvoices = invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
          console.log('Sorted Invoices:', sortedInvoices.map(inv => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: inv.totalAmount,
            date: inv.date
          })));
          
          // Get payments for this party, sort by date (FIFO)
          const payments = (partyPayments[partyId] || []).sort((a, b) => new Date(a.paymentDate || a.date) - new Date(b.paymentDate || b.date));
          console.log('Sorted Payments:', payments.map(p => ({
            id: p.id,
            amount: p.amount,
            totalAmount: p.totalAmount,
            allocatedAmount: p.allocatedAmount,
            paymentDate: p.paymentDate,
            date: p.date,
            receiptNumber: p.receiptNumber,
            // Add all possible amount fields
            allFields: Object.keys(p).filter(key => key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('payment'))
          })));
          
          // True FIFO/Khata logic: partywise allocation
          let invoicePointer = 0;
          let paymentPointer = 0;
          let totalPaid = 0;
          
          console.log(`Starting FIFO for party ${partyId}: ${sortedInvoices.length} invoices, ${payments.length} payments`);
          
          // FIFO allocation
          while (invoicePointer < sortedInvoices.length && paymentPointer < payments.length) {
            let currentInvoice = sortedInvoices[invoicePointer];
            let currentPayment = payments[paymentPointer];
            
            let invoiceOutstanding = Number(currentInvoice.totalAmount) - (currentInvoice.paidAmount || 0);
            let paymentRemaining = Number(currentPayment.totalAmount || currentPayment.amount || currentPayment.paymentAmount || currentPayment.allocatedAmount || 0) - (currentPayment.usedAmount || 0);
            
            console.log(`FIFO Step: Invoice ${currentInvoice.invoiceNumber} (outstanding: ${invoiceOutstanding}), Payment ${currentPayment.receiptNumber} (remaining: ${paymentRemaining})`);
            
            if (invoiceOutstanding <= 0) {
              invoicePointer++;
              console.log(`Invoice ${currentInvoice.invoiceNumber} fully paid, moving to next invoice`);
              continue;
            }
            if (paymentRemaining <= 0) {
              paymentPointer++;
              console.log(`Payment ${currentPayment.receiptNumber} fully used, moving to next payment`);
              continue;
            }
            
            const amountToApply = Math.min(paymentRemaining, invoiceOutstanding);
            
            // Update current invoice's paid amount
            currentInvoice.paidAmount = (currentInvoice.paidAmount || 0) + amountToApply;
            
            // Add payment receipt to invoice for modal display
            if (!currentInvoice.paymentReceipts) {
              currentInvoice.paymentReceipts = [];
            }
            currentInvoice.paymentReceipts.push({
              receiptNumber: currentPayment.receiptNumber,
              amount: amountToApply,
              paymentDate: currentPayment.paymentDate || currentPayment.date
            });
            
            // Update current payment's used amount
            currentPayment.usedAmount = (currentPayment.usedAmount || 0) + amountToApply;
            
            totalPaid += amountToApply;
            
            console.log(`Applied ${amountToApply}: totalPaid=${totalPaid}, invoiceOutstanding=${invoiceOutstanding - amountToApply}, paymentRemaining=${paymentRemaining - amountToApply}`);
          }
          
          // Calculate totalAmount and totalGST
          let totalAmount = 0;
          let totalGST = 0;
          sortedInvoices.forEach(inv => {
            totalAmount += Number(inv.totalAmount);
            totalGST += inv.gst || 0;
          });
          
          // Outstanding/Advance
          let outstanding = totalAmount - totalPaid;
          let advance = 0;
          if (outstanding < 0) {
            advance = -outstanding;
            outstanding = 0;
          }
          
          console.log(`Final for ${partyId}: totalAmount=${totalAmount}, totalPaid=${totalPaid}, outstanding=${outstanding}, advance=${advance}`);
          
          // Find party name
          const partyName = partyIdToName[partyId] || partyId;
          partySummary[partyId] = {
            partyId,
            partyName,
            totalInvoices: sortedInvoices.length,
            totalAmount,
            totalGST,
            totalPaid,
            totalOutstanding: outstanding,
            advance,
            lastInvoiceDate: sortedInvoices.length > 0 ? sortedInvoices[sortedInvoices.length - 1].date : null,
            invoices: sortedInvoices
          };
        });
        let reportDataArray = Object.values(partySummary);
        // If a party is selected, only show that party's row
        if (selectedParty) {
          reportDataArray = reportDataArray.filter(row => row.partyId === selectedParty);
        }
        console.log('📊 REPORT DATA DEBUG:', {
          partySummary: Object.keys(partySummary),
          reportDataArray: reportDataArray.length,
          sampleData: reportDataArray[0] || 'No data'
        });
        
        setReportData(reportDataArray);
        
        // Calculate totals
        let totals = reportDataArray.reduce((acc, party) => ({
          totalInvoices: acc.totalInvoices + party.totalInvoices,
          totalAmount: acc.totalAmount + party.totalAmount,
          totalGST: acc.totalGST + party.totalGST,
          totalPaid: acc.totalPaid + party.totalPaid,
          totalOutstanding: acc.totalOutstanding + party.totalOutstanding
        }), {
          totalInvoices: 0,
          totalAmount: 0,
          totalGST: 0,
          totalPaid: 0,
          totalOutstanding: 0
        });
        
        console.log('📊 TOTALS DEBUG:', totals);

        // Add composition GST if applicable
        if (fetchedCompanyDetails && fetchedCompanyDetails.gstType === 'composition') {
          const compositionRate = fetchedCompanyDetails.compositionRate || 1; // Default 1% for goods
          const compositionGST = (totals.totalAmount * compositionRate) / 100;
          totals.totalGST = compositionGST;
          console.log(`Composition GST calculated: ${compositionGST} (${compositionRate}% of ${totals.totalAmount})`);
        }

        setTotalSummary(totals);
      } catch (error) {
        console.error('Error fetching partywise sales data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [db, userId, appId, dateRange, selectedParty, parties, setLoading, companyDetails, partyIdToName]);

  // Find selected party object
  const selectedPartyObj = parties.find(p => p.id === selectedParty);

  // Table columns
  const columns = [
    { key: 'partyName', label: 'Party Name' },
    { key: 'totalInvoices', label: 'Total Invoices' },
    { key: 'totalAmount', label: 'Total Amount', render: formatCurrency },
    { key: 'totalGST', label: 'Total GST', render: formatCurrency },
    { key: 'totalPaid', label: 'Total Paid', render: formatCurrency },
    { key: 'totalOutstanding', label: 'Outstanding', render: formatCurrency },
    { key: 'lastInvoiceDate', label: 'Last Invoice Date', render: v => v ? formatDate(v) : '-' }
  ];

  // Handle party row click for modal
  const handlePartyRowClick = (row) => {
    setModalParty(row);
    setModalInvoices(row.invoices || []);
    setShowModal(true);
  };

  // Handle invoice click for quick summary
  const handleInvoiceClick = async (invoice) => {
    setQuickSummaryInvoice(invoice);
    setShowQuickSummary(true);
    
    // Fetch item names for this invoice
    if (invoice.items && invoice.items.length > 0) {
      const itemIds = invoice.items.map(item => item.item || item.id || item.itemId || item.productId).filter(Boolean);
      console.log('Item IDs to fetch:', itemIds);
      if (itemIds.length > 0) {
        const names = await fetchItemNames(itemIds);
        console.log('Fetched item names:', names);
        setItemNames(names);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Partywise Sales / Sales Summary</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${selectedPartyObj ? selectedPartyObj.firmName : selectedParty}`}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Outstanding</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totalSummary.totalOutstanding)}</div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table id="report-table" className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
              {columns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>
              ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {reportData.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-gray-400">No data found</td></tr>
            ) : reportData.map((row, idx) => (
              <tr key={row.partyId || idx} className="cursor-pointer hover:bg-blue-50" onClick={() => handlePartyRowClick(row)}>
                {columns.map(col => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Invoice Quick View Modal */}
      {showModal && modalParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowModal(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-2">{modalParty.partyName} - Invoice Summary</h3>
            <div className="mb-2 text-sm text-gray-600">Total Invoices: {modalParty.totalInvoices}</div>
            <div className="mb-4 text-sm text-gray-600">Total Amount: {formatCurrency(modalParty.totalAmount)}</div>
            <div className="max-h-72 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Invoice No</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Paid Amount</th>
                    <th className="px-4 py-2 text-left">Payment Receipts</th>
                  </tr>
                </thead>
                <tbody>
                  {modalInvoices.map((inv, i) => (
                    <tr key={inv.id || i}>
                      <td className="px-4 py-2">
                        <button 
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Show quick summary modal
                            handleInvoiceClick(inv);
                          }}
                        >
                          {inv.invoiceNumber}
                        </button>
                  </td>
                      <td className="px-4 py-2">{inv.date ? formatDate(inv.date) : ''}</td>
                      <td className="px-4 py-2">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-2">{formatCurrency(inv.paidAmount)}</td>
                      <td className="px-4 py-2">
                        {inv.paymentReceipts && inv.paymentReceipts.length > 0 ? (
                          <div className="text-xs">
                            {inv.paymentReceipts.map((receipt, idx) => (
                              <div key={idx} className="text-green-600">
                                {receipt.receiptNumber} ({formatCurrency(receipt.amount)})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No receipts</span>
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </div>
        </div>
      )}
      
      {/* Quick Summary Modal */}
      {showQuickSummary && quickSummaryInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowQuickSummary(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-center">Sales Bill Summary</h3>
            <div className="space-y-3">
              <div><strong>Invoice Number:</strong> {quickSummaryInvoice.invoiceNumber}</div>
              <div><strong>Date:</strong> {quickSummaryInvoice.date ? formatDate(quickSummaryInvoice.date) : ''}</div>
              <div><strong>Party:</strong> {quickSummaryInvoice.partyName}</div>
              <div><strong>Amount:</strong> {formatCurrency(quickSummaryInvoice.totalAmount)}</div>
              
              {/* Items List */}
              {quickSummaryInvoice.items && quickSummaryInvoice.items.length > 0 && (
                <div>
                  <strong>Items Sold:</strong>
                  {console.log("Quick Summary Invoice Items:", quickSummaryInvoice.items)}
                  <div className="ml-4 mt-1 space-y-1">
                    {quickSummaryInvoice.items.map((item, idx) => {
                      console.log(`Item ${idx}:`, item);
                      const itemId = item.item || item.id || item.itemId || item.productId;
                      const itemName = itemNames[itemId] || item.itemName || item.name || item.productName || item.product || itemId || `Item ${idx + 1}`;
                      return (
                        <div key={idx} className="text-sm">
                          {itemName}
                          (Qty: {item.qty || item.quantity || 0}, Rate: ₹{item.rate || item.price || item.cost || 0})
                          {item.amount && <span className="text-gray-600"> - Total: ₹{item.amount}</span>}
                        </div>
                      );
                    })}
                  </div>
      </div>
              )}
              
              {/* Payment Receipts */}
              {quickSummaryInvoice.paymentReceipts && quickSummaryInvoice.paymentReceipts.length > 0 && (
                <div>
                  <strong>Payment Receipts:</strong>
                  <div className="ml-4 mt-1">
                    {quickSummaryInvoice.paymentReceipts.map((receipt, idx) => (
                      <div key={idx} className="text-green-600 text-sm">
                        {receipt.receiptNumber} ({formatCurrency(receipt.amount)})
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

export default PartywiseSalesReport; 