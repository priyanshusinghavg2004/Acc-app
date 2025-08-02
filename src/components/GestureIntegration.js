import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  useSwipeGesture, 
  useMultiFingerGesture, 
  useDoubleTap, 
  useLongPress,
  triggerHapticFeedback 
} from '../utils/touchGestures';

const GestureIntegration = ({ 
  children, 
  gestureSettings, 
  onGestureAction,
  enableGlobalGestures = true 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const gestureRef = useRef(null);
  const [gestureHistory, setGestureHistory] = useState([]);

  // Load gesture settings from localStorage
  const [settings, setSettings] = useState({
    swipeEnabled: true,
    pinchEnabled: true,
    longPressEnabled: true,
    doubleTapEnabled: true,
    hapticFeedback: true,
    ...gestureSettings
  });

  useEffect(() => {
    const saved = localStorage.getItem('gestureSettings');
    if (saved) {
      const savedSettings = JSON.parse(saved);
      setSettings(prev => ({ ...prev, ...savedSettings }));
    }
  }, []);

  // Save gesture to history
  const saveToHistory = (gesture, success = true) => {
    const newGesture = {
      gesture,
      success,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString(),
      path: location.pathname
    };
    
    const saved = localStorage.getItem('gestureHistory');
    const history = saved ? JSON.parse(saved) : [];
    const updatedHistory = [newGesture, ...history].slice(0, 50);
    
    setGestureHistory(updatedHistory.slice(0, 20));
    localStorage.setItem('gestureHistory', JSON.stringify(updatedHistory));
  };

  // Handle gesture execution with feedback
  const executeGesture = (gestureName, action) => {
    try {
      if (settings.hapticFeedback) {
        triggerHapticFeedback('light');
      }
      
      action();
      saveToHistory(gestureName, true);
      
      // Call the parent gesture action handler
      if (onGestureAction) {
        onGestureAction(gestureName);
      }
    } catch (error) {
      console.error('Error executing gesture:', error);
      saveToHistory(gestureName, false);
      if (settings.hapticFeedback) {
        triggerHapticFeedback('error');
      }
    }
  };

  // Navigation gestures
  const handleSwipeLeft = () => {
    if (!settings.swipeEnabled) return;
    
    executeGesture('Swipe Left', () => {
      // Go back in history
      window.history.back();
    });
  };

  const handleSwipeRight = () => {
    if (!settings.swipeEnabled) return;
    
    executeGesture('Swipe Right', () => {
      // Go forward in history
      window.history.forward();
    });
  };

  const handleSwipeUp = () => {
    if (!settings.swipeEnabled) return;
    
    executeGesture('Swipe Up', () => {
      // Navigate to dashboard
      navigate('/dashboard');
    });
  };

  const handleSwipeDown = () => {
    if (!settings.swipeEnabled) return;
    
    executeGesture('Swipe Down', () => {
      // Refresh page
      window.location.reload();
    });
  };

  // Multi-finger gestures
  const handleTwoFingerSwipe = (deltaX, deltaY) => {
    if (!settings.pinchEnabled) return;
    
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY > 0) {
        executeGesture('Two Finger Swipe Down', () => {
          navigate('/purchases');
        });
      } else {
        executeGesture('Two Finger Swipe Up', () => {
          navigate('/sales');
        });
      }
    }
  };

  const handleThreeFingerTap = () => {
    executeGesture('Three Finger Tap', () => {
      // Trigger voice commands
      if (onGestureAction) {
        onGestureAction('voiceCommands');
      }
    });
  };

  // Double tap gesture
  const handleDoubleTap = () => {
    if (!settings.doubleTapEnabled) return;
    
    executeGesture('Double Tap', () => {
      // Quick search
      if (onGestureAction) {
        onGestureAction('search');
      }
    });
  };

  // Long press gesture
  const handleLongPress = () => {
    if (!settings.longPressEnabled) return;
    
    executeGesture('Long Press', () => {
      // Context menu
      if (onGestureAction) {
        onGestureAction('contextMenu');
      }
    });
  };

  // Set up gesture listeners
  const { addListeners: addSwipeListeners, removeListeners: removeSwipeListeners } = useSwipeGesture(
    gestureRef,
    handleSwipeLeft,
    handleSwipeRight,
    handleSwipeUp,
    handleSwipeDown
  );

  const { addListeners: addMultiFingerListeners, removeListeners: removeMultiFingerListeners } = useMultiFingerGesture(
    gestureRef,
    handleTwoFingerSwipe,
    handleThreeFingerTap
  );

  const doubleTapHandlers = useDoubleTap(handleDoubleTap);
  const longPressHandlers = useLongPress(handleLongPress);

  // Initialize gesture listeners
  useEffect(() => {
    if (!enableGlobalGestures || !gestureRef.current) return;

    addSwipeListeners();
    addMultiFingerListeners();

    return () => {
      removeSwipeListeners();
      removeMultiFingerListeners();
    };
  }, [enableGlobalGestures, settings.swipeEnabled, settings.pinchEnabled]);

  // Prevent default touch behaviors that might interfere with gestures
  useEffect(() => {
    const preventDefaults = (e) => {
      // Prevent zoom on double tap
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    if (gestureRef.current) {
      gestureRef.current.addEventListener('touchstart', preventDefaults, { passive: false });
    }

    return () => {
      if (gestureRef.current) {
        gestureRef.current.removeEventListener('touchstart', preventDefaults);
      }
    };
  }, []);

  // Add gesture indicators for debugging (only in development)
  const [showGestureIndicator, setShowGestureIndicator] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleKeyPress = (e) => {
        if (e.key === 'g' && e.ctrlKey) {
          setShowGestureIndicator(!showGestureIndicator);
        }
      };

      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [showGestureIndicator]);

  return (
    <div 
      ref={gestureRef}
      className="gesture-container"
      {...doubleTapHandlers}
      {...longPressHandlers}
      style={{ 
        position: 'relative',
        minHeight: '100vh',
        touchAction: 'manipulation' // Optimize for touch
      }}
    >
      {children}
      
      {/* Gesture indicator for debugging */}
      {showGestureIndicator && process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs z-50">
          <div>👆 Gesture Controls Active</div>
          <div>Swipe: Navigation</div>
          <div>2-Finger: Quick Actions</div>
          <div>3-Finger: Voice Commands</div>
          <div>Double Tap: Search</div>
          <div>Long Press: Context</div>
        </div>
      )}
      
      {/* Gesture feedback overlay */}
      {gestureHistory.length > 0 && gestureHistory[0] && (
        <div className="fixed bottom-4 left-4 bg-white bg-opacity-90 p-2 rounded shadow-lg text-xs z-40">
          <div className="font-medium">Last Gesture:</div>
          <div className={gestureHistory[0].success ? 'text-green-600' : 'text-red-600'}>
            {gestureHistory[0].gesture}
          </div>
        </div>
      )}
    </div>
  );
};

export default GestureIntegration; 