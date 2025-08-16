// Utility functions for exporting reports

/**
 * Export table data as PDF using jsPDF
 * @param {Object} options - Export options
 * @param {Array} options.data - Table data
 * @param {Array} options.columns - Column definitions
 * @param {string} options.filename - Output filename
 * @param {string} options.title - Report title
 * @param {Object} options.companyDetails - Company information
 * @param {Object} options.reportDetails - Additional report details
 */
export const exportTableAsPDF = async (options) => {
  const { data, columns, filename, title, companyDetails, reportDetails } = options;
  
  // Get jsPDF instance
  const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
  if (!jsPDF) {
    console.error('jsPDF not available');
    return;
  }
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Add letterhead
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text(companyDetails?.firmName || 'Company Name', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  let yPosition = 30;
  
  // Company details
  if (companyDetails?.address) {
    doc.text(companyDetails.address, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }
  if (companyDetails?.gstin) {
    doc.text(`GSTIN: ${companyDetails.gstin}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }
  if (companyDetails?.contactNumber) {
    doc.text(`Phone: ${companyDetails.contactNumber}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
  }
  
  // Add separator
  yPosition += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 8;
  
  // Report title
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;
  
  // Report details
  if (reportDetails) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    Object.entries(reportDetails).forEach(([key, value]) => {
      doc.text(`${key}: ${value}`, 20, yPosition);
      yPosition += 8;
    });
    yPosition += 8;
  }
  
  // Prepare table data
  const headers = columns.map(col => col.label);
  const tableData = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      if (typeof value === 'number') {
        return value.toLocaleString();
      }
      return value || '';
    })
  );
  
  // Add table using autoTable (plugin function)
  try {
    const { default: autoTable } = await import('jspdf-autotable');
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: columns.reduce((acc, col, index) => {
        if (col.width) {
          acc[index] = { cellWidth: col.width };
        }
        return acc;
      }, {})
    });
  } catch (e) {
    console.warn('jspdf-autotable not available:', e);
  }
  // Footer with promotion
  try {
    const pageCount = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : (doc.internal && doc.internal.getNumberOfPages ? doc.internal.getNumberOfPages() : 1);
    const pageHeight = doc.internal.pageSize.height;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Use www.acctoo.com, lets Accouting Togeather', pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
  } catch {}
  
  doc.save(filename);
};

/**
 * Export table data as Excel (CSV)
 * @param {Object} options - Export options
 * @param {Array} options.data - Table data
 * @param {Array} options.columns - Column definitions
 * @param {string} options.filename - Output filename
 * @param {Object} options.companyDetails - Company information
 * @param {Object} options.reportDetails - Additional report details
 */
export const exportTableAsExcel = (options) => {
  const { data, columns, filename, companyDetails, reportDetails } = options;
  
  let csvContent = '';
  
  // Add company details
  if (companyDetails?.firmName) {
    csvContent += `${companyDetails.firmName}\n`;
  }
  if (companyDetails?.address) {
    csvContent += `${companyDetails.address}\n`;
  }
  if (companyDetails?.gstin) {
    csvContent += `GSTIN: ${companyDetails.gstin}\n`;
  }
  csvContent += '\n';
  
  // Add report details
  if (reportDetails) {
    Object.entries(reportDetails).forEach(([key, value]) => {
      csvContent += `${key}: ${value}\n`;
    });
    csvContent += '\n';
  }
  
  // Add headers
  const headers = columns.map(col => col.label);
  csvContent += headers.join(',') + '\n';
  
  // Add data
  data.forEach(row => {
    const rowData = columns.map(col => {
      const value = row[col.key];
      if (typeof value === 'number') {
        return value;
      }
      return `"${(value || '').toString().replace(/"/g, '""')}"`;
    });
    csvContent += rowData.join(',') + '\n';
  });
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export table data as Image
 * @param {Object} options - Export options
 * @param {Array} options.data - Table data
 * @param {Array} options.columns - Column definitions
 * @param {string} options.filename - Output filename
 * @param {Object} options.companyDetails - Company information
 * @param {Object} options.reportDetails - Additional report details
 */
export const exportTableAsImage = async (options) => {
  const { data, columns, filename, companyDetails, reportDetails } = options;
  
  // Create temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1200px';
  container.style.backgroundColor = 'white';
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '12px';
  
  // Build HTML content
  let htmlContent = '';
  
  // Company header
  if (companyDetails?.firmName) {
    htmlContent += `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${companyDetails.firmName}</div>
        ${companyDetails.address ? `<div style="font-size: 12px; color: #666;">${companyDetails.address}</div>` : ''}
        ${companyDetails.gstin ? `<div style="font-size: 12px; color: #666;">GSTIN: ${companyDetails.gstin}</div>` : ''}
      </div>
    `;
  }
  
  // Report details
  if (reportDetails) {
    htmlContent += '<div style="margin: 20px 0;">';
    Object.entries(reportDetails).forEach(([key, value]) => {
      htmlContent += `<div><strong>${key}:</strong> ${value}</div>`;
    });
    htmlContent += '</div>';
  }
  
  // Table
  htmlContent += `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          ${columns.map(col => `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">${col.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            ${columns.map(col => {
              const value = row[col.key];
              const displayValue = typeof value === 'number' ? value.toLocaleString() : (value || '');
              return `<td style="border: 1px solid #ddd; padding: 8px;">${displayValue}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align:center; color:#777; font-size:12px; margin-top:16px;">Use www.acctoo.com, lets Accouting Togeather</div>
  `;
  
  container.innerHTML = htmlContent;
  document.body.appendChild(container);
  
  try {
    // Use html2canvas to convert to image
    const html2canvas = await import('html2canvas');
    const canvas = await html2canvas.default(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      link.click();
      
      // Cleanup
      URL.revokeObjectURL(url);
      document.body.removeChild(container);
    }, 'image/png');
  } catch (error) {
    console.error('Error generating image:', error);
    alert('Error generating image. Please try again.');
    document.body.removeChild(container);
  }
};

/**
 * Share link using Web Share API or fallback
 * @param {Object} options - Share options
 * @param {string} options.title - Share title
 * @param {string} options.text - Share text
 * @param {string} options.url - Share URL
 */
export const shareLink = (options) => {
  const { title, text, url } = options;
  
  if (navigator.share) {
    navigator.share({ title, text, url });
  } else {
    // Fallback for browsers that don't support Web Share API
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
    window.open(shareUrl, '_blank');
  }
};

// --- Filename helpers ---
export const formatCompactDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate());
    const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    const year = d.getFullYear();
    return `${day}${month}${year}`;
  } catch {
    return String(dateStr).replace(/[^0-9A-Za-z]/g, '');
  }
};

export const computeFinancialYear = (dateStr) => {
  try {
    const d = new Date(dateStr);
    let fyStartYear = d.getFullYear();
    // Indian FY: Apr (3) to Mar (2)
    if (d.getMonth() < 3) fyStartYear -= 1;
    const yy1 = String(fyStartYear).slice(-2);
    const yy2 = String(fyStartYear + 1).slice(-2);
    return `${yy1}-${yy2}`;
  } catch {
    return '';
  }
};

export const buildReportFilename = ({ prefix, companyDetails, dateRange, dateStr, extraParts = [] }) => {
  const company = (companyDetails?.firmName || '').trim().replace(/\s+/g, '_');
  const baseDate = dateStr || (dateRange?.end || dateRange?.start) || new Date().toISOString().slice(0,10);
  const fy = computeFinancialYear(baseDate);
  const compact = formatCompactDate(baseDate);
  const parts = [prefix, company, fy, compact, ...extraParts].filter(Boolean);
  return parts.join('_');
};