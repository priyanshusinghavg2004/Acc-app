import React from 'react';
import { exportTableAsPDF, exportTableAsExcel, exportTableAsImage, buildReportFilename, shareLink } from './Reports/exportUtils';
import ShareButton from './Reports/ShareButton';

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

  // Share Report
  const shareReport = () => {
    const shareData = {
      title: `ACCTOO ${title || filename}`,
      text: `Check out this ${title || filename} from ACCTOO`,
      url: window.location.href
    };
    
    shareLink(shareData);
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
          onExportPDF={exportToPDF}
          onExportExcel={exportToExcel}
          onExportImage={exportAsImage}
          onShareLink={shareReport}
          disabled={disabled || !data || data.length === 0}
        />
      )}
    </div>
  );
};

export default GlobalExportButtons;
