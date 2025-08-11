# Enhanced Share Functionality for Reports

## Overview
The customer ledger reports now include enhanced sharing capabilities that allow users to export and share table data in multiple formats instead of just sharing a link.

## New Features

### 1. Enhanced Share Button
- **Location**: Customer Ledger Report (`CustomerLedgerReport.js`)
- **Functionality**: Dropdown menu with multiple sharing options
- **Options**:
  - 📄 Share as PDF
  - 📊 Share as Excel (CSV)
  - 🖼️ Share as Image (PNG)
  - 📱 Share Link (original functionality)

### 2. Reusable Components

#### ShareButton Component (`ShareButton.js`)
A reusable React component that provides a dropdown menu for sharing options.

**Usage:**
```jsx
import ShareButton from './ShareButton';

<ShareButton
  onExportPDF={exportToPDF}
  onExportExcel={exportToExcel}
  onExportImage={exportAsImage}
  onShareLink={shareLink}
  disabled={ledgerData.length === 0}
/>
```

**Props:**
- `onExportPDF`: Function to handle PDF export
- `onExportExcel`: Function to handle Excel export
- `onExportImage`: Function to handle image export
- `onShareLink`: Function to handle link sharing
- `disabled`: Boolean to disable the button
- `className`: Custom CSS classes

#### Export Utilities (`exportUtils.js`)
Reusable utility functions for exporting data in different formats.

**Available Functions:**
- `exportTableAsPDF(options)`: Export table as PDF
- `exportTableAsExcel(options)`: Export table as Excel (CSV)
- `exportTableAsImage(options)`: Export table as Image (PNG)
- `shareLink(options)`: Share link using Web Share API

## Implementation Details

### PDF Export
- Uses jsPDF library with autoTable plugin
- Includes company letterhead
- Professional formatting with headers and data
- Automatic page breaks for large tables

### Excel Export
- Generates CSV format (compatible with Excel)
- Includes company details and report metadata
- Proper escaping of special characters
- Automatic download with appropriate filename

### Image Export
- Uses html2canvas library
- High-quality PNG output (2x scale)
- Professional styling with company branding
- Automatic cleanup of temporary elements

### Link Sharing
- Uses Web Share API when available
- WhatsApp fallback for unsupported browsers
- Includes report title and company information

## Dependencies

### Required Libraries
```bash
npm install html2canvas --legacy-peer-deps
```

### Existing Dependencies
- jsPDF (already included)
- jspdf-autotable (already included)

## Usage Example

```jsx
import ShareButton from './ShareButton';
import { exportTableAsPDF, exportTableAsExcel, exportTableAsImage, shareLink } from './exportUtils';

const MyReport = () => {
  const handleExportPDF = () => {
    exportTableAsPDF({
      data: tableData,
      columns: tableColumns,
      filename: 'my-report',
      title: 'My Report',
      companyDetails: companyInfo,
      reportDetails: {
        'Generated': new Date().toLocaleDateString(),
        'Period': 'Jan 2024 - Dec 2024'
      }
    });
  };

  const handleExportExcel = () => {
    exportTableAsExcel({
      data: tableData,
      columns: tableColumns,
      filename: 'my-report',
      companyDetails: companyInfo,
      reportDetails: {
        'Generated': new Date().toLocaleDateString(),
        'Period': 'Jan 2024 - Dec 2024'
      }
    });
  };

  const handleExportImage = () => {
    exportTableAsImage({
      data: tableData,
      columns: tableColumns,
      filename: 'my-report',
      companyDetails: companyInfo,
      reportDetails: {
        'Generated': new Date().toLocaleDateString(),
        'Period': 'Jan 2024 - Dec 2024'
      }
    });
  };

  const handleShareLink = () => {
    shareLink({
      title: 'ACCTOO Report',
      text: 'Check out this report from ACCTOO',
      url: window.location.href
    });
  };

  return (
    <ShareButton
      onExportPDF={handleExportPDF}
      onExportExcel={handleExportExcel}
      onExportImage={handleExportImage}
      onShareLink={handleShareLink}
      disabled={!tableData.length}
    />
  );
};
```

## Browser Compatibility

### PDF Export
- ✅ Chrome, Firefox, Safari, Edge
- Requires jsPDF library

### Excel Export
- ✅ All modern browsers
- Downloads as CSV file

### Image Export
- ✅ Chrome, Firefox, Safari, Edge
- Requires html2canvas library
- May have limitations with complex CSS

### Link Sharing
- ✅ Mobile browsers (Web Share API)
- ✅ Desktop browsers (WhatsApp fallback)

## Future Enhancements

1. **Additional Formats**: Add support for Word documents, PowerPoint presentations
2. **Custom Templates**: Allow users to customize export templates
3. **Batch Export**: Export multiple reports at once
4. **Cloud Storage**: Direct upload to Google Drive, Dropbox, etc.
5. **Email Integration**: Send reports directly via email
6. **Scheduled Reports**: Automatically generate and share reports

## Troubleshooting

### Common Issues

1. **PDF not generating**: Check if jsPDF is properly loaded
2. **Image export fails**: Ensure html2canvas is installed
3. **Large tables**: Consider pagination for very large datasets
4. **Styling issues**: Some CSS properties may not render correctly in exports

### Debug Mode
Enable console logging for debugging:
```javascript
// Add to export functions for debugging
console.log('Export options:', options);
console.log('Table data:', data);
```

## Contributing

When adding new export formats or modifying existing ones:

1. Follow the existing pattern in `exportUtils.js`
2. Add proper error handling
3. Include cleanup for temporary resources
4. Test across different browsers
5. Update this documentation
