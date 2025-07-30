import React from 'react';

const ActionButtons = ({
  actions = [],
  className = "",
  size = "sm" // sm, md, lg
}) => {
  const getIcon = (action) => {
    switch (action.type) {
      case 'view': return '🔍';
      case 'edit': return '🖊️';
      case 'delete': return '❌';
      case 'payment': return '💳';
      case 'receipts': return `R(${action.count || 0})`;
      case 'invoice': return '📜';
      case 'challan': return '📜';
      case 'quotation': return '📜';
      case 'purchaseBill': return '📜';
      case 'purchaseOrder': return '📜';
      case 'print': return '🖨️';
      case 'pdf': return '📄';
      case 'download': return '⬇️';
      case 'preview': return '👁️';
      case 'back': return '←';
      case 'close': return '✕';
      default: return '⚙️';
    }
  };

  const getTooltip = (action) => {
    switch (action.type) {
      case 'view': return 'View Details';
      case 'edit': return 'Edit';
      case 'delete': return 'Delete';
      case 'payment': return 'Add Payment';
      case 'receipts':
        if (action.count > 0) {
          return action.receiptNumbers ?
            `Receipts (${action.count}): ${action.receiptNumbers.join(', ')}` :
            `Receipts (${action.count})`;
        }
        return 'Receipts (0)';
      case 'invoice': return 'View Invoice';
      case 'challan': return 'View Challan';
      case 'quotation': return 'View Quotation';
      case 'purchaseBill': return 'View Purchase Bill';
      case 'purchaseOrder': return 'View Purchase Order';
      case 'print': return 'Print';
      case 'pdf': return 'Save as PDF';
      case 'download': return 'Download';
      case 'preview': return 'Preview';
      case 'back': return 'Back to List';
      case 'close': return 'Close';
      default: return action.tooltip || action.label || 'Action';
    }
  };

  const getButtonClasses = (action) => {
    const baseClasses = `inline-flex items-center justify-center rounded transition-colors duration-200 hover:scale-110 ${
      size === 'sm' ? 'w-6 h-6 text-xs' :
      size === 'md' ? 'w-8 h-8 text-sm' :
      'w-10 h-10 text-base'
    }`;

    switch (action.type) {
      case 'view': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'edit': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'delete': return `${baseClasses} text-red-600 hover:text-red-800 hover:bg-red-50`;
      case 'payment': return `${baseClasses} text-green-600 hover:text-green-800 hover:bg-green-50`;
      case 'receipts': return `${baseClasses} text-purple-600 hover:text-purple-800 hover:bg-purple-50`;
      case 'invoice': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'challan': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'quotation': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'purchaseBill': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'purchaseOrder': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'print': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'pdf': return `${baseClasses} text-green-600 hover:text-green-800 hover:bg-green-50`;
      case 'download': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'preview': return `${baseClasses} text-blue-600 hover:text-blue-800 hover:bg-blue-50`;
      case 'back': return `${baseClasses} text-gray-600 hover:text-gray-800 hover:bg-gray-50`;
      case 'close': return `${baseClasses} text-gray-600 hover:text-gray-800 hover:bg-gray-50`;
      default: return `${baseClasses} text-gray-600 hover:text-gray-800 hover:bg-gray-50`;
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={getButtonClasses(action)}
          title={getTooltip(action)}
          disabled={action.disabled}
        >
          {getIcon(action)}
        </button>
      ))}
    </div>
  );
};

export default ActionButtons; 