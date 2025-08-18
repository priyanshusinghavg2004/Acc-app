import React, { useEffect, useRef } from 'react';

// Button Styles matching the second image
export const ButtonStyles = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors",
  success: "bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors",
  danger: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors",
  secondary: "bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded text-sm transition-colors",
  light: "bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded text-sm transition-colors",
  info: "bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors",
  warning: "bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded text-sm transition-colors",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base"
};

// Standard Button Component
export const StandardButton = ({ 
  children, 
  variant = "primary", 
  size = "md",
  onClick, 
  disabled = false,
  className = "",
  type = "button"
}) => {
  const baseClasses = ButtonStyles[variant] || ButtonStyles.primary;
  const sizeClasses = ButtonStyles[size] || "";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

// Action Bar Component for grouping buttons
export const ActionBar = ({ children, className = "", justify = "between" }) => {
  const justifyClasses = {
    between: "justify-between",
    start: "justify-start",
    end: "justify-end",
    center: "justify-center"
  };
  
  return (
    <div className={`flex items-center gap-2 ${justifyClasses[justify]} ${className}`}>
      {children}
    </div>
  );
};

// Modal Manager for LIFO functionality with global ESC handling
class ModalManager {
  constructor() {
    this.modals = []; // stack of { id, onClose }
    this.listeners = [];
    this.escAttached = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  handleKeyDown(event) {
    if (event.key !== 'Escape') return;
    const top = this.modals[this.modals.length - 1];
    if (!top) return;
    // Pop first to avoid re-entrancy if onClose triggers another close
    this.modals.pop();
    this.notifyListeners();
    try {
      if (typeof top.onClose === 'function') top.onClose();
    } catch (_) {}
    if (this.modals.length === 0) this.detachEsc();
  }

  attachEsc() {
    if (this.escAttached) return;
    document.addEventListener('keydown', this.handleKeyDown);
    this.escAttached = true;
  }

  detachEsc() {
    if (!this.escAttached) return;
    document.removeEventListener('keydown', this.handleKeyDown);
    this.escAttached = false;
  }

  register(modalId, onClose) {
    this.modals.push({ id: modalId, onClose });
    this.attachEsc();
    this.notifyListeners();
  }

  unregister(modalId) {
    this.modals = this.modals.filter(m => m.id !== modalId);
    if (this.modals.length === 0) this.detachEsc();
    this.notifyListeners();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.modals));
  }

  closeTop() {
    const top = this.modals[this.modals.length - 1];
    if (!top) return null;
    this.modals.pop();
    this.notifyListeners();
    try {
      if (typeof top.onClose === 'function') top.onClose();
    } catch (_) {}
    if (this.modals.length === 0) this.detachEsc();
    return top.id;
  }
}

// Global modal manager instance
export const globalModalManager = new ModalManager();

// React hook for modal management
export const useModalManager = () => {
  const [modals, setModals] = React.useState([]);

  React.useEffect(() => {
    const unsubscribe = globalModalManager.subscribe(setModals);
    return unsubscribe;
  }, []);

  const openModal = (modalId, onClose) => {
    globalModalManager.register(modalId, onClose);
  };

  const closeModal = (modalId) => {
    globalModalManager.unregister(modalId);
  };

  const closeTopModal = () => {
    return globalModalManager.closeTop();
  };

  return { modals, openModal, closeModal, closeTopModal };
};

// Base Modal Component
export const StandardModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = "md",
  className = "",
  showCloseButton = true,
  zIndex = "z-50"
}) => {
  const modalRef = useRef(null);
  const modalIdRef = useRef(`modal-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (isOpen) {
      globalModalManager.register(modalIdRef.current, onClose);
      document.body.style.overflow = 'hidden';
      return () => {
        globalModalManager.unregister(modalIdRef.current);
        document.body.style.overflow = 'unset';
      };
    }
    return undefined;
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md", 
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full"
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${zIndex} p-4`}>
      <div className={`bg-white rounded-lg shadow-lg w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          {showCloseButton && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Press ESC to close</span>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-xl transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Preview Modal Component (matching second image styling)
export const PreviewModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  showBackButton = false,
  onBack,
  showPrintButton = false,
  onPrint,
  showPdfButton = false,
  onPdf,
  showZoomControls = false,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  maxWidth = "max-w-4xl",
  maxHeight = "max-h-[90vh]",
  zIndex = "z-50",
  extraActions = null
}) => {
  const modalRef = useRef(null);
  const modalIdRef = useRef(`modal-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (isOpen) {
      globalModalManager.register(modalIdRef.current, onClose);
      document.body.style.overflow = 'hidden';
      return () => {
        globalModalManager.unregister(modalIdRef.current);
        document.body.style.overflow = 'unset';
      };
    }
    return undefined;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${zIndex} p-4`}>
      <div className={`bg-white rounded-lg shadow-lg w-full ${maxWidth} ${maxHeight} overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <StandardButton
                variant="secondary"
                onClick={onBack}
              >
                ← Back to List
              </StandardButton>
            )}
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          </div>
          <ActionBar>
            <span className="text-xs text-gray-500">Press ESC to close</span>
            {extraActions}
            {showPrintButton && (
              <StandardButton variant="primary" onClick={onPrint}>
                Print
              </StandardButton>
            )}
            {showPdfButton && (
              <StandardButton variant="success" onClick={onPdf}>
                Save as PDF
              </StandardButton>
            )}
            {showZoomControls && (
              <>
                <StandardButton variant="light" onClick={onZoomOut}>
                  -
                </StandardButton>
                <span className="px-2 text-gray-800">{Math.round(zoom * 100)}%</span>
                <StandardButton variant="light" onClick={onZoomIn}>
                  +
                </StandardButton>
              </>
            )}
            <StandardButton variant="secondary" onClick={onClose}>
              Close
            </StandardButton>
          </ActionBar>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  onConfirm, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  variant = "danger"
}) => {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <div className="text-center">
        <p className="mb-6 text-gray-600">{message}</p>
        <div className="flex justify-center gap-4">
          <StandardButton variant="secondary" onClick={onClose}>
            {cancelText}
          </StandardButton>
          <StandardButton variant={variant} onClick={onConfirm}>
            {confirmText}
          </StandardButton>
        </div>
      </div>
    </StandardModal>
  );
};

// Form Modal Component
export const FormModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  onSubmit,
  submitText = "Submit",
  cancelText = "Cancel",
  submitVariant = "primary",
  size = "md"
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          {children}
        </div>
        <div className="flex justify-end gap-3">
          <StandardButton variant="secondary" onClick={onClose} type="button">
            {cancelText}
          </StandardButton>
          <StandardButton variant={submitVariant} type="submit">
            {submitText}
          </StandardButton>
        </div>
      </form>
    </StandardModal>
  );
}; 