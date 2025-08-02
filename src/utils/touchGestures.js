import { useRef, useEffect } from 'react';

// Touch gesture utilities for mobile interactions

// Chart-specific touch utilities
export const useChartTouchGestures = (chartRef, onZoom, onPan) => {
  let startDistance = 0;
  let startX = 0;
  let startY = 0;

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Two finger touch - zoom gesture
      startDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      // Single finger touch - pan gesture
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && onZoom) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDistance / startDistance;
      onZoom(scale);
    } else if (e.touches.length === 1 && onPan) {
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;
      onPan(deltaX, deltaY);
    }
  };

  const addListeners = () => {
    const element = chartRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
    }
  };

  const removeListeners = () => {
    const element = chartRef.current;
    if (element) {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    }
  };

  return { addListeners, removeListeners };
};

// Enhanced swipe gesture with better detection
export const useSwipeGesture = (elementRef, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50) => {
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  let startTime = 0;
  let endTime = 0;

  const handleTouchStart = (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  };

  const handleTouchEnd = (e) => {
    endX = e.changedTouches[0].clientX;
    endY = e.changedTouches[0].clientY;
    endTime = Date.now();
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const duration = endTime - startTime;
    
    // Check if the swipe is fast enough (less than 500ms) and long enough
    if (duration < 500 && (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold)) {
      // Determine if the swipe is more horizontal or vertical
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }
  };

  const addListeners = () => {
    const element = elementRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  };

  const removeListeners = () => {
    const element = elementRef.current;
    if (element) {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    }
  };

  return { addListeners, removeListeners };
};

// Multi-finger gesture support
export const useMultiFingerGesture = (elementRef, onTwoFingerSwipe, onThreeFingerTap, threshold = 50) => {
  let startX = 0;
  let startY = 0;
  let fingerCount = 0;

  const handleTouchStart = (e) => {
    fingerCount = e.touches.length;
    if (fingerCount === 2) {
      startX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      startY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  };

  const handleTouchEnd = (e) => {
    if (fingerCount === 2 && onTwoFingerSwipe) {
      const endX = (e.changedTouches[0].clientX + e.changedTouches[1].clientX) / 2;
      const endY = (e.changedTouches[0].clientY + e.changedTouches[1].clientY) / 2;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
        onTwoFingerSwipe(deltaX, deltaY);
      }
    } else if (fingerCount === 3 && onThreeFingerTap) {
      onThreeFingerTap();
    }
    
    fingerCount = 0;
  };

  const addListeners = () => {
    const element = elementRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  };

  const removeListeners = () => {
    const element = elementRef.current;
    if (element) {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    }
  };

  return { addListeners, removeListeners };
};

// Hook for long press gesture
export const useLongPress = (callback, ms = 500) => {
  let timeoutId = null;

  const start = (e) => {
    timeoutId = setTimeout(() => {
      callback(e);
    }, ms);
  };

  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

// Enhanced double tap detection
export const useDoubleTap = (callback, delay = 300) => {
  let lastTap = 0;
  let timeoutId = null;

  const handleTap = (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < delay && tapLength > 0) {
      // Double tap detected
      callback(e);
      clearTimeout(timeoutId);
      lastTap = 0;
    } else {
      // Single tap - wait for potential double tap
      timeoutId = setTimeout(() => {
        lastTap = 0;
      }, delay);
      lastTap = currentTime;
    }
  };

  return {
    onTouchEnd: handleTap,
  };
};

// Utility for preventing zoom on double tap
export const preventZoom = (elementRef) => {
  let lastTouchEnd = 0;
  
  const handleTouchEnd = (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  };

  const addListener = () => {
    const element = elementRef.current;
    if (element) {
      element.addEventListener('touchend', handleTouchEnd, { passive: false });
    }
  };

  const removeListener = () => {
    const element = elementRef.current;
    if (element) {
      element.removeEventListener('touchend', handleTouchEnd);
    }
  };

  return { addListener, removeListener };
};

// Utility for pull-to-refresh functionality
export const usePullToRefresh = (onRefresh, threshold = 100) => {
  let startY = 0;
  let currentY = 0;
  let isPulling = false;

  const handleTouchStart = (e) => {
    startY = e.touches[0].clientY;
    isPulling = false;
  };

  const handleTouchMove = (e) => {
    if (!startY) return;
    
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    // Only trigger if pulling down from the top
    if (deltaY > threshold && window.scrollY === 0) {
      isPulling = true;
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && onRefresh) {
      onRefresh();
    }
    startY = 0;
    currentY = 0;
    isPulling = false;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};

// Comprehensive gesture manager for the entire app
export const useAppGestureManager = (gestureSettings, onGestureAction) => {
  const appRef = useRef(null);

  useEffect(() => {
    if (!appRef.current || !gestureSettings) return;

    const element = appRef.current;
    let startX = 0, startY = 0, startTime = 0;
    let fingerCount = 0;

    const handleTouchStart = (e) => {
      fingerCount = e.touches.length;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (e) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Swipe gestures
      if (gestureSettings.swipeEnabled && duration < 500 && distance > 50) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX > 0) {
            onGestureAction('swipeRight');
          } else {
            onGestureAction('swipeLeft');
          }
        } else {
          if (deltaY > 0) {
            onGestureAction('swipeDown');
          } else {
            onGestureAction('swipeUp');
          }
        }
      }

      // Multi-finger gestures
      if (fingerCount === 2 && gestureSettings.pinchEnabled) {
        onGestureAction('twoFingerSwipe');
      } else if (fingerCount === 3) {
        onGestureAction('threeFingerTap');
      }

      fingerCount = 0;
    };

    const handleDoubleTap = (e) => {
      if (gestureSettings.doubleTapEnabled) {
        onGestureAction('doubleTap');
      }
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('dblclick', handleDoubleTap, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('dblclick', handleDoubleTap);
    };
  }, [gestureSettings, onGestureAction]);

  return appRef;
};

// Haptic feedback utility
export const triggerHapticFeedback = (pattern = 'light') => {
  if ('vibrate' in navigator) {
    switch (pattern) {
      case 'light':
        navigator.vibrate(50);
        break;
      case 'medium':
        navigator.vibrate(100);
        break;
      case 'heavy':
        navigator.vibrate(200);
        break;
      case 'success':
        navigator.vibrate([50, 50, 50]);
        break;
      case 'error':
        navigator.vibrate([100, 50, 100]);
        break;
      default:
        navigator.vibrate(50);
    }
  }
}; 