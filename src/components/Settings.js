import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase.config';
import { sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { listUserDevices, registerCurrentDevice, removeDevice, getOrCreateDeviceId } from '../utils/deviceManager';
import { getSettingsDoc, getSettingsSubDoc, APP_ID } from '../utils/appArtifacts';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [mpinError, setMpinError] = useState('');
  const [mpinSuccess, setMpinSuccess] = useState('');
  const [isMpinSet, setIsMpinSet] = useState(false);
  
  // Account summary
  const [account, setAccount] = useState({ uid:'', email:'', displayName:'', emailVerified:false, phoneNumber:'', providers:[], creationTime:'', lastSignInTime:'', photoURL:'' });
  const [company, setCompany] = useState(null);
  
  // MPIN change security states
  const [showCurrentMpinModal, setShowCurrentMpinModal] = useState(false);
  const [currentMpin, setCurrentMpin] = useState('');
  const [currentMpinError, setCurrentMpinError] = useState('');
  const [showForgotMpinModal, setShowForgotMpinModal] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState(''); // 'email', 'mobile', 'google'
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Profile
  const [profile, setProfile] = useState({ displayName: '', email: '', phone: '', recoveryEmail: '', secondaryPhone: '', language: 'en-IN', timezone: 'Asia/Kolkata', currency: 'INR' });
  const [profileMsg, setProfileMsg] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  // Devices
  const [devices, setDevices] = useState([]);
  // Notifications
  const [notif, setNotif] = useState({ enabled: true, email: true, push: true, sms: false, topics: { bills: true, receipts: true, reminders: true, weekly: false } });
  const [notifMsg, setNotifMsg] = useState('');
  // Payments
  const [pg, setPg] = useState({ provider: 'razorpay', mode: 'test', keyId: '', status: 'not_configured' });
  const [pgMsg, setPgMsg] = useState('');
  // SMS
  const [sms, setSms] = useState({ provider: 'msg91', senderId: '', defaultTemplate: '', status: 'not_configured' });
  const [smsMsg, setSmsMsg] = useState('');
  // Branding
  const [brand, setBrand] = useState({ shareMessageDefault: '', footerText: 'Acctoo.com Lets accounting togeather' });
  const [brandMsg, setBrandMsg] = useState('');
  // Password ops
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    setAccount({
      uid: u.uid,
      email: u.email || '',
      displayName: u.displayName || '',
      emailVerified: !!u.emailVerified,
      phoneNumber: u.phoneNumber || '',
      providers: (u.providerData || []).map(p => p.providerId),
      creationTime: u.metadata?.creationTime || '',
      lastSignInTime: u.metadata?.lastSignInTime || '',
      photoURL: u.photoURL || ''
    });
    // Ensure primary email is always from login
    setProfile(prev => ({ ...prev, email: u.email || '' }));
    // Fetch company details if available
    try {
      const ref = doc(getSettingsDoc(u.uid).parent.parent, u.uid, 'companyDetails', 'myCompany');
      getDoc(ref).then(snap => {
        if (snap.exists()) setCompany(snap.data());
      }).catch(()=>{});
    } catch {}
  }, []);

  const loadUserSettings = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const settingsRef = getSettingsDoc(userId);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const userData = settingsSnap.data();
        setIsMpinSet(!!userData.mpin);
        setProfile(prev => ({
          ...prev,
          displayName: userData.displayName || auth.currentUser?.displayName || '',
          email: auth.currentUser?.email || '',
          phone: userData.phone || '',
          recoveryEmail: userData.recoveryEmail || userData.secondaryEmail || '',
          secondaryPhone: userData.secondaryPhone || '',
          language: userData.language || 'en-IN',
          timezone: userData.timezone || 'Asia/Kolkata',
          currency: userData.currency || 'INR',
        }));
      } else {
        setProfile(prev => ({ ...prev, email: auth.currentUser?.email || '' }));
      }

      // Load sub-settings
      try {
        const notifSnap = await getDoc(getSettingsSubDoc(userId, 'Notifications', 'default'));
        if (notifSnap.exists()) setNotif(prev => ({ ...prev, ...notifSnap.data() }));
      } catch {}
      try {
        const pgSnap = await getDoc(getSettingsSubDoc(userId, 'Payments', 'public'));
        if (pgSnap.exists()) setPg(prev => ({ ...prev, ...pgSnap.data() }));
      } catch {}
      try {
        const smsSnap = await getDoc(getSettingsSubDoc(userId, 'SMS', 'public'));
        if (smsSnap.exists()) setSms(prev => ({ ...prev, ...smsSnap.data() }));
      } catch {}
      try {
        const brandSnap = await getDoc(getSettingsSubDoc(userId, 'Branding', 'default'));
        if (brandSnap.exists()) setBrand(prev => ({ ...prev, ...brandSnap.data() }));
      } catch {}

      // Ensure current device registration (do not exceed 3)
      const res = await registerCurrentDevice(userId, { platform: 'web' });
      if (!res.ok && res.reason === 'limit') {
        // user can remove from UI
      }
      const list = await listUserDevices(userId);
      setDevices(list);

    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const handleProfileSave = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const settingsRef = getSettingsDoc(userId);
      await setDoc(settingsRef, {
        displayName: profile.displayName,
        phone: profile.phone,
        recoveryEmail: profile.recoveryEmail,
        secondaryEmail: profile.recoveryEmail, // backward compatibility
        secondaryPhone: profile.secondaryPhone,
        language: profile.language,
        timezone: profile.timezone,
        currency: profile.currency,
        updatedAt: new Date(),
        email: auth.currentUser?.email || profile.email,
      }, { merge: true });
      setProfileMsg('Saved');
      setIsEditingProfile(false);
      setTimeout(()=>setProfileMsg(''), 1500);
    } catch (e) {
      setProfileMsg(e.message || 'Failed');
    }
  };

  const handleProfileCancel = async () => {
    setIsEditingProfile(false);
    await loadUserSettings();
  };

  const refreshDevices = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const list = await listUserDevices(userId);
    setDevices(list);
  }

  const handleRemoveDevice = async (deviceId) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    await removeDevice(userId, deviceId);
    await refreshDevices();
  }

  const handleForgotPassword = async () => {
    try {
      setPwdMsg(''); setPwdError('');
      const email = auth.currentUser?.email;
      if (!email) throw new Error('No login email found');
      await sendPasswordResetEmail(auth, email);
      setPwdMsg('Password reset link sent to your email.');
    } catch (e) {
      setPwdError(e.message || 'Failed to send reset email');
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdMsg(''); setPwdError('');
    try {
      if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters');
      if (newPassword !== confirmNewPassword) throw new Error('Passwords do not match');
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User not authenticated');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPwdMsg('Password updated successfully.');
      setShowChangePwd(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (e) {
      setPwdError(e.message || 'Failed to update password');
    }
  };

  const saveNotifications = async () => {
    try {
      const userId = auth.currentUser?.uid; if (!userId) return;
      const notifRef = getSettingsSubDoc(userId, 'Notifications', 'default');
      await setDoc(notifRef, { ...notif, updatedAt: new Date() }, { merge: true });
      setNotifMsg('Saved'); setTimeout(()=>setNotifMsg(''), 1500);
    } catch (e) { setNotifMsg(e.message || 'Failed'); }
  };

  const savePayments = async () => {
    try {
      const userId = auth.currentUser?.uid; if (!userId) return;
      const pgRef = getSettingsSubDoc(userId, 'Payments', 'public');
      await setDoc(pgRef, { provider: pg.provider, mode: pg.mode, keyId: pg.keyId, status: 'configured', updatedAt: new Date() }, { merge: true });
      setPgMsg('Saved'); setTimeout(()=>setPgMsg(''), 1500);
    } catch (e) { setPgMsg(e.message || 'Failed'); }
  };

  const saveSMS = async () => {
    try {
      const userId = auth.currentUser?.uid; if (!userId) return;
      const smsRef = getSettingsSubDoc(userId, 'SMS', 'public');
      await setDoc(smsRef, { provider: sms.provider, senderId: sms.senderId, defaultTemplate: sms.defaultTemplate, status: 'configured', updatedAt: new Date() }, { merge: true });
      setSmsMsg('Saved'); setTimeout(()=>setSmsMsg(''), 1500);
    } catch (e) { setSmsMsg(e.message || 'Failed'); }
  };

  const saveBranding = async () => {
    try {
      const userId = auth.currentUser?.uid; if (!userId) return;
      const brandRef = getSettingsSubDoc(userId, 'Branding', 'default');
      await setDoc(brandRef, { ...brand, updatedAt: new Date() }, { merge: true });
      setBrandMsg('Saved'); setTimeout(()=>setBrandMsg(''), 1500);
    } catch (e) { setBrandMsg(e.message || 'Failed'); }
  };

  const handleMpinSubmit = async (e) => {
    e.preventDefault();
    setMpinError('');
    setMpinSuccess('');

    if (!mpin || mpin.length !== 4) {
      setMpinError('MPIN must be exactly 4 digits');
      return;
    }

    if (!/^\d+$/.test(mpin)) {
      setMpinError('MPIN must contain only numbers');
      return;
    }

    if (mpin !== confirmMpin) {
      setMpinError('MPIN and confirmation do not match');
      return;
    }

    if (isMpinSet) {
      setShowCurrentMpinModal(true);
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setMpinError('User not authenticated');
        return;
      }

      const hashedMpin = btoa(mpin); // demo only
      const settingsRef = getSettingsDoc(userId);
      const userDoc = await getDoc(settingsRef);
      if (userDoc.exists()) {
        await updateDoc(settingsRef, { mpin: hashedMpin, mpinSetAt: new Date() });
      } else {
        await setDoc(settingsRef, { mpin: hashedMpin, mpinSetAt: new Date(), email: auth.currentUser.email, createdAt: new Date() }, { merge: true });
      }

      setMpinSuccess('MPIN set successfully!');
      setIsMpinSet(true);
      setMpin('');
      setConfirmMpin('');
      setTimeout(() => setMpinSuccess(''), 3000);
    } catch (error) {
      console.error('Error setting MPIN:', error);
      setMpinError(`Failed to set MPIN: ${error.message}`);
    }
  };

  const handleCurrentMpinSubmit = async (e) => {
    e.preventDefault();
    setCurrentMpinError('');

    if (!currentMpin || currentMpin.length !== 4) {
      setCurrentMpinError('Please enter your current 4-digit MPIN');
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setCurrentMpinError('User not authenticated');
        return;
      }

      const userDoc = await getDoc(getSettingsDoc(userId));
      if (!userDoc.exists()) {
        setCurrentMpinError('User data not found');
        return;
      }

      const userData = userDoc.data();
      const storedMpin = userData.mpin;
      if (!storedMpin) {
        setCurrentMpinError('No MPIN found. Please set a new MPIN.');
        return;
      }

      const hashedInput = btoa(currentMpin);
      if (hashedInput === storedMpin) {
        setShowCurrentMpinModal(false);
        setCurrentMpin('');
        setCurrentMpinError('');
        await setNewMpin();
      } else {
        setCurrentMpinError('Incorrect current MPIN');
        setCurrentMpin('');
      }
    } catch (error) {
      console.error('Error verifying current MPIN:', error);
      setCurrentMpinError('Error verifying MPIN. Please try again.');
    }
  };

  const handleForgotMpin = () => {
    setShowCurrentMpinModal(false);
    setShowForgotMpinModal(true);
    setVerificationMethod('');
    setVerificationCode('');
    setVerificationError('');
  };

  const handleSendVerificationCode = async (method) => {
    setVerificationMethod(method);
    setIsVerifying(true);
    setVerificationError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Verification code sent. Demo code: 123456');
    } catch (error) {
      console.error('Error sending verification code:', error);
      setVerificationError('Failed to send verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setVerificationError('');

    if (!verificationCode || verificationCode.length !== 6) {
      setVerificationError('Please enter the 6-digit verification code');
      return;
    }

    try {
      if (verificationCode === '123456') {
        setShowForgotMpinModal(false);
        setVerificationCode('');
        setVerificationError('');
        await setNewMpin();
      } else {
        setVerificationError('Incorrect verification code');
        setVerificationCode('');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      setVerificationError('Error verifying code. Please try again.');
    }
  };

  const setNewMpin = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setMpinError('User not authenticated');
        return;
      }

      const hashedMpin = btoa(mpin);
      const userDocRef = getSettingsDoc(userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        await updateDoc(userDocRef, { mpin: hashedMpin, mpinSetAt: new Date() });
      } else {
        await setDoc(userDocRef, { mpin: hashedMpin, mpinSetAt: new Date(), email: auth.currentUser.email, createdAt: new Date() });
      }

      setMpinSuccess('MPIN set successfully!');
      setIsMpinSet(true);
      setMpin('');
      setConfirmMpin('');
      setTimeout(() => setMpinSuccess(''), 3000);
    } catch (error) {
      console.error('Error setting MPIN:', error);
      setMpinError(`Failed to set MPIN: ${error.message}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-2 md:px-0">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
      </div>

      {/* Account summary */}
      <div className="mb-4 bg-white rounded-lg shadow p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {account.photoURL ? (
            <img src={account.photoURL} alt="avatar" className="w-12 h-12 object-cover" />
          ) : (
            <span className="text-lg font-bold text-gray-700">{(account.displayName || account.email || 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-gray-900">{account.displayName || '—'}</div>
            {account.emailVerified && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Verified</span>}
          </div>
          <div className="text-sm text-gray-700">{account.email || '—'}</div>
          <div className="text-xs text-gray-500 break-all">UID: {account.uid || '—'}</div>
          <div className="text-xs text-gray-500">Providers: {account.providers.join(', ') || '—'}</div>
          <div className="text-xs text-gray-500">Last sign-in: {account.lastSignInTime || '—'}{account.creationTime ? ` • Created: ${account.creationTime}` : ''}</div>
          {company?.firmName && (
            <div className="text-xs text-gray-600 mt-1">Company: {company.firmName}{company.city ? `, ${company.city}` : ''}</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            {key:'profile',label:'👤 Profile'},
            {key:'security',label:'🔐 Security & MPIN'},
            {key:'notifications',label:'🔔 Notifications'},
            {key:'payments',label:'💳 Payments'},
            {key:'sms',label:'📩 SMS'},
            {key:'branding',label:'🎨 Branding'},
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Profile</h3>
                  <p className="text-sm text-gray-600">Primary Email is your login email and cannot be changed.</p>
                </div>
                {!isEditingProfile ? (
                  <button onClick={() => setIsEditingProfile(true)} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Edit</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleProfileSave} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
                    <button onClick={handleProfileCancel} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Cancel</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.displayName} onChange={(e)=>setProfile({...profile, displayName:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Email</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100" value={account.email || ''} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact</label>
                  <input disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.phone} onChange={(e)=>setProfile({...profile, phone:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recovery Email</label>
                  <input disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.recoveryEmail} onChange={(e)=>setProfile({...profile, recoveryEmail:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Contact</label>
                  <input disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.secondaryPhone} onChange={(e)=>setProfile({...profile, secondaryPhone:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.language} onChange={(e)=>setProfile({...profile, language:e.target.value})}>
                    <option value="en-IN">English (India)</option>
                    <option value="hi-IN">हिन्दी</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <input disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.timezone} onChange={(e)=>setProfile({...profile, timezone:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input disabled={!isEditingProfile} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50" value={profile.currency} onChange={(e)=>setProfile({...profile, currency:e.target.value})} />
                </div>
              </div>
              {profileMsg && <div className="text-sm text-gray-600">{profileMsg}</div>}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Security & MPIN</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set a 4-digit MPIN for additional security. This will be required for sensitive operations.
                </p>
              </div>

              {/* Password controls */}
              <div className="rounded border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-gray-900">Password</div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowChangePwd(!showChangePwd)} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Change Password</button>
                    <button onClick={handleForgotPassword} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Forgot Password</button>
                  </div>
                </div>
                {showChangePwd && (
                  <form onSubmit={handleChangePasswordSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="password" className="px-3 py-2 border rounded" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} />
                    <input type="password" className="px-3 py-2 border rounded" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
                    <input type="password" className="px-3 py-2 border rounded" placeholder="Confirm new password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} />
                    <div className="md:col-span-3 flex gap-2">
                      <button type="submit" className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Update</button>
                      <button type="button" onClick={() => { setShowChangePwd(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200">Cancel</button>
                    </div>
                  </form>
                )}
                {(pwdMsg || pwdError) && (
                  <div className={`text-sm mt-2 ${pwdError ? 'text-red-600' : 'text-green-600'}`}>{pwdError || pwdMsg}</div>
                )}
              </div>

              {isMpinSet && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-800 font-medium">MPIN is already set</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleMpinSubmit} className="space-y-4">
                <div>
                  <label htmlFor="mpin" className="block text-sm font-medium text-gray-700 mb-1">
                    Enter 4-digit MPIN
                  </label>
                  <input
                    type="password"
                    id="mpin"
                    value={mpin}
                    onChange={(e) => setMpin(e.target.value)}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter 4 digits"
                  />
                </div>

                <div>
                  <label htmlFor="confirmMpin" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm MPIN
                  </label>
                  <input
                    type="password"
                    id="confirmMpin"
                    value={confirmMpin}
                    onChange={(e) => setConfirmMpin(e.target.value)}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm 4 digits"
                  />
                </div>

                {mpinError && (
                  <div className="text-red-600 text-sm">{mpinError}</div>
                )}

                {mpinSuccess && (
                  <div className="text-green-600 text-sm">{mpinSuccess}</div>
                )}

                <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">Set MPIN</button>
              </form>

              <div className="pt-6 border-t">
                <h4 className="text-md font-semibold mb-2">Devices (max 3)</h4>
                {devices.length === 0 ? (
                  <div className="text-sm text-gray-600">No devices registered.</div>
                ) : (
                  <ul className="divide-y">
                    {devices.map(d => (
                      <li key={d.id} className="py-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{d.platform || 'web'} — {d.id === getOrCreateDeviceId() ? 'This device' : d.id}</div>
                          <div className="text-xs text-gray-500">Last seen: {d.lastSeen?.toDate ? d.lastSeen.toDate().toLocaleString() : (d.lastSeen || '')}</div>
                        </div>
                        <button onClick={()=>handleRemoveDevice(d.id)} className="text-red-600 text-sm hover:underline">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {devices.length >= 3 && (
                  <div className="text-xs text-red-600 mt-2">Device limit reached. Remove a device to add a new one.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications</h3>
                <p className="text-sm text-gray-600">Enable/disable channels and topics.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.enabled} onChange={e=>setNotif({...notif, enabled:e.target.checked})}/> Enable all</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.push} onChange={e=>setNotif({...notif, push:e.target.checked})}/> Push</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.email} onChange={e=>setNotif({...notif, email:e.target.checked})}/> Email</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.sms} onChange={e=>setNotif({...notif, sms:e.target.checked})}/> SMS</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.topics.bills} onChange={e=>setNotif({...notif, topics:{...notif.topics, bills:e.target.checked}})}/> Bills</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.topics.receipts} onChange={e=>setNotif({...notif, topics:{...notif.topics, receipts:e.target.checked}})}/> Receipts</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.topics.reminders} onChange={e=>setNotif({...notif, topics:{...notif.topics, reminders:e.target.checked}})}/> Reminders</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notif.topics.weekly} onChange={e=>setNotif({...notif, topics:{...notif.topics, weekly:e.target.checked}})}/> Weekly summary</label>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveNotifications} className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Save</button>
                {notifMsg && <span className="text-sm text-gray-600">{notifMsg}</span>}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Gateway</h3>
                <p className="text-sm text-gray-600">Per-user integration (Key ID only here; secrets handled server-side).</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={pg.provider} onChange={e=>setPg({...pg, provider:e.target.value})}>
                    <option value="razorpay">Razorpay</option>
                    <option value="cashfree">Cashfree</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={pg.mode} onChange={e=>setPg({...pg, mode:e.target.value})}>
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key ID (public)</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={pg.keyId} onChange={e=>setPg({...pg, keyId:e.target.value})} placeholder="e.g., rzp_test_..." />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={savePayments} className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Save</button>
                {pgMsg && <span className="text-sm text-gray-600">{pgMsg}</span>}
              </div>
            </div>
          )}

          {activeTab === 'sms' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">SMS</h3>
                <p className="text-sm text-gray-600">Per-user provider setup.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={sms.provider} onChange={e=>setSms({...sms, provider:e.target.value})}>
                    <option value="msg91">MSG91</option>
                    <option value="textlocal">Textlocal</option>
                    <option value="twilio">Twilio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={sms.senderId} onChange={e=>setSms({...sms, senderId:e.target.value})} placeholder="e.g., ACCTOO" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Template ID</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={sms.defaultTemplate} onChange={e=>setSms({...sms, defaultTemplate:e.target.value})} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveSMS} className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Save</button>
                {smsMsg && <span className="text-sm text-gray-600">{smsMsg}</span>}
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Branding</h3>
                <p className="text-sm text-gray-600">Default share message and footer for exports/links.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Share Message</label>
                  <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md" value={brand.shareMessageDefault} onChange={e=>setBrand({...brand, shareMessageDefault:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={brand.footerText} onChange={e=>setBrand({...brand, footerText:e.target.value})} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveBranding} className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Save</button>
                {brandMsg && <span className="text-sm text-gray-600">{brandMsg}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current MPIN Verification Modal */}
      {showCurrentMpinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Verify Current MPIN</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please enter your current MPIN to change it.
              </p>
              
              <form onSubmit={handleCurrentMpinSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={currentMpin}
                    onChange={(e) => setCurrentMpin(e.target.value)}
                    maxLength={4}
                    className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••"
                    autoFocus
                  />
                </div>
                
                {currentMpinError && (
                  <div className="text-red-600 text-sm">{currentMpinError}</div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCurrentMpinModal(false);
                      setCurrentMpin('');
                      setCurrentMpinError('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </form>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleForgotMpin}
                  className="text-blue-600 text-sm hover:text-blue-700 underline"
                >
                  Forgot MPIN?
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot MPIN Modal */}
      {showForgotMpinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Forgot MPIN?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Choose a verification method to reset your MPIN.
              </p>
              
              {!verificationMethod ? (
                <div className="space-y-3">
                  <button
                    onClick={() => handleSendVerificationCode('email')}
                    disabled={isVerifying}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Sending...' : '📧 Send Code via Email'}
                  </button>
                  <button
                    onClick={() => handleSendVerificationCode('mobile')}
                    disabled={isVerifying}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Sending...' : '📱 Send Code via SMS'}
                  </button>
                  <button
                    onClick={() => handleSendVerificationCode('google')}
                    disabled={isVerifying}
                    className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Verifying...' : '🔐 Verify with Google'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowForgotMpinModal(false);
                      setVerificationMethod('');
                      setVerificationCode('');
                      setVerificationError('');
                    }}
                    className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Enter the 6-digit code sent to your {verificationMethod}
                    </p>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      className="w-full px-4 py-3 text-center text-xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456"
                      autoFocus
                    />
                  </div>
                  
                  {verificationError && (
                    <div className="text-red-600 text-sm">{verificationError}</div>
                  )}
                  
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationMethod('');
                        setVerificationCode('');
                        setVerificationError('');
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Verify Code
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 