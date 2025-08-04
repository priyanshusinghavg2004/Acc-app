import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase.config';

export const usePermissions = (db, userId) => {
    const [userPermissions, setUserPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        if (!db || !userId) {
            setLoading(false);
            return;
        }

        const loadUserPermissions = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserPermissions(userData.permissions || []);
                    setUserRole(userData.companyRole);
                }
                setLoading(false);
            } catch (error) {
                console.error('Error loading user permissions:', error);
                setLoading(false);
            }
        };

        loadUserPermissions();
    }, [db, userId]);

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

    return {
        userPermissions,
        userRole,
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
    const { hasPermission, loading } = usePermissions(permission);

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