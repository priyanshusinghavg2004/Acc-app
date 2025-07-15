import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const CompanyDetails = ({ db, userId, isAuthReady, setActiveModule, appId }) => {
    const [firmName, setFirmName] = useState('');
    const [gstin, setGstin] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [address, setAddress] = useState('');
    const [gstinType, setGstinType] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (db && userId && isAuthReady) {
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFirmName(data.firmName || '');
                    setGstin(data.gstin || '');
                    setContactNumber(data.contactNumber || '');
                    setAddress(data.address || '');
                    setGstinType(data.gstinType || '');
                } else {
                    setFirmName('');
                    setGstin('');
                    setContactNumber('');
                    setAddress('');
                    setGstinType('');
                }
            }, (error) => {
                console.error("Error fetching company details:", error);
                setMessage("Error fetching company details.");
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    const handleSaveCompanyDetails = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        if (!firmName || !gstin) {
            setMessage("Firm Name and GSTIN are required.");
            return;
        }

        try {
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            await setDoc(companyDocRef, {
                firmName,
                gstin,
                contactNumber,
                address,
                gstinType,
                timestamp: serverTimestamp()
            }, { merge: true });
            setMessage("Company details saved successfully!");
        } catch (error) {
            console.error("Error saving company details:", error);
            setMessage("Error saving company details. Please try again.");
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Company Details</h2>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label htmlFor="companyFirmName" className="block text-sm font-medium text-gray-700">Company Firm Name</label>
                    <input type="text" id="companyFirmName" value={firmName} onChange={(e) => setFirmName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Your Business Name" required />
                </div>
                <div>
                    <label htmlFor="companyGstin" className="block text-sm font-medium text-gray-700">Company GSTIN</label>
                    <input type="text" id="companyGstin" value={gstin} onChange={(e) => setGstin(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 22AAAAA0000A1Z5" required />
                </div>
                <div>
                    <label htmlFor="companyContactNumber" className="block text-sm font-medium text-gray-700">Contact Number</label>
                    <input type="text" id="companyContactNumber" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., +919876543210" />
                </div>
                <div>
                    <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea id="companyAddress" value={address} onChange={(e) => setAddress(e.target.value)} rows="2"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Full company address" />
                </div>
                <div>
                    <label htmlFor="companyGstinType" className="block text-sm font-medium text-gray-700">GSTIN Type</label>
                    <select id="companyGstinType" value={gstinType} onChange={(e) => setGstinType(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Select Type --</option>
                        <option value="Regular">Regular</option>
                        <option value="Composition">Composition</option>
                        <option value="Unregistered">Unregistered</option>
                    </select>
                </div>
            </div>
            <div className="flex gap-4 mt-4">
                <button onClick={handleSaveCompanyDetails}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                    Save Company Details
                </button>
                <button onClick={() => setActiveModule('taxes')}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                    Taxes and Payment Details
                </button>
            </div>

            <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">Current Company Details</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-700"><strong>Firm Name:</strong> {firmName || 'N/A'}</p>
                <p className="text-700"><strong>GSTIN:</strong> {gstin || 'N/A'}</p>
                <p className="text-gray-700"><strong>GSTIN Type:</strong> {gstinType || 'N/A'}</p>
                <p className="text-gray-700"><strong>Contact Number:</strong> {contactNumber || 'N/A'}</p>
                <p className="text-gray-700"><strong>Address:</strong> {address || 'N/A'}</p>
            </div>
        </div>
    );
};

export default CompanyDetails; 