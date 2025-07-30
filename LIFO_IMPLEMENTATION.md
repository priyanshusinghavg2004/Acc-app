# LIFO (Last In, First Out) Implementation

## Overview

This document describes the implementation of LIFO (Last In, First Out) sorting for all tables in the application. LIFO sorting prioritizes the most recently added items, making them appear first in the table.

## Key Features

- **Default LIFO Sorting**: All tables default to LIFO sorting by bill numbers (invoice/challan/purchase/receipt numbers)
- **Preserved Column Sorting**: All existing column sorting features remain fully functional
- **Smart Bill Number Parsing**: Handles various bill number formats intelligently
- **Fallback to Timestamps**: Uses creation dates when bill numbers are not available
- **User-Friendly**: Users can still sort by any column by clicking on column headers

## Supported Bill Number Formats

The implementation supports various bill number formats:

- `INV25-26/1` → Extracts `1`
- `INV25-26/10` → Extracts `10`
- `INV-001` → Extracts `1`
- `INV002` → Extracts `2`
- `CHA25-26/5` → Extracts `5`
- `QUO25-26/1` → Extracts `1`
- `PRB25-26/10` → Extracts `10`

## Implementation Details

### 1. Table Sorting Hook (`src/utils/tableSort.js`)

The `useTableSort` hook handles all sorting logic:

```javascript
// Default LIFO sorting configuration
const { sortConfig, handleSort, getSortedData } = useTableSort([], { 
  key: 'number', 
  direction: 'desc' 
});
```

**Key Features:**
- Default sorting by bill numbers in descending order (LIFO)
- Special handling for bill numbers, dates, and other data types
- Preserves user-initiated column sorting
- Smart bill number extraction for various formats

### 2. Table Pagination Hook (`src/utils/tablePagination.js`)

The `useTablePagination` hook handles only pagination:

```javascript
// Simple pagination without sorting logic
const pagination = useTablePagination(sortedData, 10);
```

**Key Features:**
- Pure pagination functionality
- No sorting logic (handled by `useTableSort`)
- Configurable page sizes
- Smart pagination with ellipsis

### 3. Component Integration

Components use both hooks in sequence:

```javascript
// 1. Apply sorting (with LIFO default)
const sortedBills = getSortedData(getFilteredBills());

// 2. Apply pagination
const pagination = useTablePagination(sortedBills, 10);
```

## Usage

### Default Behavior

All tables automatically display data in LIFO order by bill numbers:

- **Sales**: Invoices, Challans, Quotations sorted by `number` (descending)
- **Purchases**: Purchase Bills, Orders sorted by `billNumber` (descending)
- **Payments**: Receipts sorted by `receiptNumber` (descending)
- **Items**: Sorted by `createdAt` (descending)
- **Parties**: Sorted by `createdAt` (descending)

### User Column Sorting

Users can click on any column header to sort by that column:

1. **First click**: Sort ascending
2. **Second click**: Sort descending
3. **Third click**: Back to ascending

**Example:**
- Click "Party Name" → Sort alphabetically A-Z
- Click "Amount" → Sort by amount low to high
- Click "Date" → Sort by date oldest to newest

### Bill Number Sorting

When sorting by bill numbers:
- **Default (LIFO)**: Highest bill numbers first (10, 9, 8, ...)
- **User click**: Toggles between ascending (1, 2, 3, ...) and descending (10, 9, 8, ...)

## Testing

A comprehensive test suite is available in `src/utils/lifoTest.js`:

```javascript
import { runAllTests } from '../utils/lifoTest';

// Run all tests
runAllTests();
```

**Test Coverage:**
- LIFO sorting by bill numbers
- Ascending sorting (user column clicks)
- Date sorting
- Bill number extraction for various formats

## Benefits

1. **Improved User Experience**: Most recent items appear first by default
2. **Preserved Functionality**: All existing sorting features remain intact
3. **Intelligent Parsing**: Handles complex bill number formats
4. **Performance**: Efficient sorting algorithms
5. **Maintainability**: Clean separation of concerns between sorting and pagination

## Configuration

### Default Sort Keys by Component

| Component | Default Sort Key | Default Direction | Description |
|-----------|------------------|-------------------|-------------|
| Sales | `number` | `desc` | Bill numbers (LIFO) |
| Purchases | `billNumber` | `desc` | Bill numbers (LIFO) |
| Payments | `receiptNumber` | `desc` | Receipt numbers (LIFO) |
| Items | `createdAt` | `desc` | Creation date (LIFO) |
| Parties | `createdAt` | `desc` | Creation date (LIFO) |

### Customizing Default Sorting

To change the default sorting for a component:

```javascript
// In the component
const { sortConfig, handleSort, getSortedData } = useTableSort([], { 
  key: 'yourPreferredKey', 
  direction: 'desc' 
});
```

## Migration Notes

### Previous Implementation Issues

The initial implementation had a critical issue where LIFO sorting was applied in the pagination hook, which:
- Overrode user column sorting selections
- Broke the ability to sort by other columns
- Created conflicts between default and user-initiated sorting

### Current Implementation

The corrected implementation:
- Applies LIFO sorting only in the `useTableSort` hook
- Preserves all user column sorting functionality
- Maintains clean separation between sorting and pagination
- Ensures LIFO is the default but doesn't interfere with user choices

## Future Enhancements

1. **Custom Sort Preferences**: Allow users to save their preferred default sorting
2. **Multi-Column Sorting**: Support sorting by multiple columns
3. **Sort Indicators**: Visual indicators showing current sort state
4. **Sort History**: Remember user's last sorting preference

## Troubleshooting

### Common Issues

1. **Sorting not working**: Ensure `useTableSort` is called before `useTablePagination`
2. **Wrong default order**: Check the `defaultSort` parameter in `useTableSort`
3. **Bill numbers not sorting correctly**: Verify bill number format compatibility

### Debug Mode

Enable debug logging in the browser console:

```javascript
// In browser console
window.runAllTests(); // Run comprehensive tests
```

## Files Modified

- `src/utils/tableSort.js` - Enhanced with LIFO sorting logic
- `src/utils/tablePagination.js` - Reverted to pure pagination
- `src/components/Sales.js` - Updated to use corrected approach
- `src/components/Purchases.js` - Updated to use corrected approach
- `src/components/Payments.js` - Updated to use corrected approach
- `src/components/Items.js` - Updated to use corrected approach
- `src/components/Parties.js` - Updated to use corrected approach
- `src/components/Reports.js` - Updated to use corrected approach
- `src/utils/lifoTest.js` - Updated test suite for new approach
- `LIFO_IMPLEMENTATION.md` - This documentation file 