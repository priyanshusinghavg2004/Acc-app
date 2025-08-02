import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const GestureControls = ({ isVisible, onClose, onGestureAction }) => {
  const [activeTab, setActiveTab] = useState('gestures');
  const [gestureHistory, setGestureHistory] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [gestureSettings, setGestureSettings] = useState({
    swipeEnabled: true,
    pinchEnabled: true,
    longPressEnabled: true,
    doubleTapEnabled: true,
    hapticFeedback: true
  });
  
  const navigate = useNavigate();
  const gestureRef = useRef(null);

  // Gesture configurations
  const gestureConfigs = [
    {
      category: 'Navigation',
      gestures: [
        { 
          name: 'Swipe Right', 
          description: 'Go back to previous page',
          icon: '⬅️',
          action: () => window.history.back(),
          enabled: true
        },
        { 
          name: 'Swipe Left', 
          description: 'Go forward to next page',
          icon: '➡️',
          action: () => window.history.forward(),
          enabled: true
        },
        { 
          name: 'Swipe Up', 
          description: 'Go to dashboard',
          icon: '⬆️',
          action: () => navigate('/dashboard'),
          enabled: true
        },
        { 
          name: 'Swipe Down', 
          description: 'Refresh page',
          icon: '⬇️',
          action: () => window.location.reload(),
          enabled: true
        }
      ]
    },
    {
      category: 'Actions',
      gestures: [
        { 
          name: 'Double Tap', 
          description: 'Quick search',
          icon: '🔍',
          action: () => onGestureAction('search'),
          enabled: true
        },
        { 
          name: 'Long Press', 
          description: 'Context menu',
          icon: '📋',
          action: () => onGestureAction('contextMenu'),
          enabled: true
        },
        { 
          name: 'Pinch In', 
          description: 'Zoom out',
          icon: '🔍➖',
          action: () => onGestureAction('zoomOut'),
          enabled: true
        },
        { 
          name: 'Pinch Out', 
          description: 'Zoom in',
          icon: '🔍➕',
          action: () => onGestureAction('zoomIn'),
          enabled: true
        }
      ]
    },
    {
      category: 'Quick Actions',
      gestures: [
        { 
          name: 'Two Finger Swipe Up', 
          description: 'Add new sale',
          icon: '💰',
          action: () => navigate('/sales'),
          enabled: true
        },
        { 
          name: 'Two Finger Swipe Down', 
          description: 'Add new purchase',
          icon: '🛒',
          action: () => navigate('/purchases'),
          enabled: true
        },
        { 
          name: 'Three Finger Tap', 
          description: 'Voice commands',
          icon: '🎤',
          action: () => onGestureAction('voiceCommands'),
          enabled: true
        },
        { 
          name: 'Three Finger Swipe', 
          description: 'Export data',
          icon: '📊',
          action: () => onGestureAction('export'),
          enabled: true
        }
      ]
    }
  ];

  // Load gesture history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gestureHistory');
    if (saved) {
      const history = JSON.parse(saved);
      setGestureHistory(history.slice(0, 20));
    }
  }, []);

  // Load gesture settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gestureSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      setGestureSettings(settings);
    }
  }, []);

  // Save gesture to history
  const saveToHistory = (gesture, success) => {
    const newGesture = {
      gesture,
      success,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString()
    };
    
    const saved = localStorage.getItem('gestureHistory');
    const history = saved ? JSON.parse(saved) : [];
    const updatedHistory = [newGesture, ...history].slice(0, 50);
    
    setGestureHistory(updatedHistory.slice(0, 20));
    localStorage.setItem('gestureHistory', JSON.stringify(updatedHistory));
  };

  // Save gesture settings
  const saveSettings = (newSettings) => {
    setGestureSettings(newSettings);
    localStorage.setItem('gestureSettings', JSON.stringify(newSettings));
  };

  // Handle gesture execution
  const executeGesture = (gesture) => {
    try {
      gesture.action();
      saveToHistory(gesture.name, true);
      
      // Show success feedback
      if (gestureSettings.hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error executing gesture:', error);
      saveToHistory(gesture.name, false);
    }
  };

  // Clear gesture history
  const clearGestureHistory = () => {
    setGestureHistory([]);
    localStorage.removeItem('gestureHistory');
  };

  // Reset gesture settings
  const resetGestureSettings = () => {
    const defaultSettings = {
      swipeEnabled: true,
      pinchEnabled: true,
      longPressEnabled: true,
      doubleTapEnabled: true,
      hapticFeedback: true
    };
    saveSettings(defaultSettings);
  };

  // Toggle gesture setting
  const toggleGestureSetting = (setting) => {
    const newSettings = {
      ...gestureSettings,
      [setting]: !gestureSettings[setting]
    };
    saveSettings(newSettings);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">👆</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Gesture Controls</h2>
              <p className="text-sm text-gray-600">Control your app with touch gestures</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('gestures')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'gestures'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>👆</span>
            <span>Gestures</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📚</span>
            <span>History</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'gestures' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Gestures</h3>
                <p className="text-gray-600">Use these touch gestures to control your app</p>
              </div>

              {gestureConfigs.map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-3">
                  <h4 className="text-md font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    {category.category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.gestures.map((gesture, gestureIndex) => (
                      <div
                        key={gestureIndex}
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                          gesture.enabled && gestureSettings[getGestureSettingKey(gesture.name)]
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-gray-50 opacity-60'
                        }`}
                      >
                        <span className="text-2xl">{gesture.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{gesture.name}</p>
                          <p className="text-xs text-gray-600">{gesture.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            gesture.enabled && gestureSettings[getGestureSettingKey(gesture.name)]
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                          }`}></span>
                          <button
                            onClick={() => executeGesture(gesture)}
                            disabled={!gesture.enabled || !gestureSettings[getGestureSettingKey(gesture.name)]}
                            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            Test
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Gesture Tips */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">💡 Gesture Tips</h3>
                <div className="space-y-1 text-sm text-yellow-700">
                  <p>• Swipe gestures work on any screen</p>
                  <p>• Pinch gestures work on content areas</p>
                  <p>• Long press for context menus</p>
                  <p>• Double tap for quick actions</p>
                  <p>• Use multiple fingers for advanced gestures</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gesture Settings</h3>
                <p className="text-gray-600">Customize your gesture experience</p>
              </div>

              {/* Gesture Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Swipe Gestures</h4>
                    <p className="text-sm text-gray-600">Enable swipe navigation</p>
                  </div>
                  <button
                    onClick={() => toggleGestureSetting('swipeEnabled')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gestureSettings.swipeEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gestureSettings.swipeEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Pinch Gestures</h4>
                    <p className="text-sm text-gray-600">Enable zoom controls</p>
                  </div>
                  <button
                    onClick={() => toggleGestureSetting('pinchEnabled')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gestureSettings.pinchEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gestureSettings.pinchEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Long Press</h4>
                    <p className="text-sm text-gray-600">Enable context menus</p>
                  </div>
                  <button
                    onClick={() => toggleGestureSetting('longPressEnabled')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gestureSettings.longPressEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gestureSettings.longPressEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Double Tap</h4>
                    <p className="text-sm text-gray-600">Enable quick actions</p>
                  </div>
                  <button
                    onClick={() => toggleGestureSetting('doubleTapEnabled')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gestureSettings.doubleTapEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gestureSettings.doubleTapEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Haptic Feedback</h4>
                    <p className="text-sm text-gray-600">Vibrate on gesture success</p>
                  </div>
                  <button
                    onClick={() => toggleGestureSetting('hapticFeedback')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gestureSettings.hapticFeedback ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gestureSettings.hapticFeedback ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={resetGestureSettings}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Reset to Default
                </button>
                <button
                  onClick={() => setShowTutorial(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Tutorial
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Gesture History</h3>
                {gestureHistory.length > 0 && (
                  <button
                    onClick={clearGestureHistory}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {gestureHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No gesture history</h3>
                  <p className="text-gray-600">Your gesture interactions will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {gestureHistory.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        item.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg ${item.success ? 'text-green-600' : 'text-red-600'}`}>
                          {item.success ? '✅' : '❌'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{item.gesture}</p>
                          <p className="text-sm text-gray-500">{item.date}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const gesture = findGestureByName(item.gesture, gestureConfigs);
                          if (gesture) executeGesture(gesture);
                        }}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {activeTab === 'gestures' && 'Touch gestures enabled'}
            {activeTab === 'settings' && `${Object.values(gestureSettings).filter(Boolean).length}/5 features enabled`}
            {activeTab === 'history' && `${gestureHistory.length} gestures recorded`}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tutorial Modal */}
        {showTutorial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Gesture Controls Tutorial</h3>
                <button
                  onClick={() => setShowTutorial(false)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">👆 Basic Gestures</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Swipe Right</span>
                        <p className="text-gray-600">Go back to previous page</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Swipe Left</span>
                        <p className="text-gray-600">Go forward to next page</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Swipe Up</span>
                        <p className="text-gray-600">Navigate to dashboard</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Swipe Down</span>
                        <p className="text-gray-600">Refresh current page</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🔍 Advanced Gestures</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Double Tap</span>
                        <p className="text-gray-600">Quick search function</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Long Press</span>
                        <p className="text-gray-600">Open context menu</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Pinch In/Out</span>
                        <p className="text-gray-600">Zoom out/in content</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="font-medium">Two Finger Swipe</span>
                        <p className="text-gray-600">Quick navigation</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">💡 Best Practices</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      <li>Use smooth, deliberate gestures</li>
                      <li>Keep your finger on screen during swipes</li>
                      <li>Use the edge of the screen for navigation</li>
                      <li>Practice gestures in a quiet environment</li>
                      <li>Enable haptic feedback for better experience</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowTutorial(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get gesture setting key
const getGestureSettingKey = (gestureName) => {
  if (gestureName.includes('Swipe')) return 'swipeEnabled';
  if (gestureName.includes('Pinch')) return 'pinchEnabled';
  if (gestureName.includes('Long Press')) return 'longPressEnabled';
  if (gestureName.includes('Double Tap')) return 'doubleTapEnabled';
  return 'swipeEnabled'; // default
};

// Helper function to find gesture by name
const findGestureByName = (gestureName, gestureConfigs) => {
  for (const category of gestureConfigs) {
    for (const gesture of category.gestures) {
      if (gesture.name === gestureName) {
        return gesture;
      }
    }
  }
  return null;
};

export default GestureControls; 