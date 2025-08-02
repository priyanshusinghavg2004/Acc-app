import React, { useState, useEffect } from 'react';
import { useOfflineIndicator } from '../utils/networkStatus';
import offlineStorage from '../utils/offlineStorage';

const OfflineIndicator = () => {
  const { isOnline, showOfflineBanner, offlineDuration, connectionQuality } = useOfflineIndicator();
  const [pendingActions, setPendingActions] = useState(0);
  const [syncQueue, setSyncQueue] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updatePendingCounts = async () => {
      try {
        const actions = await offlineStorage.getPendingActions();
        const queue = await offlineStorage.getSyncQueue();
        setPendingActions(actions.length);
        setSyncQueue(queue.length);
      } catch (error) {
        console.error('Error getting pending counts:', error);
      }
    };

    updatePendingCounts();
    
    // Update counts every 30 seconds
    const interval = setInterval(updatePendingCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleSyncNow = async () => {
    if (!isOnline) return;
    
    try {
      // Trigger background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync');
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
    }
  };

  if (!showOfflineBanner && pendingActions === 0 && syncQueue === 0) {
    return null;
  }

  return (
    <>
      {/* Main offline banner */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <span className="font-medium">You're offline</span>
                <span className="ml-2 text-sm opacity-90">
                  {formatDuration(offlineDuration)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm underline hover:no-underline"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>
      )}

      {/* Pending actions indicator */}
      {(pendingActions > 0 || syncQueue > 0) && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-yellow-600 text-white px-4 py-2 shadow-lg">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">
                {pendingActions > 0 && `${pendingActions} pending action${pendingActions > 1 ? 's' : ''}`}
                {pendingActions > 0 && syncQueue > 0 && ' • '}
                {syncQueue > 0 && `${syncQueue} item${syncQueue > 1 ? 's' : ''} in sync queue`}
              </span>
            </div>
            {isOnline && (
              <button
                onClick={handleSyncNow}
                className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded hover:bg-opacity-30 transition-colors"
              >
                Sync Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Details panel */}
      {showDetails && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-gray-900 bg-opacity-75 text-white px-4 py-4 shadow-lg">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Connection Status</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality:</span>
                    <span className={`text-${connectionQuality.color}-400`}>
                      {connectionQuality.label}
                    </span>
                  </div>
                  {!isOnline && (
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span>{formatDuration(offlineDuration)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Offline Storage</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Pending Actions:</span>
                    <span className="text-yellow-400">{pendingActions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sync Queue:</span>
                    <span className="text-blue-400">{syncQueue}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Actions</h3>
                <div className="space-y-2">
                  {isOnline && (pendingActions > 0 || syncQueue > 0) && (
                    <button
                      onClick={handleSyncNow}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm transition-colors"
                    >
                      Sync All Data
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetails(false)}
                    className="w-full bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded text-sm transition-colors"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineIndicator; 