import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';

const Parties = ({ db, userId, isAuthReady, appId }) => {
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

    // Fetch parties data from Firestore
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
            const q = query(partiesCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const parties = [];
                snapshot.forEach((doc) => {
                    parties.push({ id: doc.id, ...doc.data() });
                });
                parties.sort((a, b) => a.firmName.localeCompare(b.firmName));
                setPartiesList(parties);
            }, (error) => {
                console.error("Error fetching parties:", error);
                setMessage("Error fetching parties. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

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

    // Handle adding/updating a party
    const handleSaveParty = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
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
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
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
                timestamp: serverTimestamp()
            };

            if (editingPartyId) {
                const partyRef = doc(db, `artifacts/${appId}/users/${userId}/parties`, editingPartyId);
                await setDoc(partyRef, partyData);
                setMessage("Party updated successfully!");
            } else {
                await addDoc(partiesCollectionRef, partyData);
                setMessage("Party added successfully!");
            }
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

    // Handle deleting a party
    const handleDeleteParty = async (partyId) => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        try {
            const partyRef = doc(db, `artifacts/${appId}/users/${userId}/parties`, partyId);
            await deleteDoc(partyRef);
            setMessage("Party deleted successfully!");
        } catch (error) {
            console.error("Error deleting party:", error);
            setMessage("Error deleting party. Please try again.");
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Parties (Buyers & Sellers)</h2>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-4">{editingPartyId ? 'Edit Party' : 'Add New Party'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                    <label htmlFor="firmName" className="block text-sm font-medium text-gray-700">Party Name</label>
                    <input type="text" id="firmName" value={firmName} onChange={(e) => setFirmName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., ABC Enterprises" required />
                </div>
                <div>
                    <label htmlFor="partyType" className="block text-sm font-medium text-gray-700">Party Type</label>
                    <select id="partyType" value={partyType} onChange={(e) => setPartyType(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        required>
                        <option value="Buyer">Buyer (Customer)</option>
                        <option value="Seller">Seller (Supplier)</option>
                        <option value="Both">Both</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="personName" className="block text-sm font-medium text-gray-700">Contact Person</label>
                    <input type="text" id="personName" value={personName} onChange={(e) => setPersonName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Jane Doe" />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows="2"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Full address" />
                </div>
                <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                    <input type="text" id="city" value={city} onChange={(e) => setCity(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Mumbai" />
                </div>
                <div>
                    <label htmlFor="stateName" className="block text-sm font-medium text-gray-700">State</label>
                    <select
                        id="stateName"
                        value={stateName}
                        onChange={e => setStateName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">-- Select State --</option>
                        {indianStates.map(state => (
                            <option key={state} value={state}>{state}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="pincode" className="block text-sm font-medium text-gray-700">Pincode</label>
                    <input type="text" id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 400001" />
                </div>
                <div>
                    <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="text" id="contact" value={contact} onChange={(e) => setContact(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., +919876543210" />
                    <div className="flex items-center mt-1">
                        <input
                            type="checkbox"
                            id="sameAsWhatsapp"
                            checked={sameAsWhatsapp}
                            onChange={e => setSameAsWhatsapp(e.target.checked)}
                            className="mr-2"
                        />
                        <label htmlFor="sameAsWhatsapp" className="text-sm text-gray-600">Same as WhatsApp</label>
                    </div>
                </div>
                <div>
                    <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">WhatsApp No.</label>
                    <input type="text" id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., +919876543210"
                        disabled={sameAsWhatsapp}
                    />
                </div>
                <div>
                    <label htmlFor="gstin" className="block text-sm font-medium text-gray-700">GSTIN</label>
                    <input type="text" id="gstin" value={gstin} onChange={(e) => setGstin(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 22AAAAA0000A1Z5" />
                </div>
                <div>
                    <label htmlFor="pan" className="block text-sm font-medium text-gray-700">PAN</label>
                    <input type="text" id="pan" value={pan} onChange={(e) => setPan(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., ABCDE1234F" />
                </div>
                <div>
                    <label htmlFor="creditPeriod" className="block text-sm font-medium text-gray-700">Credit Period (Days)</label>
                    <input type="number" id="creditPeriod" value={creditPeriod} onChange={(e) => setCreditPeriod(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0" />
                </div>
                <div>
                    <label htmlFor="creditLimit" className="block text-sm font-medium text-gray-700">Credit Limit (₹)</label>
                    <input type="number" id="creditLimit" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0" />
                </div>
            </div>
            <div className="flex gap-4 mt-4">
                <button onClick={handleSaveParty}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                    {editingPartyId ? 'Update Party' : 'Add Party'}
                </button>
                {editingPartyId && (
                    <button onClick={clearPartyForm}
                        className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        Cancel Edit
                    </button>
                )}
            </div>

            <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">All Parties</h3>
            {partiesList.length === 0 ? (
                <p className="text-gray-600">No parties added yet. Add your first party above!</p>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firm Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Person Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GSTIN</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {partiesList.map((party) => (
                                <tr key={party.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.firmName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.personName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.partyType}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.contact}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.email}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.whatsapp}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.gstin}</td>
                                    <td className="px-4 py-2 text-sm text-gray-800 max-w-xs overflow-hidden text-ellipsis">{party.address}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                                        <button
                                            onClick={() => handleEditParty(party)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteParty(party.id)}
                                            className="text-red-600 hover:text-red-900 font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Parties; 