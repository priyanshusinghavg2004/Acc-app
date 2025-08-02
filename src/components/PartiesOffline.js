import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../utils/tableSort';
import { useTablePagination } from '../utils/tablePagination';
import PaginationControls from '../utils/PaginationControls';
import { useNetworkStatus } from '../utils/networkStatus';
import offlineStorage from '../utils/offlineStorage';
import offlineSync from '../utils/offlineSync';

const PartiesOffline = ({ db, userId, isAuthReady, appId }) => {
    const [firmName, setFirmName] = useState('');
    const [personName, setPersonName] = useState('');
    const [address, setAddress] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [gstin, setGstin] = useState('');
    const [partyType, setPartyType] = useState('Buyer');
    const [message, setMessage] = useState('');
    const [partiesList, setPartiesList] = useState([]);
    const [editingPartyId, setEditingPartyId] = useState(null);
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [pincode, setPincode] = useState('');
    const [pan, setPan] = useState('');
    const [creditPeriod, setCreditPeriod] = useState('0');
    const [creditLimit, setCreditLimit] = useState('0');
    const [sameAsWhatsapp, setSameAsWhatsapp] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0 });

    // Network status
    const { isOnline } = useNetworkStatus();

    // Table sorting hook with default sort by creation date descending (LIFO)
    const { sortConfig, handleSort, getSortedData } = useTableSort([], { key: 'createdAt', direction: 'desc' });
    
    // Table pagination hook
    const sortedParties = getSortedData(partiesList);
    const pagination = useTablePagination(sortedParties, 10);

    const indianStates = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
        'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
        'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
        'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
        'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    // GSTIN validation regex (Indian GSTIN format)
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/;
    // Indian phone number validation (10 digits, starts with 6-9)
    const phoneRegex = /^[6-9][0-9]{9}$/;
    // Indian PAN validation regex (5 letters + 4 digits + 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    // Load data from both Firebase and offline storage
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                let parties = [];

                if (isOnline && db && userId && isAuthReady) {
                    // Try to load from Firebase first
                    try {
                        const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
                        const q = query(partiesCollectionRef);
                        const snapshot = await getDocs(q);
                        parties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        
                        // Store in offline storage
                        for (const party of parties) {
                            await offlineStorage.update('parties', party);
                        }
                    } catch (error) {
                        console.error("Error loading from Firebase:", error);
                    }
                }

                // Always load from offline storage as fallback
                const offlineParties = await offlineStorage.getAll('parties');
                if (offlineParties.length > 0) {
                    parties = offlineParties;
                }

                setPartiesList(parties);
            } catch (error) {
                console.error("Error loading parties:", error);
                setMessage("Error loading parties. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [db, userId, isAuthReady, appId, isOnline]);

    // Update sync status
    useEffect(() => {
        const updateSyncStatus = async () => {
            try {
                const status = await offlineSync.getSyncStatus();
                setSyncStatus(status);
            } catch (error) {
                console.error('Error updating sync status:', error);
            }
        };

        updateSyncStatus();
        const interval = setInterval(updateSyncStatus, 10000); // Update every 10 seconds
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (sameAsWhatsapp) {
            setWhatsapp(contact);
        }
    }, [contact, sameAsWhatsapp]);

    // Function to clear party form fields
    const clearPartyForm = () => {
        setFirmName('');
        setPersonName('');
        setAddress('');
        setCity('');
        setStateName('');
        setPincode('');
        setContact('');
        setEmail('');
        setWhatsapp('');
        setGstin('');
        setPan('');
        setCreditPeriod('0');
        setCreditLimit('0');
        setPartyType('Buyer');
        setEditingPartyId(null);
        setMessage('');
        setSameAsWhatsapp(false);
    };

    // Handle adding/updating a party with offline support
    const handleSaveParty = async () => {
        if (!firmName || !partyType) {
            setMessage("Firm Name and Party Type are required.");
            return;
        }

        // Validate GSTIN if entered
        if (gstin && !gstinRegex.test(gstin)) {
            setMessage("Invalid GSTIN. Please enter a valid 15-character GSTIN as per Indian law.");
            return;
        }

        // Validate PAN if entered
        if (pan && !panRegex.test(pan.toUpperCase())) {
            setMessage("Invalid PAN. Please enter a valid 10-character PAN as per Indian law (e.g., ABCDE1234F).");
            return;
        }

        // Validate phone number
        if (contact && !phoneRegex.test(contact)) {
            setMessage("Invalid Phone number. Please enter a valid 10-digit Indian mobile number starting with 6-9.");
            return;
        }

        // Check for duplicate GSTIN or Contact (ignore current editing party)
        const duplicateGstin = partiesList.find(p => p.gstin && gstin && p.gstin === gstin && p.id !== editingPartyId);
        if (duplicateGstin) {
            setMessage("A party with this GSTIN already exists.");
            return;
        }

        const duplicateContact = partiesList.find(p => p.contact && contact && p.contact === contact && p.id !== editingPartyId);
        if (duplicateContact) {
            setMessage("A party with this Contact number already exists.");
            return;
        }

        try {
            const partyData = {
                firmName,
                personName,
                address,
                city,
                state: stateName,
                pincode,
                contact,
                email,
                whatsapp,
                gstin,
                pan,
                creditPeriod: parseInt(creditPeriod) || 0,
                creditLimit: parseFloat(creditLimit) || 0,
                partyType,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (editingPartyId) {
                // Update existing party
                partyData.id = editingPartyId;
                partyData.updatedAt = new Date().toISOString();

                // Save to offline storage immediately
                await offlineStorage.update('parties', partyData);

                // Try to sync with Firebase if online
                if (isOnline && db && userId) {
                    try {
                        const partyRef = doc(db, `artifacts/${appId}/users/${userId}/parties`, editingPartyId);
                        await setDoc(partyRef, partyData);
                        setMessage("Party updated successfully!");
                    } catch (error) {
                        console.error("Error syncing to Firebase:", error);
                        // Add to sync queue for later
                        await offlineSync.addToSyncQueue({
                            type: 'update',
                            storeName: 'parties',
                            data: partyData,
                            userId,
                            appId
                        });
                        setMessage("Party updated locally. Will sync when online.");
                    }
                } else {
                    // Add to sync queue for later
                    await offlineSync.addToSyncQueue({
                        type: 'update',
                        storeName: 'parties',
                        data: partyData,
                        userId,
                        appId
                    });
                    setMessage("Party updated locally. Will sync when online.");
                }
            } else {
                // Add new party
                const newId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                partyData.id = newId;

                // Save to offline storage immediately
                await offlineStorage.add('parties', partyData);

                // Try to sync with Firebase if online
                if (isOnline && db && userId) {
                    try {
                        const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
                        const docRef = await addDoc(partiesCollectionRef, partyData);
                        
                        // Update local storage with Firebase ID
                        partyData.id = docRef.id;
                        await offlineStorage.update('parties', partyData);
                        
                        setMessage("Party added successfully!");
                    } catch (error) {
                        console.error("Error syncing to Firebase:", error);
                        // Add to sync queue for later
                        await offlineSync.addToSyncQueue({
                            type: 'add',
                            storeName: 'parties',
                            data: partyData,
                            userId,
                            appId
                        });
                        setMessage("Party added locally. Will sync when online.");
                    }
                } else {
                    // Add to sync queue for later
                    await offlineSync.addToSyncQueue({
                        type: 'add',
                        storeName: 'parties',
                        data: partyData,
                        userId,
                        appId
                    });
                    setMessage("Party added locally. Will sync when online.");
                }
            }

            // Update local state
            const updatedParties = editingPartyId 
                ? partiesList.map(p => p.id === editingPartyId ? partyData : p)
                : [...partiesList, partyData];
            setPartiesList(updatedParties);

            clearPartyForm();
        } catch (error) {
            console.error("Error saving party:", error);
            setMessage("Error saving party. Please try again.");
        }
    };

    // Handle editing a party
    const handleEditParty = (party) => {
        setEditingPartyId(party.id);
        setFirmName(party.firmName);
        setPersonName(party.personName);
        setAddress(party.address);
        setCity(party.city || '');
        setStateName(party.state || '');
        setPincode(party.pincode || '');
        setContact(party.contact);
        setEmail(party.email);
        setWhatsapp(party.whatsapp);
        setGstin(party.gstin);
        setPan(party.pan || '');
        setCreditPeriod(party.creditPeriod?.toString() || '0');
        setCreditLimit(party.creditLimit?.toString() || '0');
        setPartyType(party.partyType);
        setMessage('Editing existing party.');
        setSameAsWhatsapp(party.whatsapp === party.contact);
    };

    // Handle deleting a party with offline support
    const handleDeleteParty = async (partyId) => {
        try {
            // Remove from offline storage immediately
            await offlineStorage.delete('parties', partyId);

            // Try to sync with Firebase if online
            if (isOnline && db && userId) {
                try {
                    const partyRef = doc(db, `artifacts/${appId}/users/${userId}/parties`, partyId);
                    await deleteDoc(partyRef);
                    setMessage("Party deleted successfully!");
                } catch (error) {
                    console.error("Error syncing delete to Firebase:", error);
                    // Add to sync queue for later
                    await offlineSync.addToSyncQueue({
                        type: 'delete',
                        storeName: 'parties',
                        data: { id: partyId },
                        userId,
                        appId
                    });
                    setMessage("Party deleted locally. Will sync when online.");
                }
            } else {
                // Add to sync queue for later
                await offlineSync.addToSyncQueue({
                    type: 'delete',
                    storeName: 'parties',
                    data: { id: partyId },
                    userId,
                    appId
                });
                setMessage("Party deleted locally. Will sync when online.");
            }

            // Update local state
            setPartiesList(partiesList.filter(p => p.id !== partyId));
        } catch (error) {
            console.error("Error deleting party:", error);
            setMessage("Error deleting party. Please try again.");
        }
    };

    // Manual sync function
    const handleManualSync = async () => {
        if (!isOnline) {
            setMessage("Cannot sync while offline.");
            return;
        }

        try {
            setMessage("Syncing data...");
            await offlineSync.syncAllData(userId, appId);
            setMessage("Sync completed successfully!");
        } catch (error) {
            console.error("Error during manual sync:", error);
            setMessage("Error during sync. Please try again.");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Parties Management</h1>
                <p className="text-gray-600">Manage your business contacts and parties</p>
                
                {/* Offline Status Indicator */}
                <div className="mt-4 flex items-center space-x-4">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                        isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    
                    {(syncStatus.pending > 0 || syncStatus.failed > 0) && (
                        <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                            <span>📊 {syncStatus.pending} pending, {syncStatus.failed} failed</span>
                        </div>
                    )}
                    
                    {isOnline && (syncStatus.pending > 0 || syncStatus.failed > 0) && (
                        <button
                            onClick={handleManualSync}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                            Sync Now
                        </button>
                    )}
                </div>
            </div>

            {/* Message Display */}
            {message && (
                <div className={`mb-4 p-4 rounded-lg ${
                    message.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                    {message}
                </div>
            )}

            {/* Party Form */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">
                    {editingPartyId ? 'Edit Party' : 'Add New Party'}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Firm Name *
                        </label>
                        <input
                            type="text"
                            value={firmName}
                            onChange={(e) => setFirmName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter firm name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Party Type *
                        </label>
                        <select
                            value={partyType}
                            onChange={(e) => setPartyType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="Buyer">Buyer</option>
                            <option value="Seller">Seller</option>
                            <option value="Both">Both</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Person
                        </label>
                        <input
                            type="text"
                            value={personName}
                            onChange={(e) => setPersonName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Contact person name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Number
                        </label>
                        <input
                            type="tel"
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="10-digit mobile number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Email address"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            WhatsApp
                        </label>
                        <input
                            type="tel"
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="WhatsApp number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            GSTIN
                        </label>
                        <input
                            type="text"
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="15-character GSTIN"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            PAN
                        </label>
                        <input
                            type="text"
                            value={pan}
                            onChange={(e) => setPan(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="10-character PAN"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address
                        </label>
                        <textarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Complete address"
                            rows="2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            City
                        </label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="City"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            State
                        </label>
                        <select
                            value={stateName}
                            onChange={(e) => setStateName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select State</option>
                            {indianStates.map((state) => (
                                <option key={state} value={state}>
                                    {state}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pincode
                        </label>
                        <input
                            type="text"
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="6-digit pincode"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Credit Period (days)
                        </label>
                        <input
                            type="number"
                            value={creditPeriod}
                            onChange={(e) => setCreditPeriod(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            min="0"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Credit Limit (₹)
                        </label>
                        <input
                            type="number"
                            value={creditLimit}
                            onChange={(e) => setCreditLimit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            min="0"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={sameAsWhatsapp}
                            onChange={(e) => setSameAsWhatsapp(e.target.checked)}
                            className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Same as Contact Number</span>
                    </label>
                </div>

                <div className="mt-6 flex space-x-4">
                    <button
                        onClick={handleSaveParty}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {editingPartyId ? 'Update Party' : 'Add Party'}
                    </button>
                    {editingPartyId && (
                        <button
                            onClick={clearPartyForm}
                            className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Parties List */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Parties List ({partiesList.length})
                    </h2>
                </div>

                {partiesList.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                        No parties found. Add your first party above.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <SortableHeader
                                            sortKey="firmName"
                                            sortConfig={sortConfig}
                                            onSort={handleSort}
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                            Firm Name
                                        </SortableHeader>
                                        <SortableHeader
                                            sortKey="partyType"
                                            sortConfig={sortConfig}
                                            onSort={handleSort}
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                            Type
                                        </SortableHeader>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Contact
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            GSTIN
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Address
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pagination.currentItems.map((party) => (
                                        <tr key={party.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {party.firmName}
                                                    </div>
                                                    {party.personName && (
                                                        <div className="text-sm text-gray-500">
                                                            {party.personName}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    party.partyType === 'Buyer' ? 'bg-blue-100 text-blue-800' :
                                                    party.partyType === 'Seller' ? 'bg-green-100 text-green-800' :
                                                    'bg-purple-100 text-purple-800'
                                                }`}>
                                                    {party.partyType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    {party.contact && (
                                                        <div className="text-sm text-gray-900">{party.contact}</div>
                                                    )}
                                                    {party.email && (
                                                        <div className="text-sm text-gray-500">{party.email}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {party.gstin || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {party.address && (
                                                        <div>{party.address}</div>
                                                    )}
                                                    {(party.city || party.state) && (
                                                        <div className="text-gray-500">
                                                            {[party.city, party.state].filter(Boolean).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => handleEditParty(party)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteParty(party.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <PaginationControls pagination={pagination} />
                    </>
                )}
            </div>
        </div>
    );
};

export default PartiesOffline; 