import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// Indian PAN validation regex (5 letters + 4 digits + 1 letter)
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const CompanyDetails = ({ db, userId, isAuthReady, setActiveModule, appId }) => {
    const [firmName, setFirmName] = useState('');
    const [gstin, setGstin] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [email, setEmail] = useState('');
    const [pan, setPan] = useState('');
    const [gstinType, setGstinType] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [bankIfsc, setBankIfsc] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [signUrl, setSignUrl] = useState('');
    const [sealUrl, setSealUrl] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (db && userId && isAuthReady) {
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFirmName(data.firmName || '');
                    setGstin(data.gstin || '');
                    setAddress(data.address || '');
                    setCity(data.city || '');
                    setState(data.state || '');
                    setPincode(data.pincode || '');
                    setContactNumber(data.contactNumber || '');
                    setEmail(data.email || '');
                    setPan(data.pan || '');
                    setGstinType(data.gstinType || '');
                    setBankName(data.bankName || '');
                    setBankAccount(data.bankAccount || '');
                    setBankIfsc(data.bankIfsc || '');
                    setLogoUrl(data.logoUrl || '');
                    setSignUrl(data.signUrl || '');
                    setSealUrl(data.sealUrl || '');
                } else {
                    setFirmName(''); setGstin(''); setAddress(''); setCity(''); setState(''); setPincode(''); setContactNumber(''); setEmail(''); setPan(''); setGstinType(''); setBankName(''); setBankAccount(''); setBankIfsc(''); setLogoUrl(''); setSignUrl(''); setSealUrl('');
                }
            }, (error) => {
                console.error("Error fetching company details:", error);
                setMessage("Error fetching company details.");
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    const handleImageChange = (e, setter) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setter(url);
            // In production, upload to storage and save the download URL to Firestore
        }
    };

    const handleSaveCompanyDetails = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        if (!firmName || !gstin) {
            setMessage("Firm Name and GSTIN are required.");
            return;
        }
        // Validate PAN if entered
        if (pan && !panRegex.test(pan.toUpperCase())) {
            setMessage("Invalid PAN. Please enter a valid 10-character PAN as per Indian law (e.g., ABCDE1234F).");
            return;
        }
        try {
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            await setDoc(companyDocRef, {
                firmName,
                gstin,
                address,
                city,
                state,
                pincode,
                contactNumber,
                email,
                pan: pan.toUpperCase(), // Convert to uppercase for consistency
                gstinType,
                bankName,
                bankAccount,
                bankIfsc,
                logoUrl,
                signUrl,
                sealUrl,
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
                    <label htmlFor="companyFirmName" className="block text-sm font-medium text-gray-700">Company Name</label>
                    <input type="text" id="companyFirmName" value={firmName} onChange={(e) => setFirmName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Your Printing Business Name" required />
                </div>
                <div>
                    <label htmlFor="companyGstin" className="block text-sm font-medium text-gray-700">GSTIN</label>
                    <input type="text" id="companyGstin" value={gstin} onChange={(e) => setGstin(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 22ABCDE1234F1Z5" required />
                </div>
                <div>
                    <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700">Address</label>
                    <input type="text" id="companyAddress" value={address} onChange={(e) => setAddress(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Your Full Address, Street 1..." />
                </div>
                <div>
                    <label htmlFor="companyCity" className="block text-sm font-medium text-gray-700">City</label>
                    <input type="text" id="companyCity" value={city} onChange={e => setCity(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Durg" />
                </div>
                <div>
                    <label htmlFor="companyState" className="block text-sm font-medium text-gray-700">State</label>
                    <select id="companyState" value={state} onChange={e => setState(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">Select State</option>
                        {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="companyPincode" className="block text-sm font-medium text-gray-700">Pincode</label>
                    <input type="text" id="companyPincode" value={pincode} onChange={e => setPincode(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 490001" />
                </div>
                <div>
                    <label htmlFor="companyContactNumber" className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="text" id="companyContactNumber" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., +91-9876543210" />
                </div>
                <div>
                    <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" id="companyEmail" value={email} onChange={e => setEmail(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., info@yourprinting.com" />
                </div>
                <div>
                    <label htmlFor="companyPan" className="block text-sm font-medium text-gray-700">PAN</label>
                    <input type="text" id="companyPan" value={pan} onChange={e => setPan(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., ABCDE1234F" />
                </div>
                <div>
                    <label htmlFor="companyGstinType" className="block text-sm font-medium text-gray-700">GST Type</label>
                    <select id="companyGstinType" value={gstinType} onChange={e => setGstinType(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Select Type --</option>
                        <option value="Regular">Regular</option>
                        <option value="Composition">Composition</option>
                        <option value="Unregistered">Unregistered</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="companyBankName" className="block text-sm font-medium text-gray-700">Bank Name</label>
                    <input type="text" id="companyBankName" value={bankName} onChange={e => setBankName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., State Bank of India" />
                </div>
                <div>
                    <label htmlFor="companyBankAccount" className="block text-sm font-medium text-gray-700">Bank Account No.</label>
                    <input type="text" id="companyBankAccount" value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 123456789012" />
                </div>
                <div>
                    <label htmlFor="companyBankIfsc" className="block text-sm font-medium text-gray-700">Bank IFSC Code</label>
                    <input type="text" id="companyBankIfsc" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., SBIN0000001" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Logo (Image)</label>
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setLogoUrl)} />
                    {logoUrl && <img src={logoUrl} alt="Logo Preview" className="mt-2 h-16" />}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Sign (Image)</label>
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setSignUrl)} />
                    {signUrl && <img src={signUrl} alt="Sign Preview" className="mt-2 h-16" />}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Seal (Image)</label>
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setSealUrl)} />
                    {sealUrl && <img src={sealUrl} alt="Seal Preview" className="mt-2 h-16" />}
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
                <p className="text-gray-700"><strong>Company Name:</strong> {firmName || 'N/A'}</p>
                <p className="text-gray-700"><strong>GSTIN:</strong> {gstin || 'N/A'}</p>
                <p className="text-gray-700"><strong>Address:</strong> {address || 'N/A'}</p>
                <p className="text-gray-700"><strong>City:</strong> {city || 'N/A'}</p>
                <p className="text-gray-700"><strong>State:</strong> {state || 'N/A'}</p>
                <p className="text-gray-700"><strong>Pincode:</strong> {pincode || 'N/A'}</p>
                <p className="text-gray-700"><strong>Phone:</strong> {contactNumber || 'N/A'}</p>
                <p className="text-gray-700"><strong>Email:</strong> {email || 'N/A'}</p>
                <p className="text-gray-700"><strong>PAN:</strong> {pan || 'N/A'}</p>
                <p className="text-gray-700"><strong>GST Type:</strong> {gstinType || 'N/A'}</p>
                <p className="text-gray-700"><strong>Bank Name:</strong> {bankName || 'N/A'}</p>
                <p className="text-gray-700"><strong>Bank Account No.:</strong> {bankAccount || 'N/A'}</p>
                <p className="text-gray-700"><strong>Bank IFSC Code:</strong> {bankIfsc || 'N/A'}</p>
                <p className="text-gray-700"><strong>Logo:</strong> {logoUrl && <img src={logoUrl} alt="Logo" className="inline h-8 align-middle" />}</p>
                <p className="text-gray-700"><strong>Sign:</strong> {signUrl && <img src={signUrl} alt="Sign" className="inline h-8 align-middle" />}</p>
                <p className="text-gray-700"><strong>Seal:</strong> {sealUrl && <img src={sealUrl} alt="Seal" className="inline h-8 align-middle" />}</p>
            </div>
        </div>
    );
};

export default CompanyDetails; 