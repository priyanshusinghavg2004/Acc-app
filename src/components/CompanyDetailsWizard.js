import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import imageCompression from 'browser-image-compression';

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const CompanyDetailsWizard = ({ isOpen, onClose, db, userId, appId, onComplete, registrationData }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Page 1 - Mandatory
    ownerName: '',
    gstinType: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactNumber: registrationData?.contact || '', // Pre-fill from registration
    email: registrationData?.email || '', // Pre-fill from registration
    
    // Page 2 - Optional
    pan: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    upiId: '',
    upiQrUrl: '',
    
    // Page 3 - Optional
    logoUrl: '',
    signUrl: '',
    sealUrl: '',
    
    // Page 4 - Optional
    salesTerms: '',
    purchaseTerms: '',
    quotationTerms: '',
    footer: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const updateFormData = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Clear GST number if GST type is changed to Unregistered
      if (field === 'gstinType' && value === 'Unregistered') {
        newData.gstin = '';
      }
      
      return newData;
    });
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
      if (!formData.gstinType) newErrors.gstinType = 'GST type is required';
      
      // GST number validation based on GST type and Indian law
      if (formData.gstinType && (formData.gstinType === 'Regular' || formData.gstinType === 'Composition')) {
        if (!formData.gstin.trim()) {
          newErrors.gstin = 'GST number is required for Regular and Composition businesses';
        } else {
          const gstin = formData.gstin.trim().toUpperCase();
          
          // Basic format validation
          if (gstin.length !== 15) {
            newErrors.gstin = 'GST number must be exactly 15 characters long';
          } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
            newErrors.gstin = 'Invalid GST number format. Format should be: 22AAAAA0000A1Z5';
          } else {
            // Detailed validation according to Indian GST law
            const stateCode = gstin.substring(0, 2);
            const panNumber = gstin.substring(2, 12);
            const entityCode = gstin.substring(12, 13);
            const checkSum = gstin.substring(13, 15);
            
            // State code validation (01-37, 97, 98, 99)
            const validStateCodes = [
              '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
              '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
              '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
              '31', '32', '33', '34', '35', '36', '37', '97', '98', '99'
            ];
            
            if (!validStateCodes.includes(stateCode)) {
              newErrors.gstin = 'Invalid state code in GST number';
            }
            
            // PAN number validation (should be valid PAN format)
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
              newErrors.gstin = 'Invalid PAN number format in GST number';
            }
            
            // Entity code validation (1-9, A-Z)
            if (!/^[1-9A-Z]$/.test(entityCode)) {
              newErrors.gstin = 'Invalid entity code in GST number';
            }
            
            // Check sum validation (Z + 1 alphanumeric)
            if (!/^Z[0-9A-Z]$/.test(checkSum)) {
              newErrors.gstin = 'Invalid check sum in GST number';
            }
          }
        }
      }
      
      if (!formData.address.trim()) newErrors.address = 'Address is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.state) newErrors.state = 'State is required';
      if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
      // Removed contact number validation since it's pre-filled
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSkip = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleImageUpload = async (file, field) => {
    if (!file) return;
    
    setUploadProgress(prev => ({ ...prev, [field]: 0 }));
    
    try {
      const options = {
        maxSizeMB: 0.08,
        maxWidthOrHeight: 200,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      
      const storage = getStorage();
      const storageRef = ref(storage, `companyAssets/${userId}/${field}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, compressedFile);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [field]: Math.round(progress) }));
        },
        (error) => {
          setUploadProgress(prev => ({ ...prev, [field]: 0 }));
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          updateFormData(field + 'Url', url);
          setUploadProgress(prev => ({ ...prev, [field]: 0 }));
        }
      );
    } catch (error) {
      setUploadProgress(prev => ({ ...prev, [field]: 0 }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
      await setDoc(companyDocRef, {
        ...formData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      onComplete && onComplete();
    } catch (error) {
      console.error('Error saving company details:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Basic Company Information</h2>
        <p className="text-gray-600">Please provide the essential details about your business</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
          <input
            type="text"
            value={formData.ownerName}
            onChange={(e) => updateFormData('ownerName', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${errors.ownerName ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Enter owner name"
          />
          {errors.ownerName && <p className="text-red-500 text-sm mt-1">{errors.ownerName}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GST Type *</label>
          <select
            value={formData.gstinType}
            onChange={(e) => updateFormData('gstinType', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${errors.gstinType ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select GST Type</option>
            <option value="Regular">Regular</option>
            <option value="Composition">Composition</option>
            <option value="Unregistered">Unregistered</option>
          </select>
          {errors.gstinType && <p className="text-red-500 text-sm mt-1">{errors.gstinType}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GST Registration No
            {(formData.gstinType === 'Regular' || formData.gstinType === 'Composition') && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="text"
            value={formData.gstin}
            onChange={(e) => {
              // Auto-format GST number: convert to uppercase and limit to 15 characters
              let value = e.target.value.toUpperCase();
              value = value.replace(/[^0-9A-Z]/g, ''); // Remove special characters
              value = value.substring(0, 15); // Limit to 15 characters
              updateFormData('gstin', value);
            }}
            className={`w-full border rounded-lg px-3 py-2 ${errors.gstin ? 'border-red-500' : 'border-gray-300'}`}
            placeholder={formData.gstinType === 'Unregistered' ? 'Not required for unregistered businesses' : '22AAAAA0000A1Z5'}
            disabled={formData.gstinType === 'Unregistered'}
            maxLength={15}
          />
          {errors.gstin && <p className="text-red-500 text-sm mt-1">{errors.gstin}</p>}
          {formData.gstinType === 'Unregistered' && (
            <p className="text-xs text-gray-500 mt-1">GST number not required for unregistered businesses</p>
          )}
          {(formData.gstinType === 'Regular' || formData.gstinType === 'Composition') && (
            <p className="text-xs text-gray-500 mt-1">
              Format: 22AAAAA0000A1Z5 (State Code + PAN + Entity + Z + Check Digit)
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
          <input
            type="tel"
            value={formData.contactNumber}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
            placeholder="Contact from registration"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">Pre-filled from registration</p>
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
          <textarea
            value={formData.address}
            onChange={(e) => updateFormData('address', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
            rows="3"
            placeholder="Enter complete address"
          />
          {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => updateFormData('city', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${errors.city ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Enter city"
          />
          {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
          <select
            value={formData.state}
            onChange={(e) => updateFormData('state', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${errors.state ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select State</option>
            {indianStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
          <input
            type="text"
            value={formData.pincode}
            onChange={(e) => updateFormData('pincode', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 ${errors.pincode ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Enter pincode"
          />
          {errors.pincode && <p className="text-red-500 text-sm mt-1">{errors.pincode}</p>}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Bank & Payment Details</h2>
        <p className="text-gray-600">Optional: Add your banking and payment information</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
          <input
            type="text"
            value={formData.pan}
            onChange={(e) => updateFormData('pan', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter PAN number"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
          <input
            type="text"
            value={formData.bankName}
            onChange={(e) => updateFormData('bankName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter bank name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
          <input
            type="text"
            value={formData.bankAccount}
            onChange={(e) => updateFormData('bankAccount', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter account number"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank IFSC Code</label>
          <input
            type="text"
            value={formData.bankIfsc}
            onChange={(e) => updateFormData('bankIfsc', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter IFSC code"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
          <input
            type="text"
            value={formData.upiId}
            onChange={(e) => updateFormData('upiId', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter UPI ID"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UPI QR Code</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files[0], 'upiQr')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
          {uploadProgress.upiQr > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress.upiQr}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Uploading: {uploadProgress.upiQr}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Company Branding</h2>
        <p className="text-gray-600">Optional: Upload your company logo, signature, and seal</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e.target.files[0], 'logo')}
              className="hidden"
              id="logo-upload"
            />
            <label htmlFor="logo-upload" className="cursor-pointer">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Logo" className="w-20 h-20 mx-auto object-contain" />
              ) : (
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">📷</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2">Click to upload logo</p>
            </label>
          </div>
          {uploadProgress.logo > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress.logo}%` }}></div>
              </div>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <label className="block text-sm font-medium text-gray-700 mb-2">Digital Signature</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e.target.files[0], 'sign')}
              className="hidden"
              id="sign-upload"
            />
            <label htmlFor="sign-upload" className="cursor-pointer">
              {formData.signUrl ? (
                <img src={formData.signUrl} alt="Signature" className="w-20 h-20 mx-auto object-contain" />
              ) : (
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">✍️</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2">Click to upload signature</p>
            </label>
          </div>
          {uploadProgress.sign > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress.sign}%` }}></div>
              </div>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Seal</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e.target.files[0], 'seal')}
              className="hidden"
              id="seal-upload"
            />
            <label htmlFor="seal-upload" className="cursor-pointer">
              {formData.sealUrl ? (
                <img src={formData.sealUrl} alt="Seal" className="w-20 h-20 mx-auto object-contain" />
              ) : (
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">🔴</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2">Click to upload seal</p>
            </label>
          </div>
          {uploadProgress.seal > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress.seal}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Terms & Conditions</h2>
        <p className="text-gray-600">Optional: Set default terms for your documents</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sales Terms</label>
          <textarea
            value={formData.salesTerms}
            onChange={(e) => updateFormData('salesTerms', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows="3"
            placeholder="Enter default sales terms and conditions"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Terms</label>
          <textarea
            value={formData.purchaseTerms}
            onChange={(e) => updateFormData('purchaseTerms', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows="3"
            placeholder="Enter default purchase terms and conditions"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quotation Terms</label>
          <textarea
            value={formData.quotationTerms}
            onChange={(e) => updateFormData('quotationTerms', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows="3"
            placeholder="Enter default quotation terms and conditions"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
          <textarea
            value={formData.footer}
            onChange={(e) => updateFormData('footer', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows="2"
            placeholder="Enter footer text for documents"
          />
        </div>
      </div>
    </div>
  );

  const renderProgressBar = () => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">Step {currentStep} of 4</span>
        <span className="text-sm text-gray-500">{Math.round((currentStep / 4) * 100)}% Complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(currentStep / 4) * 100}%` }}></div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Setup</h1>
            <p className="text-gray-600">Complete your company profile</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          {renderProgressBar()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            {currentStep < 4 && (
              <>
                {currentStep > 1 && (
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Skip
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next
                </button>
              </>
            )}
            
            {currentStep === 4 && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetailsWizard; 