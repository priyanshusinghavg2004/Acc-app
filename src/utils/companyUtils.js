import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';
import { getSettingsDoc } from './appArtifacts';

// Generate 6-digit alphanumeric Company ID
export const generateCompanyId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Check if user has company information
export const hasCompanyInfo = (userData) => {
  return !!(userData.companyName || userData.gstNumber || userData.businessName || 
           userData.organization || userData.companyType);
};

// Company types with "Other" option
export const companyTypes = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'ngo', label: 'NGO' },
  { value: 'trust', label: 'Trust' },
  { value: 'society', label: 'Society' },
  { value: 'other', label: 'Other' }
];

// Create company if user has company information
export const createCompanyIfNeeded = async (userData, userId, appId) => {
  try {
    // Check if user already has a company ID
    if (userData.companyId) {
      return { companyId: userData.companyId, isNew: false };
    }

    // Check if user has company information
    if (!hasCompanyInfo(userData)) {
      return { companyId: null, isNew: false };
    }

    // Generate unique company ID
    let companyId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      companyId = generateCompanyId();
      
      // Check if company ID already exists
      const companyRef = doc(db, `artifacts/${appId}/companies/${companyId}`);
      const companyDoc = await getDoc(companyRef);
      
      if (!companyDoc.exists()) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Unable to generate unique company ID');
    }

    // Create company document
    const companyData = {
      companyId,
      companyName: userData.companyName || userData.businessName || 'Unnamed Company',
      gstNumber: userData.gstNumber || '',
      companyType: userData.companyType || 'other',
      companyTypeOther: userData.companyTypeOther || '',
      address: userData.address || '',
      phone: userData.phone || '',
      email: userData.email || '',
      website: userData.website || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      admin: {
        userId,
        email: userData.email,
        role: 'owner',
        addedAt: new Date()
      },
      members: [userId],
      status: 'active'
    };

    await setDoc(doc(db, `artifacts/${appId}/companies/${companyId}`), companyData);

    // Update user Settings document with company ID and role
    const userRef = getSettingsDoc(userId);
    await updateDoc(userRef, {
      companyId,
      companyRole: 'owner',
      companyAddedAt: new Date()
    });

    return { companyId, isNew: true, companyData };
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
};

// Get company information
export const getCompanyInfo = async (companyId, appId) => {
  try {
    const companyRef = doc(db, `artifacts/${appId}/companies/${companyId}`);
    const companyDoc = await getDoc(companyRef);
    
    if (companyDoc.exists()) {
      return companyDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting company info:', error);
    return null;
  }
};

// Check if user is company admin
export const isCompanyAdmin = (userData) => {
  if (!userData) return false;
  return userData.companyRole === 'owner' || userData.companyRole === 'admin';
};

// Get company type label
export const getCompanyTypeLabel = (type, otherType = '') => {
  if (type === 'other' && otherType) {
    return otherType;
  }
  
  const companyType = companyTypes.find(ct => ct.value === type);
  return companyType ? companyType.label : 'Other';
}; 