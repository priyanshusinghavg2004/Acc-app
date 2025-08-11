import React, { useState, useRef, useEffect } from 'react';

const ShareButton = ({ 
  onExportPDF, 
  onExportExcel, 
  onExportImage, 
  onShareLink, 
  disabled = false,
  className = "bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md transition duration-300 text-sm relative"
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Close dropdown on ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showDropdown) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDropdown]);

  const handleShareClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleOptionClick = (action) => {
    setShowDropdown(false);
    if (action) {
      action();
    }
  };

  const shareOptions = [
    { 
      label: '📄 Share as PDF', 
      action: onExportPDF,
      disabled: !onExportPDF
    },
    { 
      label: '📊 Share as Excel', 
      action: onExportExcel,
      disabled: !onExportExcel
    },
    { 
      label: '🖼️ Share as Image', 
      action: onExportImage,
      disabled: !onExportImage
    },
    { 
      label: '📱 Share Link', 
      action: onShareLink,
      disabled: !onShareLink
    }
  ].filter(option => !option.disabled);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleShareClick}
        disabled={disabled}
        className={className}
      >
        📱 Share
      </button>
      
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200"
        >
          {shareOptions.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionClick(option.action)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={option.disabled}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShareButton;
