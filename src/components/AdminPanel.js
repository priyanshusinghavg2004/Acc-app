import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getCompanyInfo, isCompanyAdmin } from '../utils/companyUtils';

const AdminPanel = ({ db, userId, isAuthReady, appId }) => {
    const [companyInfo, setCompanyInfo] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [companyUsers, setCompanyUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('users');
    
    // User management states
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('member');
    const [newUserPermissions, setNewUserPermissions] = useState([]);
    const [showAddUser, setShowAddUser] = useState(false);
    
    // Reference link states
    const [referenceLinks, setReferenceLinks] = useState([]);
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkPermissions, setNewLinkPermissions] = useState([]);
    const [newLinkExpiry, setNewLinkExpiry] = useState('');
    const [showAddLink, setShowAddLink] = useState(false);
    
    // Permission management states
    const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [userPermissions, setUserPermissions] = useState({});
    
    // Owner protection states
    const [showOwnerTransferModal, setShowOwnerTransferModal] = useState(false);
    const [newOwnerEmail, setNewOwnerEmail] = useState('');
    const [transferConfirmation, setTransferConfirmation] = useState('');
    const [transferStep, setTransferStep] = useState(1); // 1: email, 2: phone, 3: final confirmation
    const [phoneNumber, setPhoneNumber] = useState('');
    const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
    const [emailVerificationCode, setEmailVerificationCode] = useState('');
    const [verificationCodesSent, setVerificationCodesSent] = useState(false);
    const [phoneCodeSent, setPhoneCodeSent] = useState(false);
    const [emailCodeSent, setEmailCodeSent] = useState(false);
    const [selectedNewOwner, setSelectedNewOwner] = useState(null);
    
    // Available permissions
    const availablePermissions = [
        { id: 'dashboard', label: 'Dashboard', description: 'Access to main dashboard' },
        { id: 'parties', label: 'Parties', description: 'Manage customers and suppliers' },
        { id: 'items', label: 'Items', description: 'Manage inventory items' },
        { id: 'sales', label: 'Sales', description: 'Create and manage sales' },
        { id: 'purchases', label: 'Purchases', description: 'Create and manage purchases' },
        { id: 'payments', label: 'Payments', description: 'Manage payments and receipts' },
        { id: 'expenses', label: 'Expenses', description: 'Manage expenses and employees' },
        { id: 'reports', label: 'Reports', description: 'View business reports' },
        { id: 'taxes', label: 'Taxes', description: 'Manage tax settings' },
        { id: 'manufacturing', label: 'Manufacturing', description: 'Access manufacturing features' },
        { id: 'settings', label: 'Settings', description: 'Access company settings' },
        { id: 'data_export', label: 'Data Export', description: 'Export company data' },
        { id: 'admin_panel', label: 'Admin Panel', description: 'Access admin panel (super admin only)' }
    ];
    
    // User roles
    const userRoles = [
        { value: 'owner', label: 'Owner', description: 'Full access to everything' },
        { value: 'admin', label: 'Admin', description: 'Manage users and settings' },
        { id: 'manager', label: 'Manager', description: 'Manage business operations' },
        { value: 'member', label: 'Member', description: 'Basic access based on permissions' },
        { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
    ];

    // Load company and user info
    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;
        
        const loadCompanyAndUserInfo = async () => {
            try {
                setLoading(true);
                // Get user document
                const userDoc = await getDocs(collection(db, 'users'));
                let userFound = false;
                userDoc.forEach(doc => {
                    if (doc.id === userId) {
                        const userData = doc.data();
                        setUserInfo(userData);
                        userFound = true;
                        
                        // Load company info if user has company ID
                        if (userData.companyId) {
                            getCompanyInfo(userData.companyId, appId).then(companyData => {
                                setCompanyInfo(companyData);
                            });
                        }
                    }
                });
                
                if (!userFound) {
                    setMessage('User not found');
                }
                setLoading(false);
            } catch (error) {
                console.error('Error loading user/company info:', error);
                setMessage('Error loading company information');
                setLoading(false);
            }
        };
        
        loadCompanyAndUserInfo();
    }, [db, userId, isAuthReady, appId]);

    // Load company users
    useEffect(() => {
        if (!companyInfo?.companyId || !isCompanyAdmin(userInfo)) return;
        
        const loadCompanyUsers = async () => {
            try {
                setLoading(true);
                
                // Get all users in the company
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('companyId', '==', companyInfo.companyId));
                const usersSnapshot = await getDocs(q);
                
                const users = [];
                usersSnapshot.forEach(doc => {
                    users.push({ id: doc.id, ...doc.data() });
                });
                
                setCompanyUsers(users);
                setLoading(false);
            } catch (error) {
                console.error('Error loading company users:', error);
                setMessage('Error loading company users');
                setLoading(false);
            }
        };
        
        loadCompanyUsers();
    }, [companyInfo, userInfo, db, appId]);

    // Load reference links
    useEffect(() => {
        if (!companyInfo?.companyId || !isCompanyAdmin(userInfo)) return;
        
        const loadReferenceLinks = async () => {
            try {
                const linksRef = collection(db, `artifacts/${appId}/companies/${companyInfo.companyId}/referenceLinks`);
                const unsubscribe = onSnapshot(linksRef, (snapshot) => {
                    const links = [];
                    snapshot.forEach(doc => {
                        links.push({ id: doc.id, ...doc.data() });
                    });
                    setReferenceLinks(links);
                });
                
                return () => unsubscribe();
            } catch (error) {
                console.error('Error loading reference links:', error);
            }
        };
        
        loadReferenceLinks();
    }, [companyInfo, userInfo, db, appId]);

    // Show loading while user info is being fetched
    if (loading || !userInfo) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading...</h2>
                    <p className="text-gray-600">Please wait while we load your information.</p>
                </div>
            </div>
        );
    }

    // Check if user is admin
    if (!isCompanyAdmin(userInfo)) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
                    <p className="text-gray-600">You don't have permission to access the admin panel.</p>
                    <p className="text-sm text-gray-500 mt-2">Only company owners and admins can access this feature.</p>
                </div>
            </div>
        );
    }

    // Handle permission toggle
    const handlePermissionToggle = (permissionId) => {
        if (newUserPermissions.includes(permissionId)) {
            setNewUserPermissions(newUserPermissions.filter(p => p !== permissionId));
        } else {
            setNewUserPermissions([...newUserPermissions, permissionId]);
        }
    };

    // Handle link permission toggle
    const handleLinkPermissionToggle = (permissionId) => {
        if (newLinkPermissions.includes(permissionId)) {
            setNewLinkPermissions(newLinkPermissions.filter(p => p !== permissionId));
        } else {
            setNewLinkPermissions([...newLinkPermissions, permissionId]);
        }
    };

    // Add new user
    const handleAddUser = async () => {
        if (!newUserEmail || !newUserName) {
            setMessage('Please fill in all required fields');
            return;
        }

        try {
            const userData = {
                email: newUserEmail,
                name: newUserName,
                role: newUserRole,
                permissions: newUserPermissions,
                companyId: companyInfo.companyId,
                companyRole: newUserRole,
                companyAddedAt: new Date(),
                status: 'pending',
                invitedBy: userId,
                invitedAt: new Date(),
                notificationSent: false
            };

            // Create user document
            const userRef = doc(collection(db, 'users'));
            await setDoc(userRef, userData);

            // Add to company members
            const companyRef = doc(db, `artifacts/${appId}/companies/${companyInfo.companyId}`);
            await updateDoc(companyRef, {
                members: [...(companyInfo.members || []), userRef.id]
            });

            // Create notification for the user
            const notificationData = {
                userId: userRef.id,
                companyId: companyInfo.companyId,
                companyName: companyInfo.companyName,
                type: 'company_invitation',
                title: 'Company Invitation',
                message: `You have been invited to join ${companyInfo.companyName} as ${newUserRole}. Please check your email for login details.`,
                status: 'unread',
                createdAt: new Date(),
                createdBy: userId
            };

            await setDoc(doc(collection(db, 'notifications')), notificationData);

            setMessage('User added successfully! They will receive an invitation email and notification.');
            setNewUserEmail('');
            setNewUserName('');
            setNewUserRole('member');
            setNewUserPermissions([]);
            setShowAddUser(false);
        } catch (error) {
            console.error('Error adding user:', error);
            setMessage('Error adding user. Please try again.');
        }
    };

    // Create reference link
    const handleCreateReferenceLink = async () => {
        if (!newLinkName) {
            setMessage('Please enter a link name');
            return;
        }

        try {
            const linkId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const linkData = {
                id: linkId,
                name: newLinkName,
                permissions: newLinkPermissions,
                companyId: companyInfo.companyId,
                createdBy: userId,
                createdAt: new Date(),
                expiresAt: newLinkExpiry ? new Date(newLinkExpiry) : null,
                isActive: true,
                usageCount: 0
            };

            await setDoc(doc(db, `artifacts/${appId}/companies/${companyInfo.companyId}/referenceLinks`, linkId), linkData);

            setMessage('Reference link created successfully!');
            setNewLinkName('');
            setNewLinkPermissions([]);
            setNewLinkExpiry('');
            setShowAddLink(false);
        } catch (error) {
            console.error('Error creating reference link:', error);
            setMessage('Error creating reference link. Please try again.');
        }
    };

    // Delete reference link
    const handleDeleteLink = async (linkId) => {
        if (window.confirm('Are you sure you want to delete this reference link?')) {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/companies/${companyInfo.companyId}/referenceLinks`, linkId));
                setMessage('Reference link deleted successfully!');
            } catch (error) {
                console.error('Error deleting reference link:', error);
                setMessage('Error deleting reference link. Please try again.');
            }
        }
    };



    // Remove user from company
    const handleRemoveUser = async (userToRemove) => {
        // Check if trying to remove an owner
        if (userToRemove.companyRole === 'owner') {
            setMessage('Cannot remove company owner. Please transfer ownership first.');
            return;
        }

        if (window.confirm(`Are you sure you want to remove ${userToRemove.name || userToRemove.email} from the company?`)) {
            try {
                await updateDoc(doc(db, 'users', userToRemove.id), {
                    companyId: null,
                    companyRole: null,
                    permissions: [],
                    removedAt: new Date(),
                    removedBy: userId
                });

                // Remove from company members
                const updatedMembers = companyInfo.members.filter(memberId => memberId !== userToRemove.id);
                await updateDoc(doc(db, `artifacts/${appId}/companies/${companyInfo.companyId}`), {
                    members: updatedMembers
                });

                setMessage('User removed from company successfully!');
            } catch (error) {
                console.error('Error removing user:', error);
                setMessage('Error removing user. Please try again.');
            }
        }
    };

    // Generate reference link URL
    const generateReferenceUrl = (linkId) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/#/join/${companyInfo.companyId}/${linkId}`;
    };

    // Find new owner and start verification process
    const handleFindNewOwner = async () => {
        if (!newOwnerEmail) {
            setMessage('Please enter new owner email.');
            return;
        }

        try {
            // Find the new owner user
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', newOwnerEmail), where('companyId', '==', companyInfo.companyId));
            const userSnapshot = await getDocs(q);
            
            if (userSnapshot.empty) {
                setMessage('User not found in this company. Please check the email address.');
                return;
            }

            const newOwnerDoc = userSnapshot.docs[0];
            const newOwnerData = newOwnerDoc.data();
            setSelectedNewOwner({ id: newOwnerDoc.id, ...newOwnerData });

            // Move to phone verification step
            setTransferStep(2);
            setMessage('User found. Please enter phone number for verification.');
        } catch (error) {
            console.error('Error finding user:', error);
            setMessage('Error finding user. Please try again.');
        }
    };

    // Send phone verification code
    const handleSendPhoneCode = async () => {
        if (!phoneNumber) {
            setMessage('Please enter phone number.');
            return;
        }

        try {
            // Generate and send phone verification code
            const phoneCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Store verification code in database
            await setDoc(doc(collection(db, 'verificationCodes')), {
                userId: userId,
                type: 'ownership_transfer_phone',
                code: phoneCode,
                phoneNumber: phoneNumber,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                createdAt: new Date()
            });

            setPhoneCodeSent(true);
            setMessage(`Verification code sent to ${phoneNumber}. Please check your phone.`);
        } catch (error) {
            console.error('Error sending phone code:', error);
            setMessage('Error sending verification code. Please try again.');
        }
    };

    // Send email verification code
    const handleSendEmailCode = async () => {
        try {
            // Generate and send email verification code
            const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Store verification code in database
            await setDoc(doc(collection(db, 'verificationCodes')), {
                userId: userId,
                type: 'ownership_transfer_email',
                code: emailCode,
                email: userInfo.email,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                createdAt: new Date()
            });

            setEmailCodeSent(true);
            setMessage(`Verification code sent to ${userInfo.email}. Please check your email.`);
        } catch (error) {
            console.error('Error sending email code:', error);
            setMessage('Error sending verification code. Please try again.');
        }
    };

    // Verify codes and proceed to final confirmation
    const handleVerifyCodes = async () => {
        if (!phoneVerificationCode || !emailVerificationCode) {
            setMessage('Please enter both verification codes.');
            return;
        }

        try {
            // Verify phone code
            const phoneCodesRef = collection(db, 'verificationCodes');
            const phoneQuery = query(
                phoneCodesRef, 
                where('userId', '==', userId),
                where('type', '==', 'ownership_transfer_phone'),
                where('code', '==', phoneVerificationCode)
            );
            const phoneSnapshot = await getDocs(phoneQuery);

            // Verify email code
            const emailQuery = query(
                phoneCodesRef, 
                where('userId', '==', userId),
                where('type', '==', 'ownership_transfer_email'),
                where('code', '==', emailVerificationCode)
            );
            const emailSnapshot = await getDocs(emailQuery);

            if (phoneSnapshot.empty || emailSnapshot.empty) {
                setMessage('Invalid verification codes. Please try again.');
                return;
            }

            // Check if codes are expired
            const phoneCodeData = phoneSnapshot.docs[0].data();
            const emailCodeData = emailSnapshot.docs[0].data();

            if (phoneCodeData.expiresAt.toDate() < new Date() || emailCodeData.expiresAt.toDate() < new Date()) {
                setMessage('Verification codes have expired. Please request new codes.');
                return;
            }

            // Move to final confirmation step
            setTransferStep(3);
            setMessage('Verification successful. Please confirm the transfer.');
        } catch (error) {
            console.error('Error verifying codes:', error);
            setMessage('Error verifying codes. Please try again.');
        }
    };

    // Final ownership transfer
    const handleFinalTransfer = async () => {
        if (transferConfirmation !== 'TRANSFER') {
            setMessage('Please type "TRANSFER" to confirm.');
            return;
        }

        if (!selectedNewOwner) {
            setMessage('No new owner selected.');
            return;
        }

        try {
            // Update new owner to owner role
            await updateDoc(doc(db, 'users', selectedNewOwner.id), {
                companyRole: 'owner',
                updatedAt: new Date(),
                updatedBy: userId
            });

            // Update current user to admin role
            await updateDoc(doc(db, 'users', userId), {
                companyRole: 'admin',
                updatedAt: new Date(),
                updatedBy: userId
            });

            // Update company admin info
            await updateDoc(doc(db, `artifacts/${appId}/companies/${companyInfo.companyId}`), {
                admin: {
                    userId: selectedNewOwner.id,
                    email: selectedNewOwner.email,
                    role: 'owner',
                    addedAt: new Date()
                },
                updatedAt: new Date()
            });

            // Create audit log
            await setDoc(doc(collection(db, 'auditLogs')), {
                action: 'ownership_transfer',
                companyId: companyInfo.companyId,
                fromUserId: userId,
                toUserId: selectedNewOwner.id,
                fromEmail: userInfo.email,
                toEmail: selectedNewOwner.email,
                timestamp: new Date(),
                verifiedByPhone: true,
                verifiedByEmail: true
            });

            setMessage('Ownership transferred successfully!');
            setShowOwnerTransferModal(false);
            resetTransferModal();
            
            // Refresh user data
            window.location.reload();
        } catch (error) {
            console.error('Error transferring ownership:', error);
            setMessage('Error transferring ownership. Please try again.');
        }
    };

    // Reset transfer modal state
    const resetTransferModal = () => {
        setTransferStep(1);
        setNewOwnerEmail('');
        setPhoneNumber('');
        setPhoneVerificationCode('');
        setEmailVerificationCode('');
        setTransferConfirmation('');
        setVerificationCodesSent(false);
        setPhoneCodeSent(false);
        setEmailCodeSent(false);
        setSelectedNewOwner(null);
    };

    // Open permission management modal
    const openPermissionModal = (user) => {
        setSelectedUserForPermissions(user);
        setUserPermissions(user.permissions || []);
        setShowPermissionModal(true);
    };

    // Update user permissions
    const handleUpdateUserPermissions = async () => {
        if (!selectedUserForPermissions) return;

        try {
            await updateDoc(doc(db, 'users', selectedUserForPermissions.id), {
                permissions: userPermissions,
                updatedAt: new Date(),
                updatedBy: userId
            });
            
            setMessage('User permissions updated successfully!');
            setShowPermissionModal(false);
            setSelectedUserForPermissions(null);
            setUserPermissions({});
        } catch (error) {
            console.error('Error updating user permissions:', error);
            setMessage('Error updating user permissions. Please try again.');
        }
    };

    // Toggle permission for selected user
    const toggleUserPermission = (permissionId) => {
        setUserPermissions(prev => {
            if (prev.includes(permissionId)) {
                return prev.filter(p => p !== permissionId);
            } else {
                return [...prev, permissionId];
            }
        });
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
                    <p className="text-gray-600">Manage your company users and permissions</p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-500">Company ID: {companyInfo?.companyId}</div>
                    <div className="text-sm text-gray-500">Role: {userInfo?.companyRole}</div>
                </div>
            </div>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 font-medium text-sm ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    👥 Users ({companyUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab('links')}
                    className={`px-4 py-2 font-medium text-sm ${activeTab === 'links' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    🔗 Reference Links ({referenceLinks.length})
                </button>
                <button
                    onClick={() => setActiveTab('permissions')}
                    className={`px-4 py-2 font-medium text-sm ${activeTab === 'permissions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    🔐 Permissions
                </button>
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Company Users</h3>
                        <button
                            onClick={() => setShowAddUser(!showAddUser)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {showAddUser ? 'Cancel' : '+ Add User'}
                        </button>
                    </div>

                    {/* Add User Form */}
                    {showAddUser && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                            <h4 className="font-semibold mb-3">Add New User</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                                    <input
                                        type="email"
                                        value={newUserEmail}
                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name *</label>
                                    <input
                                        type="text"
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Role</label>
                                    <select
                                        value={newUserRole}
                                        onChange={(e) => setNewUserRole(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {userRoles.map(role => (
                                            <option key={role.value} value={role.value}>{role.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {availablePermissions.map(permission => (
                                        <label key={permission.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={newUserPermissions.includes(permission.id)}
                                                onChange={() => handlePermissionToggle(permission.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm">{permission.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleAddUser}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Add User
                            </button>
                        </div>
                    )}

                    {/* Users List */}
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="text-gray-500">Loading users...</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {companyUsers.map(user => (
                                <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <h4 className="font-semibold text-gray-800">{user.name || user.email}</h4>
                                                <span className={`px-2 py-1 text-xs rounded-full ${
                                                    user.companyRole === 'owner' ? 'bg-purple-100 text-purple-800' :
                                                    user.companyRole === 'admin' ? 'bg-red-100 text-red-800' :
                                                    user.companyRole === 'manager' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {user.companyRole}
                                                </span>
                                                <span className={`px-2 py-1 text-xs rounded-full ${
                                                    user.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {user.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">{user.email}</p>
                                            <p className="text-xs text-gray-500">
                                                Joined: {user.companyAddedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => openPermissionModal(user)}
                                                className="text-blue-600 hover:text-blue-800 text-sm"
                                            >
                                                Permissions
                                            </button>
                                            {user.companyRole === 'owner' ? (
                                                <button
                                                    onClick={() => setShowOwnerTransferModal(true)}
                                                    className="text-orange-600 hover:text-orange-800 text-sm"
                                                >
                                                    Transfer Ownership
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleRemoveUser(user)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Reference Links Tab */}
            {activeTab === 'links' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Reference Links</h3>
                        <button
                            onClick={() => setShowAddLink(!showAddLink)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {showAddLink ? 'Cancel' : '+ Create Link'}
                        </button>
                    </div>

                    {/* Create Link Form */}
                    {showAddLink && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                            <h4 className="font-semibold mb-3">Create Reference Link</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Link Name *</label>
                                    <input
                                        type="text"
                                        value={newLinkName}
                                        onChange={(e) => setNewLinkName(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., Sales Team Invite"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Expiry Date (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        value={newLinkExpiry}
                                        onChange={(e) => setNewLinkExpiry(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions for New Users</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {availablePermissions.map(permission => (
                                        <label key={permission.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={newLinkPermissions.includes(permission.id)}
                                                onChange={() => handleLinkPermissionToggle(permission.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm">{permission.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleCreateReferenceLink}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Create Link
                            </button>
                        </div>
                    )}

                    {/* Links List */}
                    <div className="space-y-4">
                        {referenceLinks.map(link => (
                            <div key={link.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h4 className="font-semibold text-gray-800">{link.name}</h4>
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                link.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {link.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded text-sm font-mono mb-2">
                                            {generateReferenceUrl(link.id)}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Created: {link.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'} | 
                                            Usage: {link.usageCount || 0} times
                                            {link.expiresAt && ` | Expires: ${link.expiresAt.toDate().toLocaleDateString()}`}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Permissions: {link.permissions?.join(', ') || 'None'}
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(generateReferenceUrl(link.id))}
                                            className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLink(link.id)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Permissions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availablePermissions.map(permission => (
                            <div key={permission.id} className="border border-gray-200 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800">{permission.label}</h4>
                                <p className="text-sm text-gray-600">{permission.description}</p>
                                <p className="text-xs text-gray-500 mt-1">ID: {permission.id}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Permission Management Modal */}
            {showPermissionModal && selectedUserForPermissions && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">
                                Manage Permissions - {selectedUserForPermissions.name || selectedUserForPermissions.email}
                            </h3>
                            <button
                                onClick={() => setShowPermissionModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-3">
                                Select permissions for this user. Only selected permissions will be accessible.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {availablePermissions.map(permission => (
                                    <label key={permission.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={userPermissions.includes(permission.id)}
                                            onChange={() => toggleUserPermission(permission.id)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="font-medium text-sm">{permission.label}</div>
                                            <div className="text-xs text-gray-500">{permission.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowPermissionModal(false)}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateUserPermissions}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Update Permissions
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Owner Transfer Modal */}
            {showOwnerTransferModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Transfer Ownership</h3>
                            <button
                                onClick={() => {
                                    setShowOwnerTransferModal(false);
                                    resetTransferModal();
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {/* Step Indicator */}
                        <div className="mb-6">
                            <div className="flex items-center justify-center space-x-4">
                                <div className={`flex items-center ${transferStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${transferStep >= 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
                                        1
                                    </div>
                                    <span className="ml-2 text-sm">Find User</span>
                                </div>
                                <div className={`w-8 h-0.5 ${transferStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                <div className={`flex items-center ${transferStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${transferStep >= 2 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
                                        2
                                    </div>
                                    <span className="ml-2 text-sm">Verify</span>
                                </div>
                                <div className={`w-8 h-0.5 ${transferStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                <div className={`flex items-center ${transferStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${transferStep >= 3 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
                                        3
                                    </div>
                                    <span className="ml-2 text-sm">Confirm</span>
                                </div>
                            </div>
                        </div>

                        {/* Step 1: Find New Owner */}
                        {transferStep === 1 && (
                            <div>
                                <p className="text-sm text-gray-600 mb-4">
                                    Enter the email address of the user you want to transfer ownership to. 
                                    This user must already be a member of your company.
                                </p>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        New Owner Email
                                    </label>
                                    <input
                                        type="email"
                                        value={newOwnerEmail}
                                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="newowner@example.com"
                                    />
                                </div>
                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => {
                                            setShowOwnerTransferModal(false);
                                            resetTransferModal();
                                        }}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleFindNewOwner}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Find User
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Verification */}
                        {transferStep === 2 && selectedNewOwner && (
                            <div>
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        <strong>Transferring to:</strong> {selectedNewOwner.name || selectedNewOwner.email}
                                    </p>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-4">
                                    For security reasons, you must verify your identity using both phone and email verification.
                                </p>

                                {/* Phone Verification */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone Number
                                    </label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="+91 98765 43210"
                                            disabled={phoneCodeSent}
                                        />
                                        <button
                                            onClick={handleSendPhoneCode}
                                            disabled={phoneCodeSent || !phoneNumber}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                        >
                                            {phoneCodeSent ? 'Sent' : 'Send Code'}
                                        </button>
                                    </div>
                                    {phoneCodeSent && (
                                        <input
                                            type="text"
                                            value={phoneVerificationCode}
                                            onChange={(e) => setPhoneVerificationCode(e.target.value)}
                                            className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter 6-digit code"
                                            maxLength="6"
                                        />
                                    )}
                                </div>

                                {/* Email Verification */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email Verification ({userInfo.email})
                                    </label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            value={emailVerificationCode}
                                            onChange={(e) => setEmailVerificationCode(e.target.value)}
                                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter 6-digit code"
                                            maxLength="6"
                                            disabled={!emailCodeSent}
                                        />
                                        <button
                                            onClick={handleSendEmailCode}
                                            disabled={emailCodeSent}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                        >
                                            {emailCodeSent ? 'Sent' : 'Send Code'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => {
                                            setShowOwnerTransferModal(false);
                                            resetTransferModal();
                                        }}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleVerifyCodes}
                                        disabled={!phoneVerificationCode || !emailVerificationCode}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        Verify & Continue
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Final Confirmation */}
                        {transferStep === 3 && selectedNewOwner && (
                            <div>
                                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <h4 className="font-semibold text-red-800 mb-2">⚠️ Final Warning</h4>
                                    <p className="text-sm text-red-700 mb-2">
                                        You are about to transfer ownership of <strong>{companyInfo.companyName}</strong> to:
                                    </p>
                                    <p className="text-sm text-red-700 font-medium">
                                        {selectedNewOwner.name || selectedNewOwner.email}
                                    </p>
                                    <p className="text-sm text-red-700 mt-2">
                                        This action cannot be undone. You will become an admin and lose owner privileges.
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type "TRANSFER" to confirm
                                    </label>
                                    <input
                                        type="text"
                                        value={transferConfirmation}
                                        onChange={(e) => setTransferConfirmation(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="TRANSFER"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => {
                                            setShowOwnerTransferModal(false);
                                            resetTransferModal();
                                        }}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleFinalTransfer}
                                        disabled={transferConfirmation !== 'TRANSFER'}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        Transfer Ownership
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel; 