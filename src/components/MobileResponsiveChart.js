import React, { useRef, useEffect } from 'react';
import { ResponsiveContainer } from 'recharts';
import { useChartTouchGestures } from '../utils/touchGestures';

const MobileResponsiveChart = ({ 
  children, 
  height = 300, 
  className = "",
  loading = false,
  emptyMessage = "No data available",
  enableTouchGestures = true
}) => {
  const chartRef = useRef(null);
  
  const { addListeners, removeListeners } = useChartTouchGestures(
    chartRef,
    (scale) => {
      // Handle zoom if needed
      console.log('Chart zoom:', scale);
    },
    (deltaX, deltaY) => {
      // Handle pan if needed
      console.log('Chart pan:', deltaX, deltaY);
    }
  );

  useEffect(() => {
    if (enableTouchGestures && chartRef.current) {
      addListeners();
      return () => removeListeners();
    }
  }, [enableTouchGestures, addListeners, removeListeners]);

  if (loading) {
    return (
      <div className={`chart-loading ${className}`}>
        <div className="flex flex-col items-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading chart...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={chartRef}
      className={`mobile-chart-container ${className}`} 
      style={{ height: `${height}px` }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
};

export default MobileResponsiveChart; 