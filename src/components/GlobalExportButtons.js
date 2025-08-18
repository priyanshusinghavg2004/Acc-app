import React from 'react';
import { exportTableAsPDF, exportTableAsExcel, exportTableAsImage, buildReportFilename } from './Reports/exportUtils';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../firebase.config';
import ShareButton from './Reports/ShareButton';
import { SOFTWARE_FOOTER, buildShareMessage } from '../utils/shareUtils';

const GlobalExportButtons = ({ 
  data, 
  columns, 
  filename, 
  title, 
  companyDetails, 
  reportDetails = {},
  showPrint = true,
  showShare = true,
  disabled = false,
  className = "flex gap-2"
}) => {
  
  // Format currency helper
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date helper
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN');
  };

  // Export to PDF
  const exportToPDF = async () => {
    if (!data || data.length === 0) return;
    
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    const finalColumns = columns.map(col => ({
      ...col,
      label: col.label || col.key
    }));
    
    await exportTableAsPDF({
      data,
      columns: finalColumns,
      filename: `${finalFilename}.pdf`,
      title: title || filename,
      companyDetails,
      reportDetails
    });
  };

  // Share helpers
  const shareBlobViaSystem = async (blob, suggestedName, mime, message) => {
    try {
      const file = new File([blob], suggestedName, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: suggestedName, text: message || (title || filename) });
        return true;
      }
    } catch (_) {}
    return false;
  };

  // Share as PDF (attachment)
  const shareAsPDF = async (msg) => {
    if (!data || data.length === 0) return;
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    const finalColumns = columns.map(col => ({ ...col, label: col.label || col.key }));
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      doc.setFontSize(20); doc.setFont(undefined, 'bold');
      doc.text(companyDetails?.firmName || 'Company Name', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(9); doc.setFont(undefined, 'normal');
      let y = 30;
      if (companyDetails?.address) { doc.text(String(companyDetails.address), pageWidth/2, y, {align:'center'}); y+=5; }
      if (companyDetails?.gstin) { doc.text(`GSTIN: ${companyDetails.gstin}`, pageWidth/2, y, {align:'center'}); y+=5; }
      if (companyDetails?.contactNumber) { doc.text(`Phone: ${companyDetails.contactNumber}`, pageWidth/2, y, {align:'center'}); y+=5; }
      y += 3; doc.setDrawColor(200,200,200); doc.line(20, y, pageWidth-20, y); y += 8;
      doc.setFontSize(18); doc.setFont(undefined, 'bold');
      doc.text(title || filename, pageWidth/2, y, {align:'center'}); y += 15;
      doc.setFontSize(10); doc.setFont(undefined, 'normal');
      if (reportDetails) {
        Object.entries(reportDetails).forEach(([k, v]) => { if (k !== 'dateRange') { doc.text(`${k}: ${v}`, 20, y); y += 8; }});
        if (reportDetails.dateRange) {
          const s = new Date(reportDetails.dateRange.start).toLocaleDateString();
          const e = new Date(reportDetails.dateRange.end).toLocaleDateString();
          doc.text(`Period: ${s} to ${e}`, 20, y); y += 8;
        }
        y += 8;
      }
      const headers = finalColumns.map(c => c.label);
      const tableData = data.map(r => finalColumns.map(c => r[c.key] ?? ''));
      autoTable(doc, { head:[headers], body:tableData, startY:y, styles:{fontSize:8}, headStyles:{ fillColor:[66,139,202] } });
      // footer
      const pw = doc.internal.pageSize.width; const ph = doc.internal.pageSize.height;
      doc.setFontSize(8); doc.text(SOFTWARE_FOOTER, pw/2, ph-6, { align: 'center' });
      const blob = doc.output('blob');
      const message = msg || buildShareMessage({ docType: title || filename, companyName: companyDetails?.firmName, phone: companyDetails?.contactNumber });
      const shared = await shareBlobViaSystem(blob, `${finalFilename}.pdf`, 'application/pdf', `${message}\n\n${SOFTWARE_FOOTER}`);
      if (!shared) {
        doc.save(`${finalFilename}.pdf`);
      }
    } catch (e) {
      console.error('Share PDF failed, falling back to export:', e);
      await exportToPDF();
    }
  };

  // Share as Excel (CSV attachment)
  const shareAsExcel = async (msg) => {
    if (!data || data.length === 0) return;
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    try {
      let csv = '';
      if (companyDetails?.firmName) csv += `${companyDetails.firmName}\n`;
      if (companyDetails?.address) csv += `${companyDetails.address}\n`;
      if (companyDetails?.gstin) csv += `GSTIN: ${companyDetails.gstin}\n`;
      csv += '\n';
      if (reportDetails) {
        Object.entries(reportDetails).forEach(([k,v]) => { if (k !== 'dateRange') csv += `${k}: ${v}\n`; });
        csv += '\n';
      }
      const headers = columns.map(c => c.label || c.key); csv += headers.join(',') + '\n';
      data.forEach(row => {
        const rowData = columns.map(c => { const val = row[c.key]; return typeof val === 'number' ? val : `"${(val||'').toString().replace(/"/g,'""')}"`; });
        csv += rowData.join(',') + '\n';
      });
      csv += `\n${SOFTWARE_FOOTER}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const message = msg || buildShareMessage({ docType: title || filename, companyName: companyDetails?.firmName, phone: companyDetails?.contactNumber });
      const shared = await shareBlobViaSystem(blob, `${finalFilename}.csv`, 'text/csv', `${message}\n\n${SOFTWARE_FOOTER}`);
      if (!shared) {
        // fallback to normal export
        exportToExcel();
      }
    } catch (e) {
      console.error('Share CSV failed, falling back to export:', e);
      exportToExcel();
    }
  };

  // Share as Image (PNG attachment)
  const shareAsImage = async (msg) => {
    if (!data || data.length === 0) return;
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    // Build minimal HTML (same as export image)
    const container = document.createElement('div');
    container.style.position = 'absolute'; container.style.left = '-9999px'; container.style.top = '0'; container.style.width = '1200px'; container.style.backgroundColor = 'white'; container.style.padding = '20px'; container.style.fontFamily = 'Arial, sans-serif'; container.style.fontSize = '12px';
    const header = companyDetails?.firmName ? `<div style="text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:20px;"><div style=\"font-size:24px;font-weight:bold;margin-bottom:10px;\">${companyDetails.firmName}</div>${companyDetails.address?`<div style=\"font-size:12px;color:#666;\">${companyDetails.address}</div>`:''}${companyDetails.gstin?`<div style=\"font-size:12px;color:#666;\">GSTIN: ${companyDetails.gstin}</div>`:''}</div>` : '';
    const details = reportDetails ? `<div style=\"margin:20px 0;\">${Object.entries(reportDetails).map(([k,v])=>`<div><strong>${k}:</strong> ${v}</div>`).join('')}</div>` : '';
    const table = `<table style=\"width:100%;border-collapse:collapse;margin-top:20px;\"><thead><tr style=\"background-color:#f2f2f2;\">${columns.map(c=>`<th style=\"border:1px solid #ddd;padding:8px;text-align:left;font-weight:bold;\">${c.label||c.key}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${columns.map(c=>`<td style=\"border:1px solid #ddd;padding:8px;\">${(r[c.key] ?? '').toString()}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const footer = `<div style=\"margin-top:16px;font-size:12px;color:#666;text-align:center;\">${SOFTWARE_FOOTER}</div>`;
    container.innerHTML = header + details + table + footer;
    document.body.appendChild(container);
    try {
      const html2canvas = await import('html2canvas');
      const canvas = await html2canvas.default(container, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' });
      const ctx = canvas.getContext('2d');
      ctx.font = '12px Arial'; ctx.fillStyle = '#666'; ctx.fillText(SOFTWARE_FOOTER, 12, canvas.height - 12);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const message = msg || buildShareMessage({ docType: title || filename, companyName: companyDetails?.firmName, phone: companyDetails?.contactNumber });
      const shared = await shareBlobViaSystem(blob, `${finalFilename}.png`, 'image/png', `${message}\n\n${SOFTWARE_FOOTER}`);
      if (!shared) {
        // fallback to existing export
        await exportAsImage();
      }
    } catch (e) {
      console.error('Share image failed, falling back to export:', e);
      await exportAsImage();
    } finally {
      document.body.removeChild(container);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!data || data.length === 0) return;
    
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    const finalColumns = columns.map(col => ({
      ...col,
      label: col.label || col.key
    }));
    
    exportTableAsExcel({
      data,
      columns: finalColumns,
      filename: finalFilename,
      companyDetails,
      reportDetails
    });
  };

  // Export as Image
  const exportAsImage = async () => {
    if (!data || data.length === 0) return;
    
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    const finalColumns = columns.map(col => ({
      ...col,
      label: col.label || col.key
    }));
    
    await exportTableAsImage({
      data,
      columns: finalColumns,
      filename: finalFilename,
      companyDetails,
      reportDetails
    });
  };

  // Print Report
  const printReport = () => {
    if (!data || data.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || filename}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .report-title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
            .period { font-size: 14px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .summary { margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 5px; }
            .summary h3 { margin-top: 0; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
            .summary-item { text-align: center; padding: 15px; border-radius: 5px; background-color: #e9ecef; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${companyDetails?.companyName || 'Company Name'}</div>
            <div class="report-title">${title || filename}</div>
            ${reportDetails.dateRange ? `<div class="period">Period: ${formatDate(reportDetails.dateRange.start)} to ${formatDate(reportDetails.dateRange.end)}</div>` : ''}
          </div>

          ${Object.keys(reportDetails).length > 0 ? `
            <div class="summary">
              <h3>Summary</h3>
              <div class="summary-grid">
                ${Object.entries(reportDetails).map(([key, value]) => `
                  <div class="summary-item">
                    <strong>${key}</strong><br>
                    ${typeof value === 'number' ? formatCurrency(value) : value}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${col.label || col.key}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${columns.map(col => `<td>${row[col.key] || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()">Print Report</button>
            <button onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
  };

  // Share Report (public viewer link)
  const shareReport = async (msg) => {
    if (!data || data.length === 0) return;
    const finalFilename = buildReportFilename({ prefix: filename, companyDetails, dateRange: reportDetails.dateRange });
    // Build minimal HTML table for public viewing
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title || filename}</title><style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px} th{background:#f6f6f6}</style></head><body><h2 style="text-align:center;margin:8px 0">${companyDetails?.firmName || 'Report'}</h2><h3 style="text-align:center;margin:8px 0">${title || filename}</h3>${reportDetails?.dateRange ? `<div style="text-align:center;margin-bottom:12px">Period: ${new Date(reportDetails.dateRange.start).toLocaleDateString()} to ${new Date(reportDetails.dateRange.end).toLocaleDateString()}</div>` : ''}<table><thead><tr>${columns.map(c=>`<th>${c.label||c.key}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${columns.map(c=>`<td>${r[c.key] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table><div style="margin-top:16px;font-size:12px;color:#666;text-align:center;">${SOFTWARE_FOOTER}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const storage = getStorage(app);
    const token = Math.random().toString(36).slice(2);
    const path = `publicReports/${finalFilename}-${token}.html`;
    const sref = storageRef(storage, path);
    await uploadBytes(sref, blob, { contentType: 'text/html' });
    const url = await getDownloadURL(sref);
    const hostingBase = 'https://acctoo.com';
    const wrapped = `${hostingBase}/doc-viewer.html?u=${encodeURIComponent(url)}`;
    const message = msg || buildShareMessage({ docType: title || filename, companyName: companyDetails?.firmName, phone: companyDetails?.contactNumber });
    if (navigator.share) {
      await navigator.share({ title: title || filename, text: `${message}\n\n${SOFTWARE_FOOTER}`, url: wrapped });
    } else {
      await navigator.clipboard.writeText(`${message}\n${wrapped}\n\n${SOFTWARE_FOOTER}`);
      alert('Public link copied to clipboard');
    }
  };

  return (
    <div className={className}>
      <button 
        onClick={exportToPDF}
        disabled={disabled || !data || data.length === 0}
        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
      >
        📄 Export PDF
      </button>
      
      <button 
        onClick={exportToExcel}
        disabled={disabled || !data || data.length === 0}
        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
      >
        📊 Export Excel
      </button>
      
      {showPrint && (
        <button 
          onClick={printReport}
          disabled={disabled || !data || data.length === 0}
          className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm"
        >
          🖨️ Print
        </button>
      )}
      
      {showShare && (
        <ShareButton
          allowMessage
          defaultMessage={buildShareMessage({ docType: title || filename, companyName: companyDetails?.firmName, phone: companyDetails?.contactNumber })}
          onExportPDF={shareAsPDF}
          onExportExcel={shareAsExcel}
          onExportImage={shareAsImage}
          onShareLink={shareReport}
          disabled={disabled || !data || data.length === 0}
        />
      )}
    </div>
  );
};

export default GlobalExportButtons;
