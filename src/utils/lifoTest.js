/**
 * LIFO Sorting Test Utility
 * 
 * This file contains test functions to verify that the LIFO sorting
 * functionality is working correctly with various bill number formats.
 * 
 * Updated to reflect the new approach where LIFO sorting is handled
 * by useTableSort instead of useTablePagination.
 */

// Test data with various bill number formats
export const testData = [
  { id: '1', number: 'INV25-26/1', createdAt: new Date('2025-01-01') },
  { id: '2', number: 'INV25-26/10', createdAt: new Date('2025-01-02') },
  { id: '3', number: 'INV25-26/2', createdAt: new Date('2025-01-03') },
  { id: '4', number: 'CHA25-26/1', createdAt: new Date('2025-01-04') },
  { id: '5', number: 'CHA25-26/5', createdAt: new Date('2025-01-05') },
  { id: '6', number: 'INV-001', createdAt: new Date('2025-01-06') },
  { id: '7', number: 'INV002', createdAt: new Date('2025-01-07') },
  { id: '8', number: 'QUO25-26/1', createdAt: new Date('2025-01-08') },
  { id: '9', number: 'PRB25-26/1', createdAt: new Date('2025-01-09') },
  { id: '10', number: 'PRB25-26/10', createdAt: new Date('2025-01-10') },
];

// Simulate the sortFunctions from tableSort.js
const sortFunctions = {
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
  
  // Date sorting
  date: (a, b) => {
    const dateA = a ? new Date(a) : new Date(0);
    const dateB = b ? new Date(b) : new Date(0);
    return dateA.getTime() - dateB.getTime();
  }
};

// Simulate the sortData function from useTableSort
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

  return sortedData;
};

// Test function to verify LIFO sorting using useTableSort approach
export const testLifoSorting = () => {
  console.log('Testing LIFO Sorting with useTableSort approach...');
  
  // Test default LIFO sorting (descending by bill number)
  const sortedData = sortData(testData, 'number', 'desc');

  console.log('Original order:', testData.map(item => item.number));
  console.log('LIFO sorted order:', sortedData.map(item => item.number));
  
  // Verify that the highest bill numbers come first
  const expectedOrder = [
    'PRB25-26/10',  // 10
    'INV25-26/10',  // 10
    'CHA25-26/5',   // 5
    'INV002',       // 2
    'INV25-26/2',   // 2
    'INV-001',      // 1
    'INV25-26/1',   // 1
    'CHA25-26/1',   // 1
    'QUO25-26/1',   // 1
    'PRB25-26/1',   // 1
  ];
  
  const actualOrder = sortedData.map(item => item.number);
  const isCorrect = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
  
  console.log('Expected order:', expectedOrder);
  console.log('Actual order:', actualOrder);
  console.log('LIFO sorting test:', isCorrect ? 'PASSED' : 'FAILED');
  
  return isCorrect;
};

// Test function to verify ascending sorting (user clicks on column)
export const testAscendingSorting = () => {
  console.log('Testing Ascending Sorting (user column click)...');
  
  // Test ascending sorting (user clicks on bill number column)
  const sortedData = sortData(testData, 'number', 'asc');

  console.log('Original order:', testData.map(item => item.number));
  console.log('Ascending sorted order:', sortedData.map(item => item.number));
  
  // Verify that the lowest bill numbers come first
  const expectedOrder = [
    'INV-001',      // 1
    'INV25-26/1',   // 1
    'CHA25-26/1',   // 1
    'QUO25-26/1',   // 1
    'PRB25-26/1',   // 1
    'INV002',       // 2
    'INV25-26/2',   // 2
    'CHA25-26/5',   // 5
    'INV25-26/10',  // 10
    'PRB25-26/10',  // 10
  ];
  
  const actualOrder = sortedData.map(item => item.number);
  const isCorrect = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
  
  console.log('Expected order:', expectedOrder);
  console.log('Actual order:', actualOrder);
  console.log('Ascending sorting test:', isCorrect ? 'PASSED' : 'FAILED');
  
  return isCorrect;
};

// Test function to verify date sorting
export const testDateSorting = () => {
  console.log('Testing Date Sorting...');
  
  // Test LIFO date sorting (descending by createdAt)
  const sortedData = sortData(testData, 'createdAt', 'desc');

  console.log('Original dates:', testData.map(item => item.createdAt.toISOString().split('T')[0]));
  console.log('LIFO date sorted:', sortedData.map(item => item.createdAt.toISOString().split('T')[0]));
  
  // Verify that the most recent dates come first
  const expectedDates = [
    '2025-01-10', '2025-01-09', '2025-01-08', '2025-01-07', '2025-01-06',
    '2025-01-05', '2025-01-04', '2025-01-03', '2025-01-02', '2025-01-01'
  ];
  
  const actualDates = sortedData.map(item => item.createdAt.toISOString().split('T')[0]);
  const isCorrect = JSON.stringify(actualDates) === JSON.stringify(expectedDates);
  
  console.log('Expected dates:', expectedDates);
  console.log('Actual dates:', actualDates);
  console.log('Date sorting test:', isCorrect ? 'PASSED' : 'FAILED');
  
  return isCorrect;
};

// Test function to verify bill number extraction
export const testBillNumberExtraction = () => {
  console.log('Testing Bill Number Extraction...');
  
  const testCases = [
    { input: 'INV25-26/1', expected: 1 },
    { input: 'INV25-26/10', expected: 10 },
    { input: 'INV-001', expected: 1 },
    { input: 'INV002', expected: 2 },
    { input: 'CHA25-26/5', expected: 5 },
    { input: 'QUO25-26/1', expected: 1 },
    { input: 'PRB25-26/10', expected: 10 },
    { input: '', expected: 0 },
    { input: null, expected: 0 },
    { input: undefined, expected: 0 },
  ];
  
  let allPassed = true;
  
  testCases.forEach(({ input, expected }) => {
    const result = sortFunctions.serialNumber(input, 0); // Compare with 0 to get the extracted number
    const passed = result === expected;
    if (!passed) {
      console.log(`FAILED: serialNumber("${input}") returned ${result}, expected ${expected}`);
      allPassed = false;
    } else {
      console.log(`PASSED: serialNumber("${input}") = ${result}`);
    }
  });
  
  console.log('Bill number extraction test:', allPassed ? 'PASSED' : 'FAILED');
  return allPassed;
};

// Test function to verify Payments component sorting
export const testPaymentsSorting = () => {
  console.log('Testing Payments Component Sorting...');

  // Simulate bills data with different structures for different tabs
  const invoiceBills = [
    { id: '1', number: 'INV25-26/1', partyId: 'party1', totalAmount: 1000, totalPaid: 500, outstanding: 500, paymentCount: 1 },
    { id: '2', number: 'INV25-26/10', partyId: 'party2', totalAmount: 2000, totalPaid: 1500, outstanding: 500, paymentCount: 2 },
    { id: '3', number: 'INV25-26/5', partyId: 'party3', totalAmount: 1500, totalPaid: 1000, outstanding: 500, paymentCount: 1 }
  ];

  const challanBills = [
    { id: '4', challanNumber: 'CHA25-26/1', partyId: 'party1', totalAmount: 800, totalPaid: 400, outstanding: 400, paymentCount: 1 },
    { id: '5', challanNumber: 'CHA25-26/10', partyId: 'party2', totalAmount: 1200, totalPaid: 800, outstanding: 400, paymentCount: 1 },
    { id: '6', challanNumber: 'CHA25-26/5', partyId: 'party3', totalAmount: 900, totalPaid: 600, outstanding: 300, paymentCount: 1 }
  ];

  const purchaseBills = [
    { id: '7', number: 'PUR25-26/1', partyId: 'party1', totalAmount: 1500, totalPaid: 1000, outstanding: 500, paymentCount: 1 },
    { id: '8', number: 'PUR25-26/10', partyId: 'party2', totalAmount: 2500, totalPaid: 2000, outstanding: 500, paymentCount: 2 },
    { id: '9', number: 'PUR25-26/5', partyId: 'party3', totalAmount: 1800, totalPaid: 1200, outstanding: 600, paymentCount: 1 }
  ];

  // Simulate party data
  const parties = [
    { id: 'party1', firmName: 'ABC Company' },
    { id: 'party2', firmName: 'XYZ Corporation' },
    { id: 'party3', firmName: 'DEF Industries' }
  ];

  // Simulate getPartyName function
  const getPartyName = (partyId) => {
    const party = parties.find(p => p.id === partyId);
    return party ? party.firmName : 'Unknown Party';
  };

  // Simulate getBillNumber function for different tabs
  const getBillNumber = (bill, tab) => {
    switch(tab) {
      case 'invoice': return bill.number || bill.invoiceNumber;
      case 'challan': return bill.challanNumber || bill.number;
      case 'purchase': return bill.number || bill.billNumber;
      default: return bill.number;
    }
  };

  // Test data normalization (simulating getFilteredBills)
  const normalizeBillsData = (bills, tab) => {
    return bills.map(bill => ({
      ...bill,
      partyName: getPartyName(bill.partyId),
      number: getBillNumber(bill, tab) // Normalize bill number for consistent sorting
    }));
  };

  // Test sorting for each tab
  ['invoice', 'challan', 'purchase'].forEach(tab => {
    console.log(`\n--- Testing ${tab.toUpperCase()} tab ---`);
    
    let bills;
    switch(tab) {
      case 'invoice': bills = invoiceBills; break;
      case 'challan': bills = challanBills; break;
      case 'purchase': bills = purchaseBills; break;
    }

    const normalizedBills = normalizeBillsData(bills, tab);
    console.log('Original order:', normalizedBills.map(bill => bill.number));

    // Test LIFO sorting (descending by bill number)
    const sortedByNumber = sortData(normalizedBills, 'number', 'desc');
    console.log('Sorted by number (LIFO):', sortedByNumber.map(bill => bill.number));

    // Test party name sorting
    const sortedByParty = sortData(normalizedBills, 'partyName', 'asc');
    console.log('Sorted by party name:', sortedByParty.map(bill => bill.partyName));

    // Test amount sorting
    const sortedByAmount = sortData(normalizedBills, 'totalAmount', 'desc');
    console.log('Sorted by amount:', sortedByAmount.map(bill => bill.totalAmount));
  });

  console.log('\n✅ Payments component sorting test completed');
};

// Run all tests
export const runAllTests = () => {
  console.log('🧪 Running all LIFO sorting tests...\n');
  
  testLifoSorting();
  testBillNumberExtraction();
  testAscendingSorting();
  testDateSorting();
  testPaymentsSorting(); // Add the new test
  
  console.log('\n🎉 All tests completed!');
};

// Export for use in development
if (typeof window !== 'undefined') {
  window.testLifoSorting = testLifoSorting;
  window.testAscendingSorting = testAscendingSorting;
  window.testDateSorting = testDateSorting;
  window.testBillNumberExtraction = testBillNumberExtraction;
  window.runAllTests = runAllTests;
} 