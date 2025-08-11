import React from 'react';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';

// Common utility functions
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN');
};

export const handleRowClick = (item) => {
  console.log('Open document:', item.id);
};

// Report Header Component
export const ReportHeader = ({ title, subtitle, children }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
    <p className="text-gray-600">{subtitle}</p>
    {children}
  </div>
);

// Summary Cards Component
export const SummaryCards = ({ cards }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {cards.map((card, index) => (
      <div key={index} className={`bg-${card.color}-50 p-4 rounded-lg`}>
        <div className={`text-sm text-${card.color}-600 font-medium`}>{card.label}</div>
        <div className={`text-2xl font-bold text-${card.color}-800`}>{card.value}</div>
      </div>
    ))}
  </div>
);

// Report Table Component
export const ReportTable = ({ 
  data, 
  columns, 
  sortConfig, 
  onSort, 
  onRowClick, 
  pagination,
  emptyMessage = "No data found",
  emptySubMessage = "Try adjusting your filters or date range"
}) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 text-lg mb-2">{emptyMessage}</div>
        <p className="text-gray-400">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                column.sortable ? (
                  <SortableHeader
                    key={index}
                    columnKey={column.key}
                    label={column.label}
                    onSort={onSort}
                    sortConfig={sortConfig}
                    className={column.className}
                  />
                ) : (
                  <th key={index} className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}>
                    {column.label}
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className={`px-6 py-4 whitespace-nowrap ${column.cellClassName || ''}`}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && <PaginationControls {...pagination} />}
    </div>
  );
};

// Loading Component
export const LoadingSpinner = ({ message = "Loading report data..." }) => (
  <div className="p-8 text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
    <p className="text-gray-600">{message}</p>
  </div>
);

// Info Box Component
export const InfoBox = ({ type = 'info', title, children }) => {
  const colors = {
    info: 'blue',
    warning: 'yellow',
    success: 'green',
    error: 'red'
  };
  
  const icons = {
    info: (
      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    success: (
      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    )
  };

  const color = colors[type];
  const icon = icons[type];

  return (
    <div className={`mt-6 p-4 bg-${color}-50 border border-${color}-200 rounded-lg`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium text-${color}-800`}>{title}</h3>
          <div className={`mt-2 text-sm text-${color}-700`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// Back Button Component
export const BackButton = ({ onClick, children }) => (
  <div className="mb-4">
    <button
      onClick={onClick}
      className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-300"
    >
      {children}
    </button>
  </div>
); 