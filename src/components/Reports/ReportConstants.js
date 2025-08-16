// Common report constants
export const REPORT_CONSTANTS = {
  // Date presets
  DATE_PRESETS: [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this-week' },
    { label: 'This Month', value: 'this-month' },
    { label: 'This Quarter', value: 'this-quarter' },
    { label: 'This Year', value: 'this-year' },
    { label: 'Last Month', value: 'last-month' },
    { label: 'Last Quarter', value: 'last-quarter' },
    { label: 'Last Year', value: 'last-year' }
  ],

  // Report types
  REPORT_TYPES: [
    { value: 'partywise-sales', label: 'Partywise Sales / Sales Summary', icon: '📊' },
    { value: 'customer-ledger', label: 'Customer/Supplier Ledger', icon: '📋' },
    { value: 'invoice-collection', label: 'Invoice-wise Collection Report', icon: '📄' },
    { value: 'payment-register', label: 'Payment Register Report', icon: '💰' },
    { value: 'aging-report', label: 'Aging Report', icon: '⏰' },
    { value: 'itemwise-sales', label: 'Itemwise Sales Report', icon: '📦' },
    { value: 'purchase-bills-summary', label: 'Purchase Bill Summary', icon: '🧾' },
    { value: 'stock-report', label: 'Stock Report', icon: '📈' },
    // GST reports moved to Taxes module
    { value: 'profit-loss', label: 'Profit & Loss Report', icon: '💹' },
    { value: 'balance-sheet', label: 'Balance Sheet Report', icon: '⚖️' },
    { value: 'cash-flow', label: 'Cash Flow / Daybook Report', icon: '💸' }
  ],

  // Table configurations
  TABLE_CONFIG: {
    DEFAULT_PAGE_SIZE: 25,
    DEFAULT_SORT_DIRECTION: 'desc'
  },

  // Status colors
  STATUS_COLORS: {
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue'
  },

  // Currency formatting
  CURRENCY_CONFIG: {
    locale: 'en-IN',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  },

  // Date formatting
  DATE_CONFIG: {
    locale: 'en-IN'
  },

  // Common field mappings
  FIELD_MAPPINGS: {
    party: ['partyId', 'party', 'partyName'],
    amount: ['amount', 'totalAmount', 'value'],
    date: ['date', 'createdAt', 'timestamp'],
    gst: ['gst', 'totalGST', 'gstAmount']
  },

  // Sample data templates
  SAMPLE_DATA_TEMPLATES: {
    partywiseSales: [
      {
        partyId: 'sample1',
        partyName: 'Sample Customer 1',
        totalInvoices: 5,
        totalAmount: 50000,
        totalGST: 9000,
        totalPaid: 40000,
        totalOutstanding: 10000,
        lastInvoiceDate: '2025-01-15'
      }
    ],
    stockReport: [
      {
        itemId: 'sample1',
        itemName: 'Sample Item 1',
        openingStock: 10,
        purchased: 50,
        sold: 25,
        inHand: 35,
        reorderLevel: 10,
        status: 'Normal',
        averageRate: 50000
      }
    ]
  }
};

// Common table column configurations
export const TABLE_COLUMNS = {
  // Partywise Sales columns
  PARTYWISE_SALES: [
    {
      key: 'partyName',
      label: 'Party Name',
      sortable: true,
      render: (value, row) => (
        <div className="text-sm font-medium text-blue-600 hover:underline">
          {value}
        </div>
      )
    },
    {
      key: 'totalInvoices',
      label: 'Total Invoices',
      sortable: true,
      cellClassName: 'text-center'
    },
    {
      key: 'totalAmount',
      label: 'Total Amount',
      sortable: true,
      cellClassName: 'text-right'
    },
    {
      key: 'totalGST',
      label: 'Total GST',
      sortable: true,
      cellClassName: 'text-right'
    },
    {
      key: 'totalPaid',
      label: 'Total Paid',
      sortable: true,
      cellClassName: 'text-right text-green-600 font-medium'
    },
    {
      key: 'totalOutstanding',
      label: 'Outstanding',
      sortable: true,
      cellClassName: 'text-right'
    },
    {
      key: 'lastInvoiceDate',
      label: 'Last Invoice Date',
      sortable: true
    }
  ],

  // Stock Report columns
  STOCK_REPORT: [
    {
      key: 'itemName',
      label: 'Item Name',
      sortable: true,
      render: (value, row) => (
        <div className="text-sm font-medium text-blue-600 hover:underline">
          {value}
        </div>
      )
    },
    {
      key: 'openingStock',
      label: 'Opening Stock',
      sortable: true,
      cellClassName: 'text-center'
    },
    {
      key: 'purchased',
      label: 'Purchased',
      sortable: true,
      cellClassName: 'text-center'
    },
    {
      key: 'sold',
      label: 'Sold',
      sortable: true,
      cellClassName: 'text-center'
    },
    {
      key: 'inHand',
      label: 'In Hand',
      sortable: true,
      cellClassName: 'text-center'
    },
    {
      key: 'reorderLevel',
      label: 'Reorder Level',
      sortable: true,
      cellClassName: 'text-center'
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true
    }
  ]
};

// Common summary card configurations
export const SUMMARY_CARDS = {
  // Partywise Sales summary cards
  PARTYWISE_SALES: [
    { label: 'Total Invoices', key: 'totalInvoices', color: 'blue' },
    { label: 'Total Amount', key: 'totalAmount', color: 'green', format: 'currency' },
    { label: 'Total GST', key: 'totalGST', color: 'purple', format: 'currency' },
    { label: 'Total Paid', key: 'totalPaid', color: 'yellow', format: 'currency' },
    { label: 'Outstanding', key: 'totalOutstanding', color: 'red', format: 'currency' }
  ],

  // Stock Report summary cards
  STOCK_REPORT: [
    { label: 'Total Items', key: 'totalItems', color: 'blue' },
    { label: 'Total Value', key: 'totalValue', color: 'green', format: 'currency' },
    { label: 'Negative Stock', key: 'negativeStock', color: 'red' },
    { label: 'Low Stock', key: 'lowStock', color: 'yellow' }
  ]
};

// Common error messages
export const ERROR_MESSAGES = {
  NO_DATA: 'No data found',
  NO_SALES_DATA: 'No sales data found',
  NO_STOCK_DATA: 'No stock data found',
  NO_LEDGER_DATA: 'No ledger data found',
  TRY_ADJUSTING_FILTERS: 'Try adjusting your filters or date range',
  ADD_ITEMS: 'Add some items to see stock information',
  SELECT_PARTY: 'Please select a party from the filters above to view their ledger.'
};

// Common info box configurations
export const INFO_BOXES = {
  STOCK_CALCULATION: {
    type: 'info',
    title: 'Stock Calculation',
    children: (
      <>
        <p><strong>In Hand = Opening Stock + Purchased - Sold</strong></p>
        <p><strong>Negative Stock:</strong> Red highlight when stock goes below zero</p>
        <p><strong>Low Stock:</strong> Yellow warning when stock is at or below reorder level</p>
      </>
    )
  },
  SELECT_PARTY: {
    type: 'warning',
    title: 'Select a Party',
    children: <p>Please select a party from the filters above to view their ledger.</p>
  }
}; 