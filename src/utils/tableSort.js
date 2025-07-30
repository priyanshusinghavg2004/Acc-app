import { useState } from 'react';

// Custom hook for table sorting
export const useTableSort = (initialData = [], defaultSort = null) => {
  const [sortConfig, setSortConfig] = useState(
    defaultSort || {
      key: '',
      direction: 'desc' // Default to descending for LIFO
    }
  );

  const sortData = (data, sortKey, sortDirection) => {
    if (!sortKey) return data;

    const sortedData = [...data].sort((a, b) => {
      let aValue = a[sortKey];
      let bValue = b[sortKey];

      // Special handling for invoice/bill numbers (serial numbers) - LIFO by default
      if (sortKey === 'number' || sortKey === 'invoiceNumber' || sortKey === 'billNumber' || 
          sortKey === 'challanNumber' || sortKey === 'receiptNumber') {
        const result = sortFunctions.serialNumber(aValue, bValue);
        // For LIFO, we want descending order by default
        return sortDirection === 'asc' ? result : -result;
      }

      // Special handling for dates - LIFO by default
      if (sortKey === 'date' || sortKey === 'invoiceDate' || sortKey === 'challanDate' || 
          sortKey === 'billDate' || sortKey === 'createdAt' || sortKey === 'updatedAt') {
        const result = sortFunctions.date(aValue, bValue);
        // For LIFO, we want descending order by default
        return sortDirection === 'asc' ? result : -result;
      }

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // String comparison
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
        const result = aValue.localeCompare(bValue);
        return sortDirection === 'desc' ? -result : result;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        // Date comparison
        const result = aValue.getTime() - bValue.getTime();
        return sortDirection === 'desc' ? -result : result;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        // Number comparison
        const result = aValue - bValue;
        return sortDirection === 'desc' ? -result : result;
      } else if (aValue && bValue) {
        // Try to convert to numbers if possible
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          const result = aNum - bNum;
          return sortDirection === 'desc' ? -result : result;
        }
        // Fallback to string comparison
        const result = String(aValue).toLowerCase().localeCompare(String(bValue).toLowerCase());
        return sortDirection === 'desc' ? -result : result;
      }
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      return 0;
    });

    return sortedData; // No need to reverse since we handle direction in the sort function
  };

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedData = (data) => {
    return sortData(data, sortConfig.key, sortConfig.direction);
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '↕️'; // Neutral icon
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const getSortClassName = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return 'cursor-pointer hover:text-blue-600';
    }
    return 'cursor-pointer text-blue-600 font-semibold';
  };

  return {
    sortConfig,
    handleSort,
    getSortedData,
    getSortIcon,
    getSortClassName
  };
};

// Utility functions for specific data types
export const sortFunctions = {
  // String sorting
  string: (a, b) => (a || '').toLowerCase().localeCompare((b || '').toLowerCase()),
  
  // Number sorting
  number: (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0),
  
  // Date sorting
  date: (a, b) => {
    const dateA = a ? new Date(a) : new Date(0);
    const dateB = b ? new Date(b) : new Date(0);
    return dateA.getTime() - dateB.getTime();
  },
  
  // Currency sorting (removes ₹ and commas)
  currency: (a, b) => {
    const cleanA = parseFloat(String(a).replace(/[₹,\s]/g, '')) || 0;
    const cleanB = parseFloat(String(b).replace(/[₹,\s]/g, '')) || 0;
    return cleanA - cleanB;
  },
  
  // Serial number sorting (extracts numbers from strings like "INV-001") - Improved for LIFO
  serialNumber: (a, b) => {
    const getNum = val => {
      if (!val) return 0;
      const str = String(val);
      
      // Handle various bill number formats:
      // INV25-26/1, INV25-26/10, INV-001, INV001, CHA25-26/1, etc.
      
      // First, try to find a number after the last slash or dash
      const slashMatch = str.match(/(?:[/-])(\d+)$/);
      if (slashMatch) {
        return parseInt(slashMatch[1]) || 0;
      }
      
      // If no slash/dash, try to find the last sequence of digits
      const digitMatch = str.match(/(\d+)(?=\D*$)/);
      if (digitMatch) {
        return parseInt(digitMatch[1]) || 0;
      }
      
      // Fallback: extract all digits and use the last meaningful number
      const allDigits = str.match(/\d+/g);
      if (allDigits && allDigits.length > 0) {
        // Use the last group of digits
        return parseInt(allDigits[allDigits.length - 1]) || 0;
      }
      
      return 0;
    };
    return getNum(a) - getNum(b);
  },
  
  // Created/Modified date sorting
  timestamp: (a, b) => {
    const timeA = a?.createdAt?.toDate?.() || a?.createdAt || a?.updatedAt?.toDate?.() || a?.updatedAt || new Date(0);
    const timeB = b?.createdAt?.toDate?.() || b?.createdAt || b?.updatedAt?.toDate?.() || b?.updatedAt || new Date(0);
    return new Date(timeA).getTime() - new Date(timeB).getTime();
  }
};

// Predefined sort configurations for common table types
export const tableSortConfigs = {
  // Items table
  items: {
    itemName: { type: 'string', label: 'Item Name' },
    measurement: { type: 'string', label: 'Measurement' },
    defaultRate: { type: 'currency', label: 'Default Rate' },
    type: { type: 'string', label: 'Type' },
    hsnCode: { type: 'string', label: 'HSN Code' },
    gstPercentage: { type: 'number', label: 'GST %' },
    stock: { type: 'number', label: 'Stock' },
    createdAt: { type: 'timestamp', label: 'Created Date' },
    updatedAt: { type: 'timestamp', label: 'Modified Date' }
  },
  
  // Parties table
  parties: {
    firmName: { type: 'string', label: 'Firm Name' },
    personName: { type: 'string', label: 'Person Name' },
    type: { type: 'string', label: 'Type' },
    contact: { type: 'string', label: 'Contact' },
    email: { type: 'string', label: 'Email' },
    whatsapp: { type: 'string', label: 'WhatsApp' },
    gstin: { type: 'string', label: 'GSTIN' },
    address: { type: 'string', label: 'Address' },
    createdAt: { type: 'timestamp', label: 'Created Date' },
    updatedAt: { type: 'timestamp', label: 'Modified Date' }
  },
  
  // Sales/Purchase bills table - Updated for LIFO
  bills: {
    number: { type: 'serialNumber', label: 'Bill Number', defaultDirection: 'desc' },
    date: { type: 'date', label: 'Date', defaultDirection: 'desc' },
    party: { type: 'string', label: 'Party' },
    amount: { type: 'currency', label: 'Amount' },
    paid: { type: 'currency', label: 'Paid' },
    outstanding: { type: 'currency', label: 'Outstanding' },
    createdAt: { type: 'timestamp', label: 'Created Date', defaultDirection: 'desc' },
    updatedAt: { type: 'timestamp', label: 'Modified Date', defaultDirection: 'desc' }
  },
  
  // Payments table - Updated for LIFO
  payments: {
    receiptNumber: { type: 'serialNumber', label: 'Receipt Number', defaultDirection: 'desc' },
    date: { type: 'date', label: 'Date', defaultDirection: 'desc' },
    partyName: { type: 'string', label: 'Party' },
    amount: { type: 'currency', label: 'Amount' },
    mode: { type: 'string', label: 'Mode' },
    createdAt: { type: 'timestamp', label: 'Created Date', defaultDirection: 'desc' },
    updatedAt: { type: 'timestamp', label: 'Modified Date', defaultDirection: 'desc' }
  }
};

// Sortable table header component
export const SortableHeader = ({ 
  columnKey, 
  label, 
  onSort, 
  sortConfig, 
  className = "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600" 
}) => {
  const isActive = sortConfig.key === columnKey;
  const icon = isActive 
    ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')
    : ' ↕️';
  
  const activeClassName = isActive ? 'text-blue-600 font-semibold' : '';
  
  return (
    <th 
      className={`${className} ${activeClassName}`}
      onClick={() => onSort(columnKey)}
    >
      {label}{icon}
    </th>
  );
}; 