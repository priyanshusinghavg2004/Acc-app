import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency, formatDate } from './CommonComponents';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ShareButton from './ShareButton';

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

  // Export functions
  const exportToPDF = () => {
    if (!selectedPartyObj) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Compact Professional Letterhead
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(companyDetails?.firmName || 'Company Name', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let yPosition = 30;
    
    // Line 1: Address + City
    let line1 = '';
    if (companyDetails?.address) line1 += companyDetails.address;
    if (companyDetails?.city && companyDetails?.state) {
      if (line1) line1 += ', ';
      line1 += `${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}`;
    }
    if (line1) {
      doc.text(line1, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    
    // Line 2: GSTIN + Phone
    let line2 = '';
    if (companyDetails?.gstin) line2 += `GSTIN: ${companyDetails.gstin}`;
    if (companyDetails?.contactNumber) {
      if (line2) line2 += ' | ';
      line2 += `Phone: ${companyDetails.contactNumber}`;
    }
    if (line2) {
      doc.text(line2, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    
    // Line 3: Email (if exists)
    if (companyDetails?.email) {
      doc.text(`Email: ${companyDetails.email}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
    }
    
    // Add a line separator
    yPosition += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 8;
    
    // Report title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('PARTY LEDGER REPORT', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Report details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Party: ${selectedPartyObj.firmName} (${selectedPartyObj.partyType})`, 20, yPosition);
    yPosition += 8;
    doc.text(`Period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
    yPosition += 15;
    
    // Table headers
    const headers = ['Date', 'Type', 'Ref No', 'Description', 'Debit', 'Credit', 'Balance'];
    const data = sortedData.map(row => [
      formatDate(row.date),
      row.type,
      row.refNo,
      row.description,
      row.debit > 0 ? row.debit.toLocaleString() : '',
      row.credit > 0 ? row.credit.toLocaleString() : '',
      row.balance >= 0 ? `${row.balance.toLocaleString()} Cr` : `${Math.abs(row.balance).toLocaleString()} Dr`
    ]);
    
    // Add totals row
    if (ledgerData.length > 0) {
      data.push([
        'TOTALS:',
        '',
        '',
        '',
        totals.totalDebit > 0 ? totals.totalDebit.toLocaleString() : '0',
        totals.totalCredit > 0 ? totals.totalCredit.toLocaleString() : '0',
        totals.totalOutstanding >= 0 
          ? `+${totals.totalOutstanding.toLocaleString()} (Receivable)` 
          : `-${Math.abs(totals.totalOutstanding).toLocaleString()} (Payable)`
      ]);
    }
    
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        0: { cellWidth: 25 }, // Date
        1: { cellWidth: 30 }, // Type
        2: { cellWidth: 25 }, // Ref No
        3: { cellWidth: 40 }, // Description
        4: { cellWidth: 20 }, // Debit
        5: { cellWidth: 20 }, // Credit
        6: { cellWidth: 30 }  // Balance
      }
    });
    
    doc.save(`ledger_${selectedPartyObj.firmName}_${formatDate(dateRange.start)}_${formatDate(dateRange.end)}.pdf`);
  };

  const exportToExcel = () => {
    if (!selectedPartyObj) return;
    
    // Create CSV content
    let csvContent = '';
    
    // Add company details (compact)
    csvContent += `${companyDetails?.firmName || 'Company Name'}\n`;
    
    // Line 1: Address + City
    let line1 = '';
    if (companyDetails?.address) line1 += companyDetails.address;
    if (companyDetails?.city && companyDetails?.state) {
      if (line1) line1 += ', ';
      line1 += `${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}`;
    }
    if (line1) csvContent += `${line1}\n`;
    
    // Line 2: GSTIN + Phone
    let line2 = '';
    if (companyDetails?.gstin) line2 += `GSTIN: ${companyDetails.gstin}`;
    if (companyDetails?.contactNumber) {
      if (line2) line2 += ' | ';
      line2 += `Phone: ${companyDetails.contactNumber}`;
    }
    if (line2) csvContent += `${line2}\n`;
    
    // Line 3: Email (if exists)
    if (companyDetails?.email) csvContent += `Email: ${companyDetails.email}\n`;
    csvContent += '\n';
    
    // Add report title
    csvContent += 'PARTY LEDGER REPORT\n\n';
    
    // Add report details
    csvContent += `Party: ${selectedPartyObj.firmName} (${selectedPartyObj.partyType})\n`;
    csvContent += `Period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n`;
    csvContent += `Opening Balance: ${openingBalance >= 0 ? `${openingBalance.toLocaleString()} Cr` : `${Math.abs(openingBalance).toLocaleString()} Dr`}\n`;
    csvContent += `Closing Balance: ${closingBalance >= 0 ? `${closingBalance.toLocaleString()} Cr` : `${Math.abs(closingBalance).toLocaleString()} Dr`}\n`;
    csvContent += '\n';
    
    // Add table headers
    const headers = ['Date', 'Type', 'Ref No', 'Description', 'Debit', 'Credit', 'Balance'];
    csvContent += headers.join(',') + '\n';
    
    // Add table data
    sortedData.forEach(row => {
      const rowData = [
        formatDate(row.date),
        row.type,
        row.refNo,
        row.description,
        row.debit > 0 ? row.debit : '',
        row.credit > 0 ? row.credit : '',
        row.balance >= 0 ? `${row.balance} Cr` : `${Math.abs(row.balance)} Dr`
      ];
      csvContent += rowData.join(',') + '\n';
    });
    
    // Add totals row
    if (ledgerData.length > 0) {
      csvContent += `TOTALS:,,,,${totals.totalDebit > 0 ? totals.totalDebit : 0},${totals.totalCredit > 0 ? totals.totalCredit : 0},${totals.totalOutstanding >= 0 ? `+${totals.totalOutstanding} (Receivable)` : `-${Math.abs(totals.totalOutstanding)} (Payable)`}\n`;
    }
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ledger_${selectedPartyObj.firmName}_${formatDate(dateRange.start)}_${formatDate(dateRange.end)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    if (!selectedPartyObj) return;
    
    const printWindow = window.open('', '_blank');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Party Ledger Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .letterhead { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .company-details { font-size: 12px; color: #666; }
            .report-title { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; }
            .report-details { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .text-green-600 { color: #059669; }
            .text-red-600 { color: #dc2626; }
            .bg-gray-50 { background-color: #f9fafb; }
            .font-bold { font-weight: bold; }
            .border-t-2 { border-top: 2px solid #d1d5db; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="letterhead">
            <div class="company-name">${companyDetails?.firmName || 'Company Name'}</div>
            <div class="company-details">
              ${companyDetails?.address && companyDetails?.city && companyDetails?.state ? 
                `<div>${companyDetails.address}, ${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}</div>` : 
                companyDetails?.address ? `<div>${companyDetails.address}</div>` : 
                companyDetails?.city && companyDetails?.state ? `<div>${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}</div>` : ''
              }
              ${companyDetails?.gstin || companyDetails?.contactNumber ? 
                `<div>${companyDetails?.gstin ? `GSTIN: ${companyDetails.gstin}` : ''}${companyDetails?.gstin && companyDetails?.contactNumber ? ' | ' : ''}${companyDetails?.contactNumber ? `Phone: ${companyDetails.contactNumber}` : ''}</div>` : ''
              }
              ${companyDetails?.email ? `<div>Email: ${companyDetails.email}</div>` : ''}
            </div>
          </div>
          
          <div class="report-title">PARTY LEDGER REPORT</div>
          
          <div class="report-details">
            <div><strong>Party:</strong> ${selectedPartyObj.firmName} (${selectedPartyObj.partyType})</div>
            <div><strong>Period:</strong> ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
            <div><strong>Opening Balance:</strong> ${openingBalance >= 0 ? `${openingBalance.toLocaleString()} Cr` : `${Math.abs(openingBalance).toLocaleString()} Dr`}</div>
            <div><strong>Closing Balance:</strong> ${closingBalance >= 0 ? `${closingBalance.toLocaleString()} Cr` : `${Math.abs(closingBalance).toLocaleString()} Dr`}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Ref No</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${sortedData.map(row => `
                <tr>
                  <td>${formatDate(row.date)}</td>
                  <td>${row.type}</td>
                  <td>${row.refNo}</td>
                  <td>${row.description}</td>
                  <td>${row.debit > 0 ? row.debit.toLocaleString() : ''}</td>
                  <td>${row.credit > 0 ? row.credit.toLocaleString() : ''}</td>
                  <td class="${row.balance >= 0 ? 'text-green-600' : 'text-red-600'}">${row.balance >= 0 ? `${row.balance.toLocaleString()} Cr` : `${Math.abs(row.balance).toLocaleString()} Dr`}</td>
                </tr>
              `).join('')}
              ${ledgerData.length > 0 ? `
                <tr class="bg-gray-50 font-bold border-t-2">
                  <td>TOTALS:</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td>${totals.totalDebit > 0 ? totals.totalDebit.toLocaleString() : '0'}</td>
                  <td>${totals.totalCredit > 0 ? totals.totalCredit.toLocaleString() : '0'}</td>
                  <td class="${totals.totalOutstanding >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${totals.totalOutstanding >= 0 
                      ? `+${totals.totalOutstanding.toLocaleString()} (Receivable)` 
                      : `-${Math.abs(totals.totalOutstanding).toLocaleString()} (Payable)`
                    }
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Export as Image function
  const exportAsImage = () => {
    if (!selectedPartyObj) return;
    
    // Create a temporary container for the report
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.style.backgroundColor = 'white';
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12px';
    
    // Create the report content
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${companyDetails?.firmName || 'Company Name'}</div>
        <div style="font-size: 12px; color: #666;">
          ${companyDetails?.address && companyDetails?.city && companyDetails?.state ? 
            `<div>${companyDetails.address}, ${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}</div>` : 
            companyDetails?.address ? `<div>${companyDetails.address}</div>` : 
            companyDetails?.city && companyDetails?.state ? `<div>${companyDetails.city}, ${companyDetails.state} ${companyDetails?.pincode || ''}</div>` : ''
          }
          ${companyDetails?.gstin || companyDetails?.contactNumber ? 
            `<div>${companyDetails?.gstin ? `GSTIN: ${companyDetails.gstin}` : ''}${companyDetails?.gstin && companyDetails?.contactNumber ? ' | ' : ''}${companyDetails?.contactNumber ? `Phone: ${companyDetails.contactNumber}` : ''}</div>` : ''
          }
          ${companyDetails?.email ? `<div>Email: ${companyDetails.email}</div>` : ''}
        </div>
      </div>
      
      <div style="font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0;">PARTY LEDGER REPORT</div>
      
      <div style="margin: 20px 0;">
        <div><strong>Party:</strong> ${selectedPartyObj.firmName} (${selectedPartyObj.partyType})</div>
        <div><strong>Period:</strong> ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
        <div><strong>Opening Balance:</strong> ${openingBalance >= 0 ? `${openingBalance.toLocaleString()} Cr` : `${Math.abs(openingBalance).toLocaleString()} Dr`}</div>
        <div><strong>Closing Balance:</strong> ${closingBalance >= 0 ? `${closingBalance.toLocaleString()} Cr` : `${Math.abs(closingBalance).toLocaleString()} Dr`}</div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Type</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Ref No</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Description</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Debit</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Credit</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(row => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDate(row.date)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.type}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.refNo}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.description}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.debit > 0 ? row.debit.toLocaleString() : ''}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.credit > 0 ? row.credit.toLocaleString() : ''}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: ${row.balance >= 0 ? '#059669' : '#dc2626'}; font-weight: bold;">${row.balance >= 0 ? `${row.balance.toLocaleString()} Cr` : `${Math.abs(row.balance).toLocaleString()} Dr`}</td>
            </tr>
          `).join('')}
          ${ledgerData.length > 0 ? `
            <tr style="background-color: #f9fafb; font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">TOTALS:</td>
              <td style="border: 1px solid #ddd; padding: 8px;"></td>
              <td style="border: 1px solid #ddd; padding: 8px;"></td>
              <td style="border: 1px solid #ddd; padding: 8px;"></td>
              <td style="border: 1px solid #ddd; padding: 8px;">${totals.totalDebit > 0 ? totals.totalDebit.toLocaleString() : '0'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${totals.totalCredit > 0 ? totals.totalCredit.toLocaleString() : '0'}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: ${totals.totalOutstanding >= 0 ? '#059669' : '#dc2626'}; font-weight: bold;">
                ${totals.totalOutstanding >= 0 
                  ? `+${totals.totalOutstanding.toLocaleString()} (Receivable)` 
                  : `-${Math.abs(totals.totalOutstanding).toLocaleString()} (Payable)`
                }
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;
    
    document.body.appendChild(container);
    
    // Use html2canvas to convert to image
    import('html2canvas').then(html2canvas => {
      html2canvas.default(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      }).then(canvas => {
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ledger_${selectedPartyObj.firmName}_${formatDate(dateRange.start)}_${formatDate(dateRange.end)}.png`;
          link.click();
          
          // Cleanup
          URL.revokeObjectURL(url);
          document.body.removeChild(container);
        }, 'image/png');
      });
    }).catch(error => {
      console.error('Error loading html2canvas:', error);
      alert('Error generating image. Please try again.');
      document.body.removeChild(container);
    });
  };

  // Share Link function
  const shareLink = () => {
    const shareData = {
      title: 'ACCTOO Party Ledger',
      text: `Check out this Party Ledger report for ${selectedPartyObj?.firmName} from ACCTOO`,
      url: window.location.href
    };
    
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback for browsers that don't support Web Share API
      const url = `https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`;
      window.open(url, '_blank');
    }
  };

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
    
    const fetchCustomerLedger = async () => {
      if (!db || !userId || !selectedParty) {
        console.log('Early return - missing required data:', { db: !!db, userId, selectedParty });
        return;
      }
      
      setLoading(true);
      try {
        const basePath = `artifacts/acc-app-e5316/users/${userId}`;
        
        // Get selected party details
        const selectedPartyObj = parties.find(p => p.id === selectedParty);
        if (!selectedPartyObj) {
          console.error('Selected party not found');
          setLoading(false);
          return;
        }

        console.log('Selected party:', selectedPartyObj);
        console.log('Selected party ID:', selectedParty);
        console.log('All parties:', parties.map(p => ({ id: p.id, firmName: p.firmName, partyType: p.partyType })));

        // Initialize ledger entries array
        let allTransactions = [];
        
        console.log('=== Starting Customer Ledger Data Fetch ===');
        console.log('Party Type:', selectedPartyObj.partyType);
        console.log('Date Range:', dateRange);

        // 1. Fetch Sales Bills (if party is Buyer or Both)
        if (selectedPartyObj.partyType === 'Buyer' || selectedPartyObj.partyType === 'Both') {
        const salesQuery = query(
            collection(db, `${basePath}/salesBills`),
            orderBy('invoiceDate', 'asc')
        );
        const salesSnapshot = await getDocs(salesQuery);
          const sales = salesSnapshot.docs.map(doc => {
            const data = doc.data();
            // Get partyId from customFields or party field
            let partyId = data.customFields?.party || data.party || data.partyId;
            
            // Only include if it's for the selected party
            console.log('Sales - Party ID check:', { partyId, selectedParty, matches: partyId === selectedParty });
            if (partyId !== selectedParty) return null;
            
            // Parse invoiceDate as Date
            let saleDate = data.invoiceDate;
            let saleDateObj = saleDate ? new Date(saleDate) : null;
            
            // Get invoice number
            let invoiceNumber = data.customFields?.number || data.invoiceNumber || data.billNumber || data.number || data.invoiceNo || doc.id;
            
            // Handle advance invoices (ADV-INV) as negative amounts
            let baseAmount = Number(data.amount) || 0;
            let isAdvanceInvoice = invoiceNumber && invoiceNumber.startsWith('ADV-INV');
            let totalAmount = isAdvanceInvoice ? -baseAmount : baseAmount;
            
            return {
              id: doc.id,
              date: saleDateObj,
              type: 'Sales Invoice',
              refNo: invoiceNumber,
              description: `Sale of goods - ${invoiceNumber}`,
              debit: 0, // Customer owes us (Credit)
              credit: totalAmount,
              amount: totalAmount,
              items: data.rows || [],
              isAdvanceInvoice,
              transactionType: 'sale',
              ...data
            };
          }).filter(Boolean); // Remove null entries
          
          allTransactions = [...allTransactions, ...sales];
          console.log('Sales Bills found:', sales.length);
        }

        // 2. Fetch Purchase Bills (if party is Seller or Both)
        if (selectedPartyObj.partyType === 'Seller' || selectedPartyObj.partyType === 'Both') {
          console.log('Fetching purchase bills for Seller party...');
          const purchasesQuery = query(
            collection(db, `${basePath}/purchaseBills`),
            orderBy('billDate', 'asc')
          );
          const purchasesSnapshot = await getDocs(purchasesQuery);
          const purchases = purchasesSnapshot.docs.map(doc => {
            const data = doc.data();
            // Get partyId from customFields or party field
            let partyId = data.customFields?.party || data.party || data.partyId;
            
            // Only include if it's for the selected party
            console.log('Purchase - Party ID check:', { partyId, selectedParty, matches: partyId === selectedParty });
            if (partyId !== selectedParty) return null;
            
            // Parse billDate as Date
            let billDate = data.billDate;
            let billDateObj = billDate ? new Date(billDate) : null;
            
            // Get bill number
            let billNumber = data.customFields?.number || data.billNumber || data.number || data.billNo || doc.id;
            
            let totalAmount = Number(data.amount) || 0;
            
            return {
          id: doc.id,
              date: billDateObj,
              type: 'Purchase Bill',
              refNo: billNumber,
              description: `Purchase of goods - ${billNumber}`,
              debit: totalAmount, // We owe supplier (Debit)
              credit: 0,
              amount: totalAmount,
              items: data.rows || [],
              transactionType: 'purchase',
              ...data
            };
          }).filter(Boolean); // Remove null entries
          
          allTransactions = [...allTransactions, ...purchases];
          console.log('Purchase Bills found:', purchases.length);
        }

        // 3. Fetch Payments
        console.log('Fetching all payments...');
        const paymentsQuery = query(
          collection(db, `${basePath}/payments`),
          orderBy('paymentDate', 'asc')
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log('Total payments found:', paymentsSnapshot.docs.length);
        console.log('Payment documents:', paymentsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
        
        const payments = paymentsSnapshot.docs.map(doc => {
          const data = doc.data();
          // Get partyId
          let partyId = data.partyId;
          
          // Only include if it's for the selected party
          console.log('Payment - Party ID check:', { partyId, selectedParty, matches: partyId === selectedParty });
          if (partyId !== selectedParty) return null;
          
          // Parse paymentDate as Date
          let paymentDate = data.paymentDate || data.date;
          let paymentDateObj = paymentDate ? new Date(paymentDate) : null;
          
          // Get receipt number
          let receiptNumber = data.receiptNumber || data.number || doc.id;
          
          let totalAmount = Number(data.totalAmount || data.amount || data.paymentAmount || 0);
          
          // Determine payment type based on receipt number prefix and party type
          let paymentType = 'Payment';
          let description = `Payment - ${receiptNumber}`;
          let isSalesPayment = false;
          let isPurchasePayment = false;
          
          if (receiptNumber && receiptNumber.startsWith('PRI')) {
            paymentType = 'Payment Receipt (Sales)';
            description = `Amount received against ${receiptNumber}`;
            isSalesPayment = true;
          } else if (receiptNumber && receiptNumber.startsWith('PRP')) {
            paymentType = 'Payment Receipt (Purchase)';
            description = `Payment made to supplier - ${receiptNumber}`;
            isPurchasePayment = true;
          }
          
          // For Both party type, determine payment type based on receipt prefix
          // For Buyer party type, only show PRI payments (they pay us)
          // For Seller party type, only show PRP payments (we pay them)
          if (selectedPartyObj.partyType === 'Buyer' && !isSalesPayment) {
            console.log('Skipping payment for Buyer - not a sales payment:', receiptNumber);
            return null; // Skip non-sales payments for buyers
          }
          if (selectedPartyObj.partyType === 'Seller' && !isPurchasePayment) {
            console.log('Skipping payment for Seller - not a purchase payment:', receiptNumber);
            return null; // Skip non-purchase payments for sellers
          }
          
          return {
            id: doc.id,
            date: paymentDateObj,
            type: paymentType,
            refNo: receiptNumber,
            description,
            debit: isSalesPayment ? totalAmount : 0, // PRI: Customer paid us (reduces receivable)
            credit: isPurchasePayment ? totalAmount : 0, // PRP: We paid supplier (reduces payable)
            amount: totalAmount,
            transactionType: 'payment',
            isSalesPayment,
            isPurchasePayment,
            ...data
          };
        }).filter(Boolean); // Remove null entries
        
        allTransactions = [...allTransactions, ...payments];
        console.log('Payments found:', payments.length);

        // Sort all transactions by date
        allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate opening balance (transactions before date range)
        const openingTransactions = allTransactions.filter(t => {
          if (!dateRange.start) return false; // No opening balance if no start date
          return new Date(t.date) < dateRange.start;
        });

        let openingBal = 0;
        openingTransactions.forEach(transaction => {
          if (transaction.transactionType === 'sale') {
            // Sales invoice: Customer owes us (Credit)
            openingBal += transaction.credit;
          } else if (transaction.transactionType === 'purchase') {
            // Purchase bill: We owe supplier (Debit)
            openingBal -= transaction.debit;
          } else if (transaction.transactionType === 'payment') {
            // Payment: Reduces balance
            if (transaction.isSalesPayment) {
              openingBal -= transaction.debit; // PRI: Customer paid us
            } else if (transaction.isPurchasePayment) {
              openingBal += transaction.credit; // PRP: We paid supplier
            }
          }
        });
        setOpeningBalance(openingBal);

        // Filter transactions within date range (or show all if no date range)
        const filteredTransactions = allTransactions.filter(t => {
          if (!dateRange.start || !dateRange.end) return true; // Show all if no date range
          return new Date(t.date) >= dateRange.start && new Date(t.date) <= dateRange.end;
        });

        // Calculate running balance and create ledger entries
        const ledgerEntries = [];
        let runningBalance = openingBal;

        filteredTransactions.forEach(transaction => {
          if (transaction.transactionType === 'sale') {
            // Sales invoice: Customer owes us (Credit)
            runningBalance += transaction.credit;
          } else if (transaction.transactionType === 'purchase') {
            // Purchase bill: We owe supplier (Debit)
            runningBalance -= transaction.debit;
          } else if (transaction.transactionType === 'payment') {
            // Payment: Reduces balance
            if (transaction.isSalesPayment) {
              runningBalance -= transaction.debit; // PRI: Customer paid us
            } else if (transaction.isPurchasePayment) {
              runningBalance += transaction.credit; // PRP: We paid supplier
            }
          }

            ledgerEntries.push({
              date: transaction.date,
              type: transaction.type,
            refNo: transaction.refNo,
            description: transaction.description,
            debit: transaction.debit,
            credit: transaction.credit,
            balance: runningBalance,
            items: transaction.items || [],
            transactionId: transaction.id,
            transactionType: transaction.transactionType
          });
        });

        setLedgerData(ledgerEntries);
        setClosingBalance(runningBalance);
        
        // Calculate totals
        const totalDebit = ledgerEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
        const totalCredit = ledgerEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
        const totalOutstanding = runningBalance; // Final balance is the outstanding
        
        setTotals({
          totalDebit,
          totalCredit,
          totalOutstanding
        });
        
        console.log('=== Customer Ledger Data Fetch Complete ===');
        console.log('Total transactions:', allTransactions.length);
        console.log('Ledger entries:', ledgerEntries.length);
        console.log('Opening balance:', openingBal);
        console.log('Closing balance:', runningBalance);
        console.log('Totals:', { totalDebit, totalCredit, totalOutstanding });
        console.log('Pagination data:', {
          totalItems: sortedData.length,
          currentPage: pagination.currentPage,
          pageSize: pagination.pageSize,
          currentDataLength: pagination.currentData.length
        });

      } catch (error) {
        console.error('Error fetching customer ledger data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerLedger();
  }, [db, userId, dateRange, selectedParty, parties]);

  // Handle row click
  const handleRowClick = (entry) => {
    handleEntryClick(entry);
  };



  // Table columns
  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'refNo', label: 'Invoice/Receipt No.' },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit (Rs)' },
    { key: 'credit', label: 'Credit (Rs)' },
    { key: 'balance', label: 'Balance (Rs)' }
  ];

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

          {/* Export/Print/Share Buttons */}
          <div className="flex gap-2">
            <button 
              onClick={exportToPDF}
              disabled={ledgerData.length === 0}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
            >
              📄 Export PDF
            </button>
            <button 
              onClick={exportToExcel}
              disabled={ledgerData.length === 0}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
            >
              📊 Export Excel
            </button>
            <button 
              onClick={printReport}
              disabled={ledgerData.length === 0}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
            >
              🖨️ Print
            </button>
            <ShareButton
              onExportPDF={exportToPDF}
              onExportExcel={exportToExcel}
              onExportImage={exportAsImage}
              onShareLink={shareLink}
              disabled={ledgerData.length === 0}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Opening Balance</div>
          <div className={`text-lg font-bold ${openingBalance >= 0 ? 'text-blue-800' : 'text-red-800'}`}>
            {openingBalance >= 0 ? `${formatCurrency(openingBalance)} Cr` : `${formatCurrency(Math.abs(openingBalance))} Dr`}
          </div>
          <div className="text-xs text-gray-500 mt-1">Last Financial Year Carry Forward</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Total Debit</div>
          <div className="text-lg font-bold text-red-800">
            {formatCurrency(totals.totalDebit)}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Credit</div>
          <div className="text-lg font-bold text-green-800">
            {formatCurrency(totals.totalCredit)}
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600 font-medium">Closing Balance</div>
          <div className={`text-lg font-bold ${closingBalance >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            {closingBalance >= 0 ? `${formatCurrency(closingBalance)} Cr` : `${formatCurrency(Math.abs(closingBalance))} Dr`}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total Entries</div>
          <div className="text-lg font-bold text-purple-800">{ledgerData.length}</div>
        </div>
      </div>

      {/* Color Legend */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-700 mb-2">Color Code Legend:</div>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-green-700">Green (+): Receivable (They owe us)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-red-700">Red (-): Payable (We owe them)</span>
          </div>
        </div>
      </div>



      {/* Ledger Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
              {columns.map(col => (
                <SortableHeader 
                  key={col.key}
                  columnKey={col.key}
                  label={col.label}
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
              ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {pagination.currentData.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-gray-400">No ledger entries found</td></tr>
            ) : pagination.currentData.map((row, idx) => (
              <tr key={row.transactionId || idx} className="cursor-pointer hover:bg-blue-50" onClick={() => handleRowClick(row)}>
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