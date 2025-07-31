import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { sanitizeManufacturingData, validateInput, logSecurityEvent, apiRateLimiter } from '../utils/security';

const ManufacturingNew = ({ db, userId, isAuthReady, appId }) => {
    // Core State
    const [activeTab, setActiveTab] = useState('production-orders');
    const [businessType, setBusinessType] = useState('pure-manufacturing');
    const [message, setMessage] = useState('');
    
    // Modal States
    const [showBusinessTypeModal, setShowBusinessTypeModal] = useState(false);
    const [showProductionOrderModal, setShowProductionOrderModal] = useState(false);
    const [showProcessDefinitionModal, setShowProcessDefinitionModal] = useState(false);
    
    // Data States
    const [items, setItems] = useState([]);
    const [parties, setParties] = useState([]);
    const [productionOrders, setProductionOrders] = useState([]);
    const [processDefinitions, setProcessDefinitions] = useState([]);
    
    // Form States
    const [newProductionOrder, setNewProductionOrder] = useState({
        orderNumber: '',
        customerId: '',
        productId: '',
        processId: '',
        quantity: 1,
        unit: 'Nos.',
        expectedCompletionDate: '',
        priority: 'Normal',
        status: 'Planned',
        notes: ''
    });
    
    const [newProcessDefinition, setNewProcessDefinition] = useState({
        processName: '',
        productName: '',
        description: '',
        category: '',
        estimatedTime: '',
        steps: [],
        materials: [],
        equipment: [],
        qualityChecks: [],
        keywords: []
    });
    
    const [newProcessStep, setNewProcessStep] = useState({
        stepNumber: 1,
        stepName: '',
        description: '',
        duration: '',
        materials: [],
        equipment: '',
        instructions: '',
        qualityCheck: ''
    });
    
    const [newMaterial, setNewMaterial] = useState({
        materialId: '',
        quantity: 0,
        unit: '',
        cost: 0
    });

    // Generate Order Number
    const generateOrderNumber = () => {
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        const financialYear = `${currentYear.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;
        
        const currentYearOrders = productionOrders.filter(order => {
            if (!order.orderNumber) return false;
            return order.orderNumber.includes(`MFO${financialYear}`);
        });
        
        let maxNumber = 0;
        currentYearOrders.forEach(order => {
            const match = order.orderNumber.match(/\/\d+$/);
            if (match) {
                const number = parseInt(match[0].substring(1));
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        });
        
        const nextNumber = maxNumber + 1;
        return `MFO${financialYear}/${nextNumber}`;
    };

    // Fetch Data from Firestore
    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;

        // console.log('Setting up Firestore listeners for new manufacturing system...');

        // Fetch items
        const itemsRef = collection(db, `salaryPayments/${appId}/items`);
        const unsubscribeItems = onSnapshot(itemsRef, (snapshot) => {
            const itemsData = [];
            snapshot.forEach((doc) => {
                itemsData.push({ id: doc.id, ...doc.data() });
            });
            setItems(itemsData);
        });

        // Fetch parties
        const partiesRef = collection(db, `salaryPayments/${appId}/parties`);
        const unsubscribeParties = onSnapshot(partiesRef, (snapshot) => {
            const partiesData = [];
            snapshot.forEach((doc) => {
                partiesData.push({ id: doc.id, ...doc.data() });
            });
            setParties(partiesData);
        });

        // Fetch production orders based on business type
        const ordersRef = collection(db, `salaryPayments/${appId}/productionOrders`);
        const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
            const ordersData = [];
            snapshot.forEach((doc) => {
                const orderData = { id: doc.id, ...doc.data() };
                // Filter by business type
                if (orderData.businessType === businessType) {
                    ordersData.push(orderData);
                }
            });
            setProductionOrders(ordersData);
        });

        // Fetch process definitions
        const processRef = collection(db, `salaryPayments/${appId}/processDefinitions`);
        const unsubscribeProcess = onSnapshot(processRef, (snapshot) => {
            const processData = [];
            snapshot.forEach((doc) => {
                processData.push({ id: doc.id, ...doc.data() });
            });
            setProcessDefinitions(processData);
        });

        return () => {
            unsubscribeItems();
            unsubscribeParties();
            unsubscribeOrders();
            unsubscribeProcess();
        };
    }, [db, userId, isAuthReady, appId, businessType]);

    // Handle Production Order Save
    const handleSaveProductionOrder = async () => {
        try {
            // Security: Rate limiting
            if (!apiRateLimiter.canMakeRequest()) {
                setMessage('❌ Too many requests. Please wait a moment.');
                return;
            }

            // Security: Input validation
            if (!validateInput(newProductionOrder.orderNumber, 'string') ||
                !validateInput(newProductionOrder.customerId, 'string') ||
                !validateInput(newProductionOrder.productId, 'string')) {
                setMessage('❌ Please fill all required fields.');
                return;
            }

            // Security: Data sanitization
            const sanitizedOrder = sanitizeManufacturingData(newProductionOrder);
            
            const orderData = {
                ...sanitizedOrder,
                businessType: businessType,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            // Security: Log the action
            logSecurityEvent('production_order_created', {
                orderNumber: sanitizedOrder.orderNumber,
                userId: userId,
                appId: appId
            });
            
            await addDoc(collection(db, `salaryPayments/${appId}/productionOrders`), orderData);
            
            setNewProductionOrder({
                orderNumber: '',
                customerId: '',
                productId: '',
                processId: '',
                quantity: 1,
                unit: 'Nos.',
                expectedCompletionDate: '',
                priority: 'Normal',
                status: 'Planned',
                notes: ''
            });
            
            setShowProductionOrderModal(false);
            setMessage('✅ Production order created successfully!');
        } catch (error) {
            console.error('Error creating production order:', error);
            setMessage('❌ Error creating production order');
        }
    };

    // Handle Process Definition Save
    const handleSaveProcessDefinition = async () => {
        try {
            const processData = {
                ...newProcessDefinition,
                businessType: businessType,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            await addDoc(collection(db, `salaryPayments/${appId}/processDefinitions`), processData);
            
            setNewProcessDefinition({
                processName: '',
                productName: '',
                description: '',
                category: '',
                estimatedTime: '',
                steps: [],
                materials: [],
                equipment: [],
                qualityChecks: [],
                keywords: []
            });
            
            setShowProcessDefinitionModal(false);
            setMessage('✅ Process definition created successfully!');
        } catch (error) {
            console.error('Error creating process definition:', error);
            setMessage('❌ Error creating process definition');
        }
    };

    // Calculate Metrics
    const calculateMetrics = () => {
        const totalOrders = productionOrders.length;
        const completedOrders = productionOrders.filter(order => order.status === 'Completed').length;
        const inProgressOrders = productionOrders.filter(order => order.status === 'In Progress').length;
        const completionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;

        return {
            totalOrders,
            completedOrders,
            inProgressOrders,
            completionRate
        };
    };

    const metrics = calculateMetrics();

    // Add Process Step
    const addProcessStep = () => {
        setNewProcessDefinition(prev => ({
            ...prev,
            steps: [...prev.steps, { ...newProcessStep }]
        }));
        
        setNewProcessStep({
            stepNumber: newProcessStep.stepNumber + 1,
            stepName: '',
            description: '',
            duration: '',
            materials: [],
            equipment: '',
            instructions: '',
            qualityCheck: ''
        });
    };

    // Add Material to Process
    const addMaterialToProcess = () => {
        setNewProcessDefinition(prev => ({
            ...prev,
            materials: [...prev.materials, { ...newMaterial }]
        }));
        
        setNewMaterial({
            materialId: '',
            quantity: 0,
            unit: '',
            cost: 0
        });
    };

    // ESC Key Handler
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (showBusinessTypeModal) {
                    setShowBusinessTypeModal(false);
                } else if (showProductionOrderModal) {
                    setShowProductionOrderModal(false);
                } else if (showProcessDefinitionModal) {
                    setShowProcessDefinitionModal(false);
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showBusinessTypeModal, showProductionOrderModal, showProcessDefinitionModal]);

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Manufacturing Management</h2>
                    <div className="flex items-center mt-2">
                        <span className="text-sm text-gray-600 mr-2">Business Type:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            businessType === 'pure-manufacturing' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                            {businessType === 'pure-manufacturing' ? '🏭 Pure Manufacturing' : '🏗️ Manufacturing cum Service'}
                        </span>
                        <button
                            onClick={() => setShowBusinessTypeModal(true)}
                            className="ml-2 text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                            Configure
                        </button>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => {
                            setNewProductionOrder(prev => ({ ...prev, orderNumber: generateOrderNumber() }));
                            setShowProductionOrderModal(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                        New Production Order
                    </button>
                    <button
                        onClick={() => setShowProcessDefinitionModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                        Define Process
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-600">Total Orders</h3>
                    <p className="text-2xl font-bold text-blue-800">{metrics.totalOrders}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-600">Completed</h3>
                    <p className="text-2xl font-bold text-green-800">{metrics.completedOrders}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-600">In Progress</h3>
                    <p className="text-2xl font-bold text-yellow-800">{metrics.inProgressOrders}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-600">Completion Rate</h3>
                    <p className="text-2xl font-bold text-purple-800">{metrics.completionRate}%</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'production-orders', label: 'Production Orders' },
                        { id: 'process-definitions', label: 'Process Definitions' },
                        { id: 'process-directory', label: 'Process Directory' },
                        { id: 'analytics', label: 'Analytics' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Production Orders Tab */}
                {activeTab === 'production-orders' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Production Orders</h3>
                            <button
                                onClick={() => {
                                    setNewProductionOrder(prev => ({ ...prev, orderNumber: generateOrderNumber() }));
                                    setShowProductionOrderModal(true);
                                }}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                            >
                                Add Order
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Order #
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Customer
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Product
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Process
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Quantity
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Priority
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {productionOrders.map((order) => (
                                        <tr key={order.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {order.orderNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {parties.find(p => p.id === order.customerId)?.firmName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {items.find(i => i.id === order.productId)?.itemName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {processDefinitions.find(p => p.id === order.processId)?.processName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {order.quantity} {order.unit}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                    order.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {order.priority}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Process Definitions Tab */}
                {activeTab === 'process-definitions' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Process Definitions</h3>
                            <button
                                onClick={() => setShowProcessDefinitionModal(true)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                            >
                                Define New Process
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {processDefinitions.map((process) => (
                                <div key={process.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900">{process.processName}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{process.productName}</p>
                                    <p className="text-xs text-gray-500 mt-2">{process.description}</p>
                                    <div className="mt-3 flex justify-between text-xs text-gray-500">
                                        <span>Steps: {process.steps.length}</span>
                                        <span>Materials: {process.materials.length}</span>
                                        <span>Time: {process.estimatedTime}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Process Directory Tab */}
                {activeTab === 'process-directory' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Process Directory</h3>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                            <p className="text-yellow-800">
                                🚧 Process Directory feature coming soon! This will provide a searchable directory of all manufacturing processes.
                            </p>
                        </div>
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Manufacturing Analytics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h4 className="text-lg font-medium mb-4">Production Efficiency</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span>Total Orders:</span>
                                        <span className="font-semibold">{metrics.totalOrders}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Completed Orders:</span>
                                        <span className="font-semibold text-green-600">{metrics.completedOrders}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>In Progress:</span>
                                        <span className="font-semibold text-yellow-600">{metrics.inProgressOrders}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2">
                                        <span>Completion Rate:</span>
                                        <span className="font-semibold text-blue-600">{metrics.completionRate}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h4 className="text-lg font-medium mb-4">Process Statistics</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span>Total Processes:</span>
                                        <span className="font-semibold">{processDefinitions.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Active Processes:</span>
                                        <span className="font-semibold text-blue-600">{processDefinitions.filter(p => p.status === 'Active').length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Business Type Configuration Modal */}
            {showBusinessTypeModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">Configure Business Type</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Press ESC to close
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Select your manufacturing business type:
                            </p>
                            
                            <div className="space-y-3">
                                <div className={`p-3 border rounded-lg cursor-pointer ${
                                    businessType === 'pure-manufacturing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                }`} onClick={() => setBusinessType('pure-manufacturing')}>
                                    <h4 className="font-medium text-gray-900">🏭 Pure Manufacturing</h4>
                                    <p className="text-sm text-gray-600">Primary manufacturing focus with detailed processes</p>
                                </div>
                                
                                <div className={`p-3 border rounded-lg cursor-pointer ${
                                    businessType === 'manufacturing-cum-service' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                                }`} onClick={() => setBusinessType('manufacturing-cum-service')}>
                                    <h4 className="font-medium text-gray-900">🏗️ Manufacturing cum Service</h4>
                                    <p className="text-sm text-gray-600">Hybrid approach with both manufacturing and service components</p>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setShowBusinessTypeModal(false)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Save Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Production Order Modal */}
            {showProductionOrderModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">New Production Order</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Press ESC to close
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Order Number</label>
                                    <input
                                        type="text"
                                        value={newProductionOrder.orderNumber}
                                        readOnly
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Customer</label>
                                    <select
                                        value={newProductionOrder.customerId}
                                        onChange={(e) => setNewProductionOrder({...newProductionOrder, customerId: e.target.value})}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    >
                                        <option value="">Select Customer</option>
                                        {parties.map(party => (
                                            <option key={party.id} value={party.id}>{party.firmName}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Product</label>
                                    <select
                                        value={newProductionOrder.productId}
                                        onChange={(e) => setNewProductionOrder({...newProductionOrder, productId: e.target.value})}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    >
                                        <option value="">Select Product</option>
                                        {items.map(item => (
                                            <option key={item.id} value={item.id}>{item.itemName}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Process</label>
                                    <select
                                        value={newProductionOrder.processId}
                                        onChange={(e) => setNewProductionOrder({...newProductionOrder, processId: e.target.value})}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    >
                                        <option value="">Select Process</option>
                                        {processDefinitions.map(process => (
                                            <option key={process.id} value={process.id}>{process.processName}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                        <input
                                            type="number"
                                            value={newProductionOrder.quantity}
                                            onChange={(e) => setNewProductionOrder({...newProductionOrder, quantity: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Unit</label>
                                        <select
                                            value={newProductionOrder.unit}
                                            onChange={(e) => setNewProductionOrder({...newProductionOrder, unit: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        >
                                            <option>Nos.</option>
                                            <option>Kg</option>
                                            <option>Liters</option>
                                            <option>Meters</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Expected Completion Date</label>
                                    <input
                                        type="date"
                                        value={newProductionOrder.expectedCompletionDate}
                                        onChange={(e) => setNewProductionOrder({...newProductionOrder, expectedCompletionDate: e.target.value})}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Priority</label>
                                        <select
                                            value={newProductionOrder.priority}
                                            onChange={(e) => setNewProductionOrder({...newProductionOrder, priority: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        >
                                            <option>Low</option>
                                            <option>Normal</option>
                                            <option>High</option>
                                            <option>Urgent</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Status</label>
                                        <select
                                            value={newProductionOrder.status}
                                            onChange={(e) => setNewProductionOrder({...newProductionOrder, status: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        >
                                            <option>Planned</option>
                                            <option>In Progress</option>
                                            <option>Completed</option>
                                            <option>Cancelled</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                                    <textarea
                                        value={newProductionOrder.notes}
                                        onChange={(e) => setNewProductionOrder({...newProductionOrder, notes: e.target.value})}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        rows="3"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setShowProductionOrderModal(false)}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveProductionOrder}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Process Definition Modal */}
            {showProcessDefinitionModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">Define Manufacturing Process</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Press ESC to close
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Basic Information */}
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900">Basic Information</h4>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Process Name</label>
                                        <input
                                            type="text"
                                            value={newProcessDefinition.processName}
                                            onChange={(e) => setNewProcessDefinition({...newProcessDefinition, processName: e.target.value})}
                                            placeholder="e.g., Biscuit Manufacturing Process"
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Product Name</label>
                                        <input
                                            type="text"
                                            value={newProcessDefinition.productName}
                                            onChange={(e) => setNewProcessDefinition({...newProcessDefinition, productName: e.target.value})}
                                            placeholder="e.g., Chocolate Biscuits"
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Category</label>
                                        <select
                                            value={newProcessDefinition.category}
                                            onChange={(e) => setNewProcessDefinition({...newProcessDefinition, category: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        >
                                            <option value="">Select Category</option>
                                            <option value="Food & Beverage">Food & Beverage</option>
                                            <option value="Textiles">Textiles</option>
                                            <option value="Electronics">Electronics</option>
                                            <option value="Chemicals">Chemicals</option>
                                            <option value="Construction">Construction</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Estimated Time</label>
                                        <input
                                            type="text"
                                            value={newProcessDefinition.estimatedTime}
                                            onChange={(e) => setNewProcessDefinition({...newProcessDefinition, estimatedTime: e.target.value})}
                                            placeholder="e.g., 2-3 hours per batch"
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                            value={newProcessDefinition.description}
                                            onChange={(e) => setNewProcessDefinition({...newProcessDefinition, description: e.target.value})}
                                            placeholder="Detailed description of the manufacturing process..."
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                            rows="3"
                                        />
                                    </div>
                                </div>
                                
                                {/* Process Steps */}
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900">Process Steps</h4>
                                    
                                    {/* Current Steps */}
                                    {newProcessDefinition.steps.map((step, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium">Step {step.stepNumber}</span>
                                                <button
                                                    onClick={() => {
                                                        const updatedSteps = newProcessDefinition.steps.filter((_, i) => i !== index);
                                                        setNewProcessDefinition({...newProcessDefinition, steps: updatedSteps});
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-600">{step.stepName}</p>
                                            <p className="text-xs text-gray-500">{step.description}</p>
                                        </div>
                                    ))}
                                    
                                    {/* Add New Step */}
                                    <div className="border border-dashed border-gray-300 rounded-lg p-4">
                                        <h5 className="text-sm font-medium text-gray-700 mb-3">Add New Step</h5>
                                        
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Step Name</label>
                                                <input
                                                    type="text"
                                                    value={newProcessStep.stepName}
                                                    onChange={(e) => setNewProcessStep({...newProcessStep, stepName: e.target.value})}
                                                    placeholder="e.g., Mix Ingredients"
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700">Description</label>
                                                <textarea
                                                    value={newProcessStep.description}
                                                    onChange={(e) => setNewProcessStep({...newProcessStep, description: e.target.value})}
                                                    placeholder="Detailed instructions for this step..."
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                                    rows="2"
                                                />
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Duration</label>
                                                    <input
                                                        type="text"
                                                        value={newProcessStep.duration}
                                                        onChange={(e) => setNewProcessStep({...newProcessStep, duration: e.target.value})}
                                                        placeholder="e.g., 30 minutes"
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Equipment</label>
                                                    <input
                                                        type="text"
                                                        value={newProcessStep.equipment}
                                                        onChange={(e) => setNewProcessStep({...newProcessStep, equipment: e.target.value})}
                                                        placeholder="e.g., Mixer"
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <button
                                                onClick={addProcessStep}
                                                className="w-full bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
                                            >
                                                Add Step
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Materials Section */}
                            <div className="mt-6">
                                <h4 className="font-medium text-gray-900 mb-4">Required Materials</h4>
                                
                                {/* Current Materials */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                    {newProcessDefinition.materials.map((material, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium">
                                                    {items.find(i => i.id === material.materialId)?.itemName || 'Unknown Material'}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const updatedMaterials = newProcessDefinition.materials.filter((_, i) => i !== index);
                                                        setNewProcessDefinition({...newProcessDefinition, materials: updatedMaterials});
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-600">
                                                {material.quantity} {material.unit} - ₹{material.cost}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Add New Material */}
                                <div className="border border-dashed border-gray-300 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-gray-700 mb-3">Add New Material</h5>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Material</label>
                                            <select
                                                value={newMaterial.materialId}
                                                onChange={(e) => setNewMaterial({...newMaterial, materialId: e.target.value})}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                            >
                                                <option value="">Select Material</option>
                                                {items.map(item => (
                                                    <option key={item.id} value={item.id}>{item.itemName}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Quantity</label>
                                            <input
                                                type="number"
                                                value={newMaterial.quantity}
                                                onChange={(e) => setNewMaterial({...newMaterial, quantity: e.target.value})}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Unit</label>
                                            <select
                                                value={newMaterial.unit}
                                                onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                            >
                                                <option value="">Unit</option>
                                                <option value="Kg">Kg</option>
                                                <option value="Liters">Liters</option>
                                                <option value="Nos">Nos</option>
                                                <option value="Meters">Meters</option>
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Cost</label>
                                            <input
                                                type="number"
                                                value={newMaterial.cost}
                                                onChange={(e) => setNewMaterial({...newMaterial, cost: e.target.value})}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-sm"
                                            />
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={addMaterialToProcess}
                                        className="mt-3 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                                    >
                                        Add Material
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setShowProcessDefinitionModal(false)}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveProcessDefinition}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    Save Process
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Display */}
            {message && (
                <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg ${
                    message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default ManufacturingNew; 