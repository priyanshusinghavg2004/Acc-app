import React from 'react';

const MobileResponsiveTable = ({ 
  data, 
  columns, 
  onEdit, 
  onDelete, 
  onView,
  className = "",
  showActions = true,
  actionsColumn = "Actions"
}) => {
  const renderMobileCard = (item, index) => (
    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      {columns.map((column) => {
        if (column.key === actionsColumn) return null;
        
        return (
          <div key={column.key} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-[100px]">
              {column.label}:
            </span>
            <span className="text-sm text-gray-900 text-right flex-1 ml-2">
              {column.render ? column.render(item[column.key], item) : item[column.key]}
            </span>
          </div>
        );
      })}
      
      {showActions && (
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200">
          {onView && (
            <button
              onClick={() => onView(item)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors min-h-[32px] min-w-[44px]"
            >
              View
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors min-h-[32px] min-w-[44px]"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item)}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors min-h-[32px] min-w-[44px]"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderDesktopTable = () => (
    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200 table-responsive">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-4 py-3 whitespace-nowrap text-sm text-gray-800"
                >
                  {column.render ? column.render(item[column.key], item) : item[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={className}>
      {/* Mobile View - Cards */}
      <div className="lg:hidden">
        {data.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No data available</p>
        ) : (
          <div className="space-y-4">
            {data.map((item, index) => renderMobileCard(item, index))}
          </div>
        )}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden lg:block">
        {data.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No data available</p>
        ) : (
          renderDesktopTable()
        )}
      </div>
    </div>
  );
};

export default MobileResponsiveTable; 