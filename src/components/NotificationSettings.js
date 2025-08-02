import React, { useState } from 'react';
import { usePushNotifications } from '../utils/usePushNotifications';

const NotificationSettings = ({ userId, appId, isVisible, onClose }) => {
  const {
    status,
    settings,
    isLoading,
    error,
    requestPermission,
    sendTestNotification,
    togglePermission,
    toggleNotifications,
    isSupported,
    isPermissionGranted
  } = usePushNotifications(userId, appId);

  const [activeTab, setActiveTab] = useState('general');

  if (!isVisible) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: '🔔' },
    { id: 'permissions', label: 'Permissions', icon: '⚙️' },
    { id: 'test', label: 'Test', icon: '🧪' }
  ];

  const permissionTypes = [
    { key: 'sales', label: 'Sales & Invoices', description: 'New sales, payment reminders, invoice updates' },
    { key: 'purchases', label: 'Purchases & Expenses', description: 'New purchases, expense alerts, supplier updates' },
    { key: 'payments', label: 'Payments', description: 'Payment confirmations, overdue reminders, receipt updates' },
    { key: 'reports', label: 'Reports & Analytics', description: 'Monthly reports, performance alerts, insights' },
    { key: 'system', label: 'System & Updates', description: 'App updates, maintenance alerts, system notifications' }
  ];

  const renderGeneralTab = () => (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Notification Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Support Status</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isSupported ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isSupported ? 'Supported' : 'Not Supported'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Permission Status</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isPermissionGranted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isPermissionGranted ? 'Granted' : 'Not Granted'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Token Status</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              status.hasToken ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {status.hasToken ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Toggle */}
      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Enable Notifications</h3>
          <p className="text-sm text-gray-600">Receive important updates and alerts</p>
        </div>
        <button
          onClick={toggleNotifications}
          disabled={!isSupported || !isPermissionGranted || isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            settings.enabled ? 'bg-blue-600' : 'bg-gray-200'
          } ${(!isSupported || !isPermissionGranted || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Permission Request */}
      {!isPermissionGranted && isSupported && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">Permission Required</h3>
              <p className="text-sm text-blue-700 mt-1">
                To receive notifications, you need to grant permission in your browser.
              </p>
              <button
                onClick={requestPermission}
                disabled={isLoading}
                className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Requesting...' : 'Grant Permission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPermissionsTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Notification Types</h3>
        <p className="text-sm text-gray-600">Choose which types of notifications you want to receive</p>
      </div>

      <div className="space-y-3">
        {permissionTypes.map((permission) => (
          <div key={permission.key} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">{permission.label}</h4>
              <p className="text-xs text-gray-600 mt-1">{permission.description}</p>
            </div>
            <button
              onClick={() => togglePermission(permission.key)}
              disabled={!settings.enabled || !isPermissionGranted || isLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.permissions[permission.key] ? 'bg-blue-600' : 'bg-gray-200'
              } ${(!settings.enabled || !isPermissionGranted || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.permissions[permission.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTestTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Notifications</h3>
        <p className="text-sm text-gray-600">Send a test notification to verify everything is working</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={sendTestNotification}
          disabled={!isPermissionGranted || !settings.enabled || isLoading}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Sending...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
              </svg>
              <span>Send Test Notification</span>
            </div>
          )}
        </button>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Testing Tips</h3>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                <li>• Make sure notifications are enabled in your browser</li>
                <li>• Check that the app has permission to send notifications</li>
                <li>• Test notifications will appear as browser notifications</li>
                <li>• You can also see in-app notifications in the top-right corner</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔔</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
              <p className="text-sm text-gray-600">Manage your notification preferences</p>
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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'permissions' && renderPermissionsTab()}
          {activeTab === 'test' && renderTestTab()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {isLoading ? 'Saving...' : 'Settings saved automatically'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings; 