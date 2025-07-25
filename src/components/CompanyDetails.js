import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import imageCompression from 'browser-image-compression';

const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// Indian PAN validation regex (5 letters + 4 digits + 1 letter)
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const stateCodeMap = {
    'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10', 'Chhattisgarh': '22',
    'Goa': '30', 'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02', 'Jharkhand': '20',
    'Karnataka': '29', 'Kerala': '32', 'Madhya Pradesh': '23', 'Maharashtra': '27', 'Manipur': '14',
    'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21', 'Punjab': '03',
    'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36', 'Tripura': '16',
    'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
    'Andaman and Nicobar Islands': '35', 'Chandigarh': '04', 'Dadra and Nagar Haveli and Daman and Diu': '26',
    'Delhi': '07', 'Jammu and Kashmir': '01', 'Ladakh': '38', 'Lakshadweep': '31', 'Puducherry': '34'
};

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
    const [gstinTypeWarning, setGstinTypeWarning] = useState('');
    const [gstinStateError, setGstinStateError] = useState('');
    const prevGstinType = useRef('');
    const [bankName, setBankName] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [bankIfsc, setBankIfsc] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [signUrl, setSignUrl] = useState('');
    const [sealUrl, setSealUrl] = useState('');
    const [message, setMessage] = useState('');
    const [logoPreview, setLogoPreview] = useState('');
    const [signPreview, setSignPreview] = useState('');
    const [sealPreview, setSealPreview] = useState('');
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoProgress, setLogoProgress] = useState(0);
    const [signUploading, setSignUploading] = useState(false);
    const [signProgress, setSignProgress] = useState(0);
    const [sealUploading, setSealUploading] = useState(false);
    const [sealProgress, setSealProgress] = useState(0);
    // Add new state variables
    const [upiId, setUpiId] = useState('');
    const [upiQrUrl, setUpiQrUrl] = useState('');
    const [upiQrPreview, setUpiQrPreview] = useState('');
    const [upiQrUploading, setUpiQrUploading] = useState(false);
    const [upiQrProgress, setUpiQrProgress] = useState(0);
    const [paymentGatewayLink, setPaymentGatewayLink] = useState('');
    // Add state at the top:
    const [salesTerms, setSalesTerms] = useState('');
    const [purchaseTerms, setPurchaseTerms] = useState('');
    const [footer, setFooter] = useState('');
    const [quotationTerms, setQuotationTerms] = useState('');

    useEffect(() => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
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
                    setUpiId(data.upiId || '');
                    setUpiQrUrl(data.upiQrUrl || '');
                    setPaymentGatewayLink(data.paymentGatewayLink || '');
                    setSalesTerms(data.salesTerms || data.terms || '');
                    setPurchaseTerms(data.purchaseTerms || '');
                    setFooter(data.footer || '');
                    setQuotationTerms(data.quotationTerms || '');
                } else {
                    setFirmName(''); setGstin(''); setAddress(''); setCity(''); setState(''); setPincode(''); setContactNumber(''); setEmail(''); setPan(''); setGstinType(''); setBankName(''); setBankAccount(''); setBankIfsc(''); setLogoUrl(''); setSignUrl(''); setSealUrl(''); setUpiId(''); setUpiQrUrl(''); setPaymentGatewayLink(''); setSalesTerms(''); setPurchaseTerms(''); setFooter(''); setQuotationTerms('');
                }
            }, (error) => {
                console.error("Error fetching company details:", error);
                setMessage("Error fetching company details.");
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    useEffect(() => {
        prevGstinType.current = gstinType;
    }, []);

    const handleGstinTypeChange = (e) => {
        const newType = e.target.value;
        if (prevGstinType.current && prevGstinType.current !== newType) {
            setGstinTypeWarning('Warning: Changing GST Type will affect all future invoices and billing logic.');
        } else {
            setGstinTypeWarning('');
        }
        setGstinType(newType);
        prevGstinType.current = newType;
    };

    const validateGstinState = (gstin, state) => {
        if (!gstin || !state) return '';
        const code = gstin.substring(0, 2);
        const expectedCode = stateCodeMap[state];
        if (expectedCode && code !== expectedCode) {
            return `GSTIN state code (${code}) does not match selected state (${state}, code ${expectedCode}).`;
        }
        return '';
    };

    useEffect(() => {
        if (gstinType === 'Regular' || gstinType === 'Composition') {
            setGstinStateError(validateGstinState(gstin, state));
        } else {
            setGstinStateError('');
        }
    }, [gstin, state, gstinType]);

    // REPLACE handleImageChange with Firebase upload logic
    const handleImageChange = async (e, setter, type, previewSetter, setUploading, setProgress) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { // 3 MB
            setMessage('File size must be less than 3 MB.');
            return;
        }
        setUploading(true);
        setProgress(0);
        try {
            // Compress and resize image
            const options = {
                maxSizeMB: 0.08, // 80KB
                maxWidthOrHeight: 200, // px
                useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);
            // Show preview from compressed file
            const previewUrl = URL.createObjectURL(compressedFile);
            previewSetter(previewUrl);
            // Upload compressed file to Firebase Storage
            const storage = getStorage();
            const storageRef = ref(storage, `companyAssets/${userId}/${type}_${Date.now()}`);
            const uploadTask = uploadBytesResumable(storageRef, compressedFile);
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(Math.round(progress));
                },
                (error) => {
                    setMessage('Image upload failed. Please try again.');
                    setUploading(false);
                    setProgress(0);
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                        setter(url);
                        setUploading(false);
                        setProgress(0);
                    });
                }
            );
        } catch (error) {
            setMessage('Image upload failed. Please try again.');
            setUploading(false);
            setProgress(0);
        }
    };

    // Add remove handlers for logo, sign, seal
    const handleRemoveLogo = () => { setLogoUrl(''); setLogoPreview(''); };
    const handleRemoveSign = () => { setSignUrl(''); setSignPreview(''); };
    const handleRemoveSeal = () => { setSealUrl(''); setSealPreview(''); };

    const handleSaveCompanyDetails = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        if (!firmName) {
            setMessage("Firm Name is required.");
            return;
        }
        if ((gstinType === 'Regular' || gstinType === 'Composition') && !gstin) {
            setMessage("GSTIN is required for Regular and Composition GST types.");
            return;
        }
        if (gstinStateError) {
            setMessage(gstinStateError);
            return;
        }
        if (pan && !panRegex.test(pan.toUpperCase())) {
            setMessage("Invalid PAN. Please enter a valid 10-character PAN as per Indian law (e.g., ABCDE1234F).");
            return;
        }
        try {
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            await setDoc(companyDocRef, {
                firmName,
                gstin: (gstinType === 'Regular' || gstinType === 'Composition') ? gstin : '',
                address,
                city,
                state,
                pincode,
                contactNumber,
                email,
                pan: pan.toUpperCase(),
                gstinType,
                bankName,
                bankAccount,
                bankIfsc,
                logoUrl,
                signUrl,
                sealUrl,
                upiId,
                upiQrUrl,
                paymentGatewayLink,
                salesTerms,
                purchaseTerms,
                footer,
                quotationTerms,
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
                    <label htmlFor="companyGstinType" className="block text-sm font-medium text-gray-700">GST Type<span className="text-red-500">*</span></label>
                    <select id="companyGstinType" value={gstinType} onChange={handleGstinTypeChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required>
                        <option value="">-- Select Type --</option>
                        <option value="Regular">Regular</option>
                        <option value="Composition">Composition</option>
                        <option value="Unregistered">Unregistered</option>
                    </select>
                    {gstinTypeWarning && <div className="text-yellow-600 text-xs mt-1">{gstinTypeWarning}</div>}
                </div>
                {(gstinType === 'Regular' || gstinType === 'Composition') && (
                    <div>
                        <label htmlFor="companyGstin" className="block text-sm font-medium text-gray-700">GSTIN<span className="text-red-500">*</span></label>
                        <input type="text" id="companyGstin" value={gstin} onChange={(e) => setGstin(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 22ABCDE1234F1Z5" required={gstinType === 'Regular' || gstinType === 'Composition'} />
                        {gstinStateError && <div className="text-red-600 text-xs mt-1">{gstinStateError}</div>}
                    </div>
                )}
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
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setLogoUrl, 'logo', setLogoPreview, setLogoUploading, setLogoProgress)} />
                    {logoUploading && logoProgress > 0 && <div className="text-xs text-blue-600 mt-1">Uploading: {logoProgress}%</div>}
                    {(logoPreview || logoUrl) && (
                      <div className="flex items-center gap-2 mt-2">
                        <img src={logoPreview || logoUrl} alt="Logo Preview" className="h-16" />
                        <button type="button" onClick={handleRemoveLogo} className="text-red-600 text-xs border border-red-300 rounded px-2 py-1 hover:bg-red-50">Remove</button>
                      </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Sign (Image)</label>
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setSignUrl, 'sign', setSignPreview, setSignUploading, setSignProgress)} />
                    {signUploading && signProgress > 0 && <div className="text-xs text-blue-600 mt-1">Uploading: {signProgress}%</div>}
                    {(signPreview || signUrl) && (
                      <div className="flex items-center gap-2 mt-2">
                        <img src={signPreview || signUrl} alt="Sign Preview" className="h-16" />
                        <button type="button" onClick={handleRemoveSign} className="text-red-600 text-xs border border-red-300 rounded px-2 py-1 hover:bg-red-50">Remove</button>
                      </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Seal (Image)</label>
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setSealUrl, 'seal', setSealPreview, setSealUploading, setSealProgress)} />
                    {sealUploading && sealProgress > 0 && <div className="text-xs text-blue-600 mt-1">Uploading: {sealProgress}%</div>}
                    {(sealPreview || sealUrl) && (
                      <div className="flex items-center gap-2 mt-2">
                        <img src={sealPreview || sealUrl} alt="Seal Preview" className="h-16" />
                        <button type="button" onClick={handleRemoveSeal} className="text-red-600 text-xs border border-red-300 rounded px-2 py-1 hover:bg-red-50">Remove</button>
                      </div>
                    )}
                </div>
                <div>
                    <label htmlFor="companyUpiId" className="block text-sm font-medium text-gray-700">UPI ID</label>
                    <input type="text" id="companyUpiId" value={upiId} onChange={e => setUpiId(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., yourname@upi" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">UPI QR Code</label>
                    {upiQrUrl && <img src={upiQrPreview || upiQrUrl} alt="UPI QR Code" className="h-24 w-24 object-contain border mb-2" />}
                    <input type="file" accept="image/*" onChange={e => handleImageChange(e, setUpiQrUrl, 'upiQr', setUpiQrPreview, setUpiQrUploading, setUpiQrProgress)} />
                    {upiQrUploading && <div className="text-xs text-blue-600">Uploading: {upiQrProgress}%</div>}
                    {upiQrUrl && <button type="button" className="text-red-500 text-xs mt-1" onClick={() => { setUpiQrUrl(''); setUpiQrPreview(''); }}>Remove</button>}
                </div>
                <div>
                    <label htmlFor="companyPaymentGatewayLink" className="block text-sm font-medium text-gray-700">Payment Gateway Link</label>
                    <input type="text" id="companyPaymentGatewayLink" value={paymentGatewayLink} onChange={e => setPaymentGatewayLink(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., https://yourpaymentgateway.com/pay/123" />
                </div>
                <div>
                    <label htmlFor="companySalesTerms" className="block text-sm font-medium text-gray-700">Sales Terms and Conditions</label>
                    <textarea id="companySalesTerms" value={salesTerms} onChange={e => setSalesTerms(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter terms and conditions for sales bills..." rows={3} />
                </div>
                <div>
                    <label htmlFor="companyPurchaseTerms" className="block text-sm font-medium text-gray-700">Purchase Terms and Conditions</label>
                    <textarea id="companyPurchaseTerms" value={purchaseTerms} onChange={e => setPurchaseTerms(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter terms and conditions for purchase bills..." rows={3} />
                </div>
                <div>
                    <label htmlFor="companyFooter" className="block text-sm font-medium text-gray-700">Footer</label>
                    <textarea id="companyFooter" value={footer} onChange={e => setFooter(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter footer text for your bills..." rows={2} />
                </div>
                <div>
                    <label htmlFor="companyQuotationTerms" className="block text-sm font-medium text-gray-700">Quotation Terms and Conditions</label>
                    <textarea id="companyQuotationTerms" value={quotationTerms} onChange={e => setQuotationTerms(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter terms and conditions for quotations..." rows={3} />
                </div>
            </div>
            <div className="flex gap-4 mt-4">
                <button
                    onClick={handleSaveCompanyDetails}
                    disabled={logoUploading || signUploading || sealUploading}
                    className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 ${logoUploading || signUploading || sealUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {logoUploading || signUploading || sealUploading ? 'Uploading Image...' : 'Save Company Details'}
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
                <p className="text-gray-700"><strong>UPI ID:</strong> {upiId || 'N/A'}</p>
                <p className="text-gray-700"><strong>UPI QR Code:</strong> {upiQrUrl && <img src={upiQrPreview || upiQrUrl} alt="UPI QR Code" className="inline h-8 align-middle" />}</p>
                <p className="text-gray-700"><strong>Payment Gateway Link:</strong> {paymentGatewayLink || 'N/A'}</p>
                <p className="text-gray-700"><strong>Sales Terms and Conditions:</strong> {salesTerms || 'N/A'}</p>
                <p className="text-gray-700"><strong>Purchase Terms and Conditions:</strong> {purchaseTerms || 'N/A'}</p>
                <p className="text-gray-700"><strong>Terms and Conditions:</strong> {salesTerms || 'N/A'}</p>
                <p className="text-gray-700"><strong>Footer:</strong> {footer || 'N/A'}</p>
                <p className="text-gray-700"><strong>Quotation Terms and Conditions:</strong> {quotationTerms || 'N/A'}</p>
            </div>
        </div>
    );
};

export default CompanyDetails; 