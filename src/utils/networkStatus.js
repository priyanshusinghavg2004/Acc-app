import { useState, useEffect } from 'react';

// Network status detection hook
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');
  const [effectiveType, setEffectiveType] = useState('unknown');

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const updateConnectionInfo = () => {
      if ('connection' in navigator) {
        setConnectionType(navigator.connection.effectiveType || 'unknown');
        setEffectiveType(navigator.connection.effectiveType || 'unknown');
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for connection changes
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo(); // Initial call
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if ('connection' in navigator) {
        navigator.connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, []);

  return {
    isOnline,
    connectionType,
    effectiveType,
    isSlowConnection: effectiveType === 'slow-2g' || effectiveType === '2g'
  };
};

// Network quality indicator
export const getNetworkQuality = (effectiveType) => {
  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return { quality: 'poor', color: 'red', label: 'Slow Connection' };
    case '3g':
      return { quality: 'fair', color: 'yellow', label: 'Fair Connection' };
    case '4g':
      return { quality: 'good', color: 'green', label: 'Good Connection' };
    default:
      return { quality: 'unknown', color: 'gray', label: 'Unknown Connection' };
  }
};

// Connection speed test utility
export const testConnectionSpeed = async () => {
  const startTime = Date.now();
  
  try {
    // Test with a small image or API endpoint
    const response = await fetch('/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-cache'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      success: true,
      duration,
      speed: duration < 100 ? 'fast' : duration < 500 ? 'medium' : 'slow'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Offline indicator component hook
export const useOfflineIndicator = () => {
  const { isOnline, effectiveType } = useNetworkStatus();
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState(Date.now());

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true);
    } else {
      setShowOfflineBanner(false);
      setLastOnlineTime(Date.now());
    }
  }, [isOnline]);

  const getOfflineDuration = () => {
    if (isOnline) return 0;
    return Math.floor((Date.now() - lastOnlineTime) / 1000);
  };

  return {
    isOnline,
    showOfflineBanner,
    offlineDuration: getOfflineDuration(),
    connectionQuality: getNetworkQuality(effectiveType)
  };
}; 