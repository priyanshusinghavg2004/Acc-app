import { useState, useEffect, useCallback } from 'react';
import pushNotificationManager from './pushNotifications';

export const usePushNotifications = (userId, appId) => {
  const [status, setStatus] = useState({
    isSupported: false,
    isInitialized: false,
    permission: 'default',
    hasToken: false,
    token: null
  });

  const [settings, setSettings] = useState({
    enabled: true,
    permissions: {
      sales: true,
      purchases: true,
      payments: true,
      reports: true,
      system: true
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize push notifications
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await pushNotificationManager.initialize();
      
      if (success && userId && appId) {
        // Save token to Firebase
        await pushNotificationManager.saveTokenToFirebase(userId, appId);
        
        // Load settings
        const userSettings = await pushNotificationManager.getNotificationSettings(userId, appId);
        if (userSettings) {
          setSettings(userSettings);
        }
      }

      // Update status
      setStatus(pushNotificationManager.getStatus());
    } catch (err) {
      setError(err.message);
      console.error('Error initializing push notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, appId]);

  // Request permission
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const granted = await pushNotificationManager.requestPermission();
      
      if (granted && userId && appId) {
        await pushNotificationManager.saveTokenToFirebase(userId, appId);
      }

      setStatus(pushNotificationManager.getStatus());
      return granted;
    } catch (err) {
      setError(err.message);
      console.error('Error requesting permission:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, appId]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      await pushNotificationManager.sendTestNotification();
    } catch (err) {
      setError(err.message);
      console.error('Error sending test notification:', err);
    }
  }, []);

  // Update notification settings
  const updateSettings = useCallback(async (newSettings) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedSettings = { ...settings, ...newSettings };
      await pushNotificationManager.updateNotificationSettings(userId, appId, updatedSettings);
      setSettings(updatedSettings);
    } catch (err) {
      setError(err.message);
      console.error('Error updating notification settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [settings, userId, appId]);

  // Toggle specific permission
  const togglePermission = useCallback(async (permissionType) => {
    const newPermissions = {
      ...settings.permissions,
      [permissionType]: !settings.permissions[permissionType]
    };

    await updateSettings({ permissions: newPermissions });
  }, [settings.permissions, updateSettings]);

  // Toggle all notifications
  const toggleNotifications = useCallback(async () => {
    await updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  // Initialize on mount
  useEffect(() => {
    if (userId && appId) {
      initialize();
    }
  }, [userId, appId, initialize]);

  // Update status when push notification manager changes
  useEffect(() => {
    const updateStatus = () => {
      setStatus(pushNotificationManager.getStatus());
    };

    // Update status periodically
    const interval = setInterval(updateStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    // State
    status,
    settings,
    isLoading,
    error,
    
    // Actions
    initialize,
    requestPermission,
    sendTestNotification,
    updateSettings,
    togglePermission,
    toggleNotifications,
    
    // Computed values
    canSendNotifications: status.permission === 'granted' && settings.enabled,
    isPermissionGranted: status.permission === 'granted',
    isSupported: status.isSupported
  };
}; 