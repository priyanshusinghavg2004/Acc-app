import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase.config';

const JoinCompany = () => {
    const { companyId, linkId } = useParams();
    const navigate = useNavigate();
    const auth = getAuth();
    
    const [companyInfo, setCompanyInfo] = useState(null);
    const [linkInfo, setLinkInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    
    // Form states
    const [isNewUser, setIsNewUser] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    
    // Load company and link info
    useEffect(() => {
        const loadCompanyAndLink = async () => {
            try {
                setLoading(true);
                
                // Load company info
                const companyDoc = await getDoc(doc(db, `artifacts/acc-app-e5316/companies/${companyId}`));
                if (!companyDoc.exists()) {
                    setError('Company not found');
                    setLoading(false);
                    return;
                }
                
                const companyData = companyDoc.data();
                setCompanyInfo(companyData);
                
                // Load link info
                const linkDoc = await getDoc(doc(db, `artifacts/acc-app-e5316/companies/${companyId}/referenceLinks`, linkId));
                if (!linkDoc.exists()) {
                    setError('Invalid or expired invitation link');
                    setLoading(false);
                    return;
                }
                
                const linkData = linkDoc.data();
                
                // Check if link is active
                if (!linkData.isActive) {
                    setError('This invitation link is no longer active');
                    setLoading(false);
                    return;
                }
                
                // Check if link has expired
                if (linkData.expiresAt && new Date() > linkData.expiresAt.toDate()) {
                    setError('This invitation link has expired');
                    setLoading(false);
                    return;
                }
                
                setLinkInfo(linkData);
                setLoading(false);
                
            } catch (error) {
                console.error('Error loading company/link:', error);
                setError('Error loading invitation details');
                setLoading(false);
            }
        };
        
        if (companyId && linkId) {
            loadCompanyAndLink();
        }
    }, [companyId, linkId]);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email || !password || !name) {
            setError('Please fill in all required fields');
            return;
        }
        
        if (isNewUser && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }
        
        try {
            setLoading(true);
            setError('');
            
            let userCredential;
            
            if (isNewUser) {
                // Create new user
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } else {
                // Sign in existing user
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            }
            
            const user = userCredential.user;
            
            // Update user profile
            await updateDoc(doc(db, 'users', user.uid), {
                name: name,
                phone: phone,
                companyId: companyId,
                companyRole: 'member',
                permissions: linkInfo.permissions || [],
                companyAddedAt: new Date(),
                status: 'active',
                joinedViaLink: linkId,
                joinedAt: new Date()
            });
            
            // Update link usage count
            await updateDoc(doc(db, `artifacts/acc-app-e5316/companies/${companyId}/referenceLinks`, linkId), {
                usageCount: (linkInfo.usageCount || 0) + 1,
                lastUsedAt: new Date(),
                lastUsedBy: user.uid
            });
            
            // Add user to company members
            const updatedMembers = [...(companyInfo.members || []), user.uid];
            await updateDoc(doc(db, `artifacts/acc-app-e5316/companies/${companyId}`), {
                members: updatedMembers
            });
            
            setMessage('Successfully joined the company! Redirecting to dashboard...');
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                navigate('/#/dashboard');
            }, 2000);
            
        } catch (error) {
            console.error('Error joining company:', error);
            
            if (error.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists. Please sign in instead.');
                setIsNewUser(false);
            } else if (error.code === 'auth/user-not-found') {
                setError('No account found with this email. Please create a new account.');
                setIsNewUser(true);
            } else if (error.code === 'auth/wrong-password') {
                setError('Incorrect password. Please try again.');
            } else {
                setError('Error joining company. Please try again.');
            }
            
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading invitation...</p>
                </div>
            </div>
        );
    }

    if (error && !companyInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
                    <div className="text-center">
                        <div className="text-red-500 text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Invalid Invitation</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Go to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="text-blue-500 text-6xl mb-4">🏢</div>
                    <h2 className="text-3xl font-bold text-gray-900">Join Company</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        You've been invited to join <strong>{companyInfo?.companyName}</strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        Company ID: {companyId}
                    </p>
                </div>

                {message && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Invitation Details</h3>
                        <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">
                                <strong>Link:</strong> {linkInfo?.name}
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Permissions:</strong> {linkInfo?.permissions?.join(', ') || 'None'}
                            </p>
                            {linkInfo?.expiresAt && (
                                <p className="text-sm text-gray-600">
                                    <strong>Expires:</strong> {linkInfo.expiresAt.toDate().toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex space-x-4 mb-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    checked={!isNewUser}
                                    onChange={() => setIsNewUser(false)}
                                    className="mr-2"
                                />
                                <span className="text-sm">I have an account</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    checked={isNewUser}
                                    onChange={() => setIsNewUser(true)}
                                    className="mr-2"
                                />
                                <span className="text-sm">Create new account</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email *</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your phone number"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password *</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        {isNewUser && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Confirm your password"
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                loading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {loading ? 'Joining...' : (isNewUser ? 'Create Account & Join' : 'Sign In & Join')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-500">
                            By joining, you agree to the company's terms and conditions
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinCompany; 