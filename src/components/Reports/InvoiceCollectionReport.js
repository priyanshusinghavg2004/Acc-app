import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import { formatCurrency, formatDate } from './CommonComponents';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ShareButton from './ShareButton';

const InvoiceCollectionReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading, isAuthReady }) => {
  const [collectionData, setCollectionData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalOutstanding: 0
  });
  const [showQuickSummary, setShowQuickSummary] = useState(false);
  const [quickSummaryInvoice, setQuickSummaryInvoice] = useState(null);
  const [itemNames, setItemNames] = useState({});
  const [companyDetails, setCompanyDetails] = useState(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState([]);

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(collectionData, { key: 'invoiceDate', direction: 'desc' });
  const pagination = useTablePagination(sortedData, 10);

  // ESC key handler for closing modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showQuickSummary) {
                  setShowQuickSummary(false);
        setQuickSummaryInvoice(null);
      }
      if (showReceiptPreview) {
        setShowReceiptPreview(false);
        setQuickSummaryInvoice(null);
        setInvoicePayments([]);
      }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showQuickSummary, showReceiptPreview]);

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
    if (collectionData.length === 0) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // PDF-safe currency formatter (avoid ₹ glyph issues)
    const formatCurrencyPdf = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;
    
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
    
    yPosition += 10;
    
    // Report title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE-WISE COLLECTION REPORT', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    // Report details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Total Invoices: ${totalSummary.totalInvoices}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Total Amount: ${formatCurrencyPdf(totalSummary.totalAmount)}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Total Paid: ${formatCurrencyPdf(totalSummary.totalPaid)}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Total Outstanding: ${formatCurrencyPdf(totalSummary.totalOutstanding)}`, 14, yPosition);
    yPosition += 10;
    
    // Table data
    const tableData = sortedData.map(row => [
      row.invoiceNo,
      formatDate(row.invoiceDate),
      row.partyName,
      formatCurrencyPdf(row.invoiceAmount),
      formatCurrencyPdf(row.paidAmount),
      formatCurrencyPdf(row.balance),
      row.status
    ]);
    
    // Add table
    autoTable(doc, {
      startY: yPosition,
      head: [['Invoice No', 'Date', 'Party', 'Amount', 'Paid', 'Balance', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 25 }
      }
    });
    
    doc.save(`invoice_collection_${formatDate(dateRange.start)}_${formatDate(dateRange.end)}.pdf`);
  };

  const exportToExcel = () => {
    if (collectionData.length === 0) return;
    
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
    csvContent += 'INVOICE-WISE COLLECTION REPORT\n\n';
    
    // Add report details
    csvContent += `Period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n`;
    csvContent += `Total Invoices: ${totalSummary.totalInvoices}\n`;
    csvContent += `Total Amount: Rs ${totalSummary.totalAmount.toLocaleString()}\n`;
    csvContent += `Total Paid: Rs ${totalSummary.totalPaid.toLocaleString()}\n`;
    csvContent += `Total Outstanding: Rs ${totalSummary.totalOutstanding.toLocaleString()}\n`;
    csvContent += '\n';
    
    // Add table headers
    const headers = ['Invoice No', 'Date', 'Party', 'Amount', 'Paid', 'Balance', 'Status', 'Payments Applied'];
    csvContent += headers.join(',') + '\n';
    
    // Add table data
    sortedData.forEach(row => {
      const rowData = [
        row.invoiceNo,
        formatDate(row.invoiceDate),
        row.partyName,
        row.invoiceAmount,
        row.paidAmount,
        row.balance,
        row.status,
        row.paymentsApplied ? row.paymentsApplied.replace(/<br>/g, '; ') : ''
      ];
      csvContent += rowData.join(',') + '\n';
    });
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoice_collection_${formatDate(dateRange.start)}_${formatDate(dateRange.end)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    if (collectionData.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice Collection Report</title>
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
          
          <div class="report-title">INVOICE-WISE COLLECTION REPORT</div>
          
          <div class="report-details">
            <div><strong>Period:</strong> ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
            <div><strong>Total Invoices:</strong> ${totalSummary.totalInvoices}</div>
            <div><strong>Total Amount:</strong> Rs ${totalSummary.totalAmount.toLocaleString()}</div>
            <div><strong>Total Paid:</strong> Rs ${totalSummary.totalPaid.toLocaleString()}</div>
            <div><strong>Total Outstanding:</strong> Rs ${totalSummary.totalOutstanding.toLocaleString()}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Payments Applied</th>
              </tr>
            </thead>
            <tbody>
              ${sortedData.map(row => `
                <tr>
                  <td>${row.invoiceNo}</td>
                  <td>${formatDate(row.invoiceDate)}</td>
                  <td>${row.partyName}</td>
                  <td>Rs ${row.invoiceAmount.toLocaleString()}</td>
                  <td class="text-green-600">Rs ${row.paidAmount.toLocaleString()}</td>
                  <td class="${row.balance > 0 ? 'text-red-600' : 'text-green-600'}">Rs ${row.balance.toLocaleString()}</td>
                  <td>
                    <span class="${row.status === 'Paid' ? 'text-green-600' : row.status === 'Partially Paid' ? 'text-yellow-600' : 'text-red-600'}">
                      ${row.status}
                    </span>
                  </td>
                  <td>${row.paymentsApplied ? row.paymentsApplied.replace(/<br>/g, '<br>') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const exportAsImage = () => {
    if (collectionData.length === 0) return;
    
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
      
      <div style="font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0;">INVOICE-WISE COLLECTION REPORT</div>
      
      <div style="margin: 20px 0;">
        <div><strong>Period:</strong> ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
        <div><strong>Total Invoices:</strong> ${totalSummary.totalInvoices}</div>
        <div><strong>Total Amount:</strong> ₹${totalSummary.totalAmount.toLocaleString()}</div>
        <div><strong>Total Paid:</strong> ₹${totalSummary.totalPaid.toLocaleString()}</div>
        <div><strong>Total Outstanding:</strong> ₹${totalSummary.totalOutstanding.toLocaleString()}</div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Invoice No</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Party</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Amount</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Paid</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Balance</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Status</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Payments Applied</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(row => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.invoiceNo}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formatDate(row.invoiceDate)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.partyName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">₹${row.invoiceAmount.toLocaleString()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: #059669;">₹${row.paidAmount.toLocaleString()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: ${row.balance > 0 ? '#dc2626' : '#059669'}; font-weight: bold;">₹${row.balance.toLocaleString()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: ${row.status === 'Paid' ? '#059669' : row.status === 'Partially Paid' ? '#d97706' : '#dc2626'}; font-weight: bold;">${row.status}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.paymentsApplied ? row.paymentsApplied.replace(/<br>/g, '<br>') : '-'}</td>
            </tr>
          `).join('')}
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
          link.download = `invoice_collection_${formatDate(dateRange.start)}_${formatDate(dateRange.end)}.png`;
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
      title: 'ACCTOO Invoice Collection Report',
      text: `Check out this Invoice Collection report from ACCTOO for period ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`,
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

  // Handle invoice click for quick summary
  const handleInvoiceClick = async (invoice) => {
    setQuickSummaryInvoice(invoice);
    setShowQuickSummary(true);
    
    // Fetch item names for this invoice
    if (invoice.items && invoice.items.length > 0) {
      const itemIds = invoice.items.map(item => item.item || item.id || item.itemId || item.productId).filter(Boolean);
      if (itemIds.length > 0) {
        const names = await fetchItemNames(itemIds);
        setItemNames(names);
      }
    }
  };

  // Fetch collection data
  useEffect(() => {
    const fetchInvoiceCollection = async () => {
      if (!db || !userId) return;
      
      setLoading(true);
      try {
        const basePath = `artifacts/acc-app-e5316/users/${userId}`;
        
        // 1. Fetch all sales bills
        const salesQuery = query(collection(db, `${basePath}/salesBills`));
        const salesSnapshot = await getDocs(salesQuery);
        const allSales = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
            date: data.date ? new Date(data.date) : null,
            billType: 'sales'
          };
        });
        
        // 1.1. Fetch all purchase bills
        const purchaseQuery = query(collection(db, `${basePath}/purchaseBills`));
        const purchaseSnapshot = await getDocs(purchaseQuery);
        const allPurchases = purchaseSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
            date: data.date ? new Date(data.date) : null,
            billType: 'purchase'
          };
        });
        
        // Combine all bills
        const allBills = [...allSales, ...allPurchases];
        console.log('Total bills (sales + purchases):', allBills.length);
        
        // 2. Filter bills by date range
        const filteredBills = allBills.filter(bill => {
          const billDate = bill.invoiceDate || bill.date;
          if (!billDate) return false;
          return billDate >= dateRange.start && billDate <= dateRange.end;
        });
        
        console.log('Filtered bills by date range:', filteredBills.length);
        
        // 3. Filter by selected party if specified
        let finalBills = filteredBills;
        if (selectedParty) {
          finalBills = filteredBills.filter(bill => bill.partyId === selectedParty || bill.party === selectedParty);
          console.log('Filtered bills by party:', finalBills.length);
        }
        
        // 4. Fetch all payments
        console.log('Fetching payments...');
        const paymentsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/payments`));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const allPayments = paymentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
            date: data.date ? new Date(data.date) : null
          };
        });
        
        // 5. Filter payments by date range (payments up to end date)
        const filteredPayments = allPayments.filter(payment => {
          const paymentDate = payment.paymentDate || payment.date;
          if (!paymentDate) return false;
          return paymentDate <= dateRange.end;
        });
        
        // 6. Process each bill with FIFO payment allocation
        const collectionReport = [];
        
        finalBills.forEach(bill => {
                    // Get payments for this party (check both partyId and party fields)
          const billPartyId = bill.partyId || bill.party;
          const partyPayments = filteredPayments
            .filter(p => p.partyId === billPartyId || p.party === billPartyId)
            .sort((a, b) => {
              const dateA = a.paymentDate || a.date;
              const dateB = b.paymentDate || b.date;
              return dateA - dateB;
            });
          

          
          // Apply FIFO payment logic
          let remainingPayments = [...partyPayments];
          let totalPaid = 0;
          let remainingBillAmount = bill.totalAmount || bill.amount || 0;
          const paymentsApplied = [];
          
          // Debug logging for specific invoices
          const currentInvoiceNo = bill.invoiceNumber || bill.number || bill.id;
          if (currentInvoiceNo === 'INV25-26/10' || currentInvoiceNo === 'INV25-26/11') {
            console.log(`=== Processing ${currentInvoiceNo} ===`);
            console.log('Bill amount:', bill.totalAmount || bill.amount || 0);
            console.log('Party payments:', partyPayments.map(p => ({
              receiptNumber: p.receiptNumber,
              amount: p.totalAmount || p.amount || 0,
              date: p.paymentDate || p.date
            })));
          }
          
          // Filter payments for this specific invoice (same logic as handleReceiptClick)
          const invoiceSpecificPayments = remainingPayments.filter(payment => {
            // Special handling for advance receipts
            if (payment.receiptNumber && payment.receiptNumber.startsWith('ADV-')) {
              const targetInvoiceNo = payment.receiptNumber.replace('ADV-', '');
              const currentInvoiceNo = bill.invoiceNumber || bill.number || bill.id;
              return targetInvoiceNo === currentInvoiceNo;
            }
            
            // Check if payment has allocations for this invoice
            if (payment.allocations && Array.isArray(payment.allocations)) {
              return payment.allocations.some(allocation => 
                allocation.billId === bill.id
              );
            }
            
            // Check if payment has advance allocations for this invoice
            if (payment.advanceAllocations && Array.isArray(payment.advanceAllocations)) {
              return payment.advanceAllocations.some(allocation => 
                allocation.billId === bill.id
              );
            }
            
            // Check direct billId match
            if (payment.billId === bill.id) {
              return true;
            }
            
            return false;
          });
          
          if (currentInvoiceNo === 'INV25-26/10' || currentInvoiceNo === 'INV25-26/11') {
            console.log(`FIFO: Filtered payments for ${currentInvoiceNo}:`, invoiceSpecificPayments.map(p => p.receiptNumber));
          }
          
          // Apply payments to this bill using FIFO
          for (let i = 0; i < invoiceSpecificPayments.length && remainingBillAmount > 0; i++) {
            const payment = invoiceSpecificPayments[i];
            
            const paymentAmount = payment.totalAmount || payment.amount || 0;
            const amountToApply = Math.min(paymentAmount, remainingBillAmount);
            
            if (amountToApply > 0) {
              paymentsApplied.push(`${payment.receiptNumber}: ₹${amountToApply.toLocaleString()}`);
              totalPaid += amountToApply;
              remainingBillAmount -= amountToApply;
              
              if (currentInvoiceNo === 'INV25-26/10' || currentInvoiceNo === 'INV25-26/11') {
                console.log(`Applied ${payment.receiptNumber}: ₹${amountToApply.toLocaleString()}`);
              }
            }
          }
          
          if (currentInvoiceNo === 'INV25-26/10' || currentInvoiceNo === 'INV25-26/11') {
            console.log(`Final paymentsApplied for ${currentInvoiceNo}:`, paymentsApplied);
            console.log(`Receipt count: ${paymentsApplied.length}`);
          }
          
          const balance = (bill.totalAmount || bill.amount || 0) - totalPaid;
          const status = totalPaid >= (bill.totalAmount || bill.amount || 0) ? 'Paid' : 
                        totalPaid > 0 ? 'Partially Paid' : 'Outstanding';
          
                    // Get party name from parties array or fallback
          let partyName = 'Unknown Party';
          
          if (parties && parties.length > 0) {
            const partyObj = parties.find(p => p.id === billPartyId);
            if (partyObj) {
              partyName = partyObj.firmName || partyObj.name || partyObj.partyName;
            } else {
              partyName = bill.partyName || bill.party || billPartyId || 'Unknown Party';
            }
          } else {
            partyName = bill.partyName || bill.party || billPartyId || 'Unknown Party';
          }
          
          collectionReport.push({
            invoiceNo: bill.invoiceNumber || bill.number || bill.id,
            invoiceDate: bill.invoiceDate || bill.date,
            partyName: partyName,
            partyId: bill.partyId || bill.party,
            invoiceAmount: parseFloat(bill.totalAmount || bill.amount || 0),
            paidAmount: parseFloat(totalPaid),
            balance: parseFloat(balance),
            paymentsApplied: paymentsApplied.join('<br>'),
            receiptCount: paymentsApplied.length, // Add actual receipt count
            status: status,
            invoiceId: bill.id,
            items: bill.items || [],
            billType: bill.billType
          });
        });
        

        
        setCollectionData(collectionReport);
        
        // Calculate totals
        const totals = collectionReport.reduce((acc, invoice) => ({
          totalInvoices: acc.totalInvoices + 1,
          totalAmount: acc.totalAmount + invoice.invoiceAmount,
          totalPaid: acc.totalPaid + invoice.paidAmount,
          totalOutstanding: acc.totalOutstanding + invoice.balance
        }), {
          totalInvoices: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalOutstanding: 0
        });
        
        setTotalSummary(totals);
        
      } catch (error) {
        console.error('Error fetching invoice collection data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceCollection();
  }, [db, userId, dateRange, selectedParty]);

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

  // Handle row click - open invoice
  const handleRowClick = (invoice) => {
    handleInvoiceClick(invoice);
  };

  // Handle receipt click - open receipt preview
  const handleReceiptClick = async (invoice) => {
    try {
      const basePath = `artifacts/acc-app-e5316/users/${userId}`;
      const paymentsQuery = query(collection(db, `${basePath}/payments`));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const allPayments = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Debug logging for specific invoices
      if (invoice.invoiceNo === 'INV25-26/10' || invoice.invoiceNo === 'INV25-26/11') {
        console.log(`=== handleReceiptClick for ${invoice.invoiceNo} ===`);
        console.log('Invoice ID:', invoice.invoiceId);
        console.log('Party ID:', invoice.partyId);
        console.log('All payments for party:', allPayments.filter(p => (p.partyId || p.party) === invoice.partyId).map(p => ({
          receiptNumber: p.receiptNumber,
          billId: p.billId,
          allocations: p.allocations,
          advanceAllocations: p.advanceAllocations
        })));
      }
      
      // Filter payments for this specific invoice
      const invoicePayments = allPayments.filter(payment => {
        const paymentPartyId = payment.partyId || payment.party;
        
        // Check if payment is for the same party
        if (paymentPartyId !== invoice.partyId) {
          return false;
        }
        
        // Special handling for advance receipts
        if (payment.receiptNumber && payment.receiptNumber.startsWith('ADV-')) {
          // Extract invoice number from advance receipt (e.g., ADV-INV25-26/12 -> INV25-26/12)
          const targetInvoiceNo = payment.receiptNumber.replace('ADV-', '');
          const isMatch = targetInvoiceNo === invoice.invoiceNo;
          
          if (invoice.invoiceNo === 'INV25-26/10' || invoice.invoiceNo === 'INV25-26/11') {
            console.log(`Advance receipt ${payment.receiptNumber}: target=${targetInvoiceNo}, current=${invoice.invoiceNo}, match=${isMatch}`);
          }
          
          return isMatch;
        }
        
        // Check if payment has allocations for this invoice
        if (payment.allocations && Array.isArray(payment.allocations)) {
          const hasAllocation = payment.allocations.some(allocation => 
            allocation.billId === invoice.invoiceId
          );
          
          if (invoice.invoiceNo === 'INV25-26/10' || invoice.invoiceNo === 'INV25-26/11') {
            console.log(`Payment ${payment.receiptNumber} allocations check:`, hasAllocation);
          }
          
          return hasAllocation;
        }
        
        // Check if payment has advance allocations for this invoice
        if (payment.advanceAllocations && Array.isArray(payment.advanceAllocations)) {
          const hasAdvanceAllocation = payment.advanceAllocations.some(allocation => 
            allocation.billId === invoice.invoiceId
          );
          
          if (invoice.invoiceNo === 'INV25-26/10' || invoice.invoiceNo === 'INV25-26/11') {
            console.log(`Payment ${payment.receiptNumber} advance allocations check:`, hasAdvanceAllocation);
          }
          
          return hasAdvanceAllocation;
        }
        
        // Check direct billId match
        if (payment.billId === invoice.invoiceId) {
          if (invoice.invoiceNo === 'INV25-26/10' || invoice.invoiceNo === 'INV25-26/11') {
            console.log(`Payment ${payment.receiptNumber} direct billId match:`, true);
          }
          return true;
        }
        
        return false;
      });
      
      if (invoice.invoiceNo === 'INV25-26/10' || invoice.invoiceNo === 'INV25-26/11') {
        console.log(`Final filtered payments for ${invoice.invoiceNo}:`, invoicePayments.map(p => p.receiptNumber));
        console.log(`Modal receipt count: ${invoicePayments.length}`);
      }
      
      if (invoicePayments.length > 0) {
        setQuickSummaryInvoice(invoice);
        setInvoicePayments(invoicePayments);
        setShowReceiptPreview(true);
      } else {
        alert('No payment receipts found for this invoice.');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      alert('Error loading payment receipts.');
    }
  };

  // Find selected party object
  const selectedPartyObj = parties.find(p => p.id === selectedParty);
  
  // Table data - use collectionData directly since party names are already resolved
  const displayData = collectionData;

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Bill-wise Collection Report</h2>
            <p className="text-gray-600">
              Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
              {selectedParty && ` | Party: ${selectedPartyObj ? selectedPartyObj.firmName : selectedParty}`}
            </p>
          </div>

          {/* Export/Print/Share Buttons */}
          <div className="flex gap-2">
            <button 
              onClick={exportToPDF}
              disabled={collectionData.length === 0}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
            >
              📄 Export PDF
            </button>
            <button 
              onClick={exportToExcel}
              disabled={collectionData.length === 0}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
            >
              📊 Export Excel
            </button>
            <button 
              onClick={printReport}
              disabled={collectionData.length === 0}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
            >
              🖨️ Print
            </button>
            <ShareButton
              onExportPDF={exportToPDF}
              onExportExcel={exportToExcel}
              onExportImage={exportAsImage}
              onShareLink={shareLink}
              disabled={collectionData.length === 0}
            />
          </div>
        </div>
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
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Total Paid</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totalSummary.totalPaid)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Outstanding</div>
          <div className="text-2xl font-bold text-red-800">{formatCurrency(totalSummary.totalOutstanding)}</div>
        </div>
      </div>
      {/* Collection Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader 
                  columnKey="invoiceNo" 
                  label="BILL NUMBER" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
                <SortableHeader 
                  columnKey="partyName" 
                  label="PARTY NAME" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
                <SortableHeader 
                  columnKey="invoiceAmount" 
                  label="TOTAL AMOUNT" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
                <SortableHeader 
                  columnKey="paidAmount" 
                  label="TOTAL PAID" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
                <SortableHeader 
                  columnKey="balance" 
                  label="OUTSTANDING" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PAYMENT RECEIPTS
                </th>
                <SortableHeader 
                  columnKey="status" 
                  label="STATUS" 
                  onSort={handleSort} 
                  sortConfig={sortConfig} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600"
                />
              </tr>
            </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
              {pagination.currentData.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No data found</td></tr>
              ) : pagination.currentData.map((invoice, index) => (
                <tr 
                  key={invoice.invoiceId || index} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(invoice)}
                >
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoiceNo}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.partyName}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    Rs {parseFloat(invoice.invoiceAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    Rs {parseFloat(invoice.paidAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-medium ${invoice.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs {parseFloat(invoice.balance || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReceiptClick(invoice);
                      }}
                      className="text-blue-600 hover:text-blue-900 font-medium underline"
                      title="View Payment Receipts"
                    >
                      Receipts ({invoice.receiptCount || 0})
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              {(() => {
                const totals = sortedData.reduce((acc, bill) => ({
                  totalInvoices: acc.totalInvoices + 1,
                  totalAmount: acc.totalAmount + (bill.invoiceAmount || 0),
                  totalPaid: acc.totalPaid + (bill.paidAmount || 0),
                  totalOutstanding: acc.totalOutstanding + (bill.balance || 0)
                }), {
                  totalInvoices: 0,
                  totalAmount: 0,
                  totalPaid: 0,
                  totalOutstanding: 0
                });
                
                return (
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>Total ({totals.totalInvoices} bills)</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>₹{totals.totalAmount.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>₹{totals.totalPaid.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong className="text-red-600">₹{totals.totalOutstanding.toLocaleString('en-IN')}</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <strong>-</strong>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <PaginationControls {...pagination} />
      </div>
      {/* FIFO Information */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">FIFO Payment Tracking</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Payments are applied to invoices using First-In-First-Out (FIFO) method. 
              Older invoices are settled first before applying payments to newer ones.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Summary Modal */}
      {showQuickSummary && quickSummaryInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => setShowQuickSummary(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-center">Invoice Summary</h3>
            <div className="space-y-3">
              <div><strong>Invoice Number:</strong> {quickSummaryInvoice.invoiceNo}</div>
              <div><strong>Date:</strong> {formatDate(quickSummaryInvoice.invoiceDate)}</div>
              <div><strong>Party:</strong> {quickSummaryInvoice.partyName}</div>
              <div><strong>Amount:</strong> {formatCurrency(quickSummaryInvoice.invoiceAmount)}</div>
              <div><strong>Paid Amount:</strong> {formatCurrency(quickSummaryInvoice.paidAmount)}</div>
              <div><strong>Balance:</strong> {formatCurrency(quickSummaryInvoice.balance)}</div>
              
              {/* Items List */}
              {quickSummaryInvoice.items && quickSummaryInvoice.items.length > 0 && (
                <div>
                  <strong>Items:</strong>
                  <div className="ml-4 mt-1 space-y-1">
                    {quickSummaryInvoice.items.map((item, idx) => {
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
      
      {/* Receipt Preview Modal */}
      {showReceiptPreview && quickSummaryInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl relative overflow-y-auto max-h-[95vh]">
            <button 
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" 
              onClick={() => {
                setShowReceiptPreview(false);
                setQuickSummaryInvoice(null);
                setInvoicePayments([]);
              }}
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4 text-center">Payment Receipts</h3>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Invoice Number:</strong> {quickSummaryInvoice.invoiceNo}</div>
                <div><strong>Date:</strong> {formatDate(quickSummaryInvoice.invoiceDate)}</div>
                <div><strong>Party:</strong> {quickSummaryInvoice.partyName}</div>
                <div><strong>Total Amount:</strong> {formatCurrency(quickSummaryInvoice.invoiceAmount)}</div>
              </div>

            </div>
            
            {invoicePayments.length > 0 ? (
              <div className="space-y-6">
                {invoicePayments.map((payment, idx) => (
                  <div key={payment.id || idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-semibold text-blue-600">
                        Receipt #{payment.receiptNumber}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {formatDate(payment.paymentDate || payment.date)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <span className="text-sm text-gray-600">Total Amount:</span>
                        <div className="font-semibold text-green-600">
                          ₹{parseFloat(payment.totalAmount || payment.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Allocated Amount:</span>
                        <div className="font-semibold text-blue-600">
                          ₹{parseFloat(payment.allocatedAmount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Mode:</span>
                        <div className="font-medium">{payment.paymentMode || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Reference:</span>
                        <div className="font-medium">{payment.reference || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <span className="text-sm text-gray-600">Type:</span>
                        <div className="font-medium">{payment.paymentType || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Date:</span>
                        <div className="font-medium">{formatDate(payment.paymentDate || payment.date)}</div>
                      </div>
                    </div>
                    
                                         {payment.notes && (
                       <div className="mt-2">
                         <span className="text-sm text-gray-600">Notes:</span>
                         <div className="text-sm italic">{payment.notes}</div>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No payment receipts found for this invoice.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCollectionReport; 