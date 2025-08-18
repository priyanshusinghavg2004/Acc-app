import { useState, useEffect } from 'react';
import { getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase.config';
import { getSettingsDoc, getBackofficeAdminDoc } from './appArtifacts';

export const usePermissions = () => {
    const [userPermissions, setUserPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [systemRole, setSystemRole] = useState(null);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, (u) => {
            setUserId(u ? u.uid : null);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!db || !userId) {
            setLoading(false);
            return;
        }

        const loadUserPermissions = async () => {
            try {
                const userDoc = await getDoc(getSettingsDoc(userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserPermissions(userData.permissions || []);
                    setUserRole(userData.companyRole || null);
                }
                // Check new backoffice role document
                const backofficeDoc = await getDoc(getBackofficeAdminDoc(userId));
                if (backofficeDoc.exists()) {
                    const bo = backofficeDoc.data();
                    setSystemRole(bo.role || 'superAdmin');
                } else {
                    // Fallback to legacy systemRole in settings
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.systemRole) setSystemRole(userData.systemRole);
                    }
                }
                setLoading(false);
            } catch (error) {
                console.error('Error loading user permissions:', error);
                setLoading(false);
            }
        };

        loadUserPermissions();
    }, [userId]);

    const hasPermission = (permissionId) => {
        // Owners and admins have all permissions
        if (userRole === 'owner' || userRole === 'admin') {
            return true;
        }
        
        // Check specific permission
        return userPermissions.includes(permissionId);
    };

    const hasAnyPermission = (permissionIds) => {
        return permissionIds.some(permissionId => hasPermission(permissionId));
    };

    const hasAllPermissions = (permissionIds) => {
        return permissionIds.every(permissionId => hasPermission(permissionId));
    };

    const isAdmin = userRole === 'owner' || userRole === 'admin' || !!systemRole;
    const isSystemAdmin = !!systemRole;

    return {
        userId,
        userPermissions,
        userRole,
        systemRole,
        isAdmin,
        isSystemAdmin,
        loading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions
    };
};

// Permission constants
export const PERMISSIONS = {
    DASHBOARD: 'dashboard',
    PARTIES: 'parties',
    ITEMS: 'items',
    SALES: 'sales',
    PURCHASES: 'purchases',
    PAYMENTS: 'payments',
    EXPENSES: 'expenses',
    REPORTS: 'reports',
    TAXES: 'taxes',
    MANUFACTURING: 'manufacturing',
    SETTINGS: 'settings',
    DATA_EXPORT: 'data_export',
    ADMIN_PANEL: 'admin_panel'
};

// Permission check component
export const PermissionGate = ({ permission, children, fallback = null }) => {
    const { hasPermission, loading } = usePermissions();

    if (loading) {
        return <div className="text-center py-4">Loading...</div>;
    }

    if (!hasPermission) {
        return fallback || (
            <div className="text-center py-8">
                <div className="text-red-500 text-6xl mb-4">🚫</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Access Denied</h3>
                <p className="text-gray-600">You don't have permission to access this feature.</p>
                <p className="text-sm text-gray-500 mt-2">Contact your administrator for access.</p>
            </div>
        );
    }

    return children;
};

// Admin only component
export const AdminOnly = ({ children, fallback = null }) => {
    const { isAdmin, loading } = usePermissions();

    if (loading) {
        return <div className="text-center py-4">Loading...</div>;
    }

    if (!isAdmin) {
        return fallback || (
            <div className="text-center py-8">
                <div className="text-red-500 text-6xl mb-4">🔒</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Access Required</h3>
                <p className="text-gray-600">This feature is only available to company owners and admins.</p>
            </div>
        );
    }

    return children;
}; 

// System admin only component
export const SystemAdminOnly = ({ children, fallback = null }) => {
    const { isSystemAdmin, loading } = usePermissions();

    if (loading) {
        return <div className="text-center py-4">Loading...</div>;
    }

    if (!isSystemAdmin) {
        return fallback || (
            <div className="text-center py-8">
                <div className="text-red-500 text-6xl mb-4">🔒</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">System Admin Access Required</h3>
                <p className="text-gray-600">This backoffice is restricted to system administrators.</p>
            </div>
        );
    }

    return children;
};