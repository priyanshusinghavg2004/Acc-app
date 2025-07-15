import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

const Sales = ({ db, userId, isAuthReady, appId }) => {
    // State for the current bill being created or edited
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerFirmName, setCustomerFirmName] = useState('');
    const [customerPersonName, setCustomerPersonName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerWhatsapp, setCustomerWhatsapp] = useState('');
    const [customerGSTIN, setCustomerGSTIN] = useState('');

    const [workProgress, setWorkProgress] = useState('Ordered');
    const [paymentProgress, setPaymentProgress] = useState('Payment Pending');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [billRemark, setBillRemark] = useState('');
    const [billItems, setBillItems] = useState([]);

    // States for adding items to sales bill
    const [selectedSalesItemId, setSelectedSalesItemId] = useState('');
    const [currentNos, setCurrentNos] = useState('');
    const [currentLength, setCurrentLength] = useState('');
    const [currentHeight, setCurrentHeight] = useState('');
    const [currentRate, setCurrentRate] = useState('');
    const [currentArea, setCurrentArea] = useState(0);
    const [currentItemAmount, setCurrentItemAmount] = useState(0);

    // State for displaying messages
    const [message, setMessage] = useState('');
    // State for fetched sales bills
    const [salesBills, setSalesBills] = useState([]);
    // State for available buyers from Parties module
    const [buyersList, setBuyersList] = useState([]);
    // State for available items from Items module
    const [itemsList, setItemsList] = useState([]);

    // State for editing mode
    const [editingBillId, setEditingBillId] = useState(null);


    // Fetch buyers from Parties module and items from Items module
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
            const unsubscribeParties = onSnapshot(partiesCollectionRef, (snapshot) => {
                const buyers = [];
                snapshot.forEach((doc) => {
                    const partyData = doc.data();
                    if (partyData.partyType === 'Buyer' || partyData.partyType === 'Both') {
                        buyers.push({ id: doc.id, ...partyData });
                    }
                });
                buyers.sort((a, b) => a.firmName.localeCompare(b.firmName));
                setBuyersList(buyers);
            }, (error) => {
                console.error("Error fetching buyers:", error);
            });

            const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
            const unsubscribeItems = onSnapshot(itemsCollectionRef, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                items.sort((a, b) => a.itemName.localeCompare(b.itemName));
                setItemsList(items);
            }, (error) => {
                console.error("Error fetching items for sales module:", error);
            });

            return () => {
                unsubscribeParties();
                unsubscribeItems();
            };
        }
    }, [db, userId, isAuthReady, appId]);

    // Handle item selection from dropdown
    const handleSalesItemSelect = (e) => {
        const itemId = e.target.value;
        setSelectedSalesItemId(itemId);
        const selectedItem = itemsList.find(item => item.id === itemId);
        if (selectedItem) {
            setCurrentRate(selectedItem.defaultRate || '');
        } else {
            setCurrentRate('');
        }
    };

    // Calculate Area and Item Amount for the current item
    useEffect(() => {
        const numNos = parseFloat(currentNos) || 0;
        const numLength = parseFloat(currentLength) || 0;
        const numHeight = parseFloat(currentHeight) || 0;
        const numRate = parseFloat(currentRate) || 0;

        let calculatedArea = 0;
        let calculatedItemAmount = 0;

        if (numLength > 0 && numHeight > 0) {
            calculatedArea = numLength * numHeight;
            calculatedItemAmount = numNos * calculatedArea * numRate;
        } else {
            calculatedItemAmount = numNos * numRate;
        }

        setCurrentArea(calculatedArea.toFixed(2));
        setCurrentItemAmount(calculatedItemAmount.toFixed(2));
    }, [currentNos, currentLength, currentHeight, currentRate]);

    // Fetch sales data from Firestore
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
            const q = query(salesCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
                bills.sort((a, b) => new Date(b.billDate) - new Date(a.billDate));
                setSalesBills(bills);
            }, (error) => {
                console.error("Error fetching sales bills:", error);
                setMessage("Error fetching sales bills. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Function to clear all form fields
    const clearForm = () => {
        setBillDate(new Date().toISOString().split('T')[0]);
        setSelectedCustomerId('');
        setCustomerFirmName('');
        setCustomerPersonName('');
        setCustomerAddress('');
        setCustomerContact('');
        setCustomerEmail('');
        setCustomerWhatsapp('');
        setCustomerGSTIN('');
        setWorkProgress('Ordered');
        setPaymentProgress('Payment Pending');
        setPaymentAmount('');
        setBillRemark('');
        setBillItems([]);
        setSelectedSalesItemId('');
        setCurrentNos('');
        setCurrentLength('');
        setCurrentHeight('');
        setCurrentRate('');
        setCurrentArea(0);
        setCurrentItemAmount(0);
        setEditingBillId(null);
        setMessage('');
    };

    // Handle selection of a customer from the dropdown
    const handleCustomerSelect = (e) => {
        const selectedId = e.target.value;
        setSelectedCustomerId(selectedId);
        const selectedCustomer = buyersList.find(buyer => buyer.id === selectedId);

        if (selectedCustomer) {
            setCustomerFirmName(selectedCustomer.firmName);
            setCustomerPersonName(selectedCustomer.personName || '');
            setCustomerAddress(selectedCustomer.address || '');
            setCustomerContact(selectedCustomer.contact || '');
            setCustomerEmail(selectedCustomer.email || '');
            setCustomerWhatsapp(selectedCustomer.whatsapp || '');
            setCustomerGSTIN(selectedCustomer.gstin || '');
        } else {
            setCustomerFirmName('');
            setCustomerPersonName('');
            setCustomerAddress('');
            setCustomerContact('');
            setCustomerEmail('');
            setCustomerWhatsapp('');
            setCustomerGSTIN('');
        }
    };

    // Add current item to the billItems list
    const handleAddItemToBill = () => {
        if (!selectedSalesItemId || !currentNos || !currentRate) {
            setMessage("Please select an Item, and fill in Nos and Rate for the item.");
            return;
        }

        const selectedItemDetails = itemsList.find(item => item.id === selectedSalesItemId);
        if (!selectedItemDetails) {
            setMessage("Selected item not found in master data.");
            return;
        }

        const newItem = {
            itemId: selectedSalesItemId,
            workType: selectedItemDetails.itemName,
            quantityMeasurement: selectedItemDetails.quantityMeasurement,
            nos: parseFloat(currentNos),
            length: parseFloat(currentLength) || 0,
            height: parseFloat(currentHeight) || 0,
            area: parseFloat(currentArea),
            rate: parseFloat(currentRate),
            itemAmount: parseFloat(currentItemAmount),
        };

        setBillItems([...billItems, newItem]);
        setMessage('Item added to current bill. Add more items or save the bill.');
        setSelectedSalesItemId('');
        setCurrentNos('');
        setCurrentLength('');
        setCurrentHeight('');
        setCurrentRate('');
        setCurrentArea(0);
        setCurrentItemAmount(0);
    };

    // Remove an item from the billItems list
    const handleRemoveItem = (indexToRemove) => {
        setBillItems(billItems.filter((_, index) => index !== indexToRemove));
        setMessage('Item removed from the bill.');
    };

    // Handle editing an existing bill
    const handleEditBill = (bill) => {
        setEditingBillId(bill.id);
        setBillDate(bill.billDate);
        setSelectedCustomerId(bill.customerId || '');
        setCustomerFirmName(bill.customerFirmName || '');
        setCustomerPersonName(bill.customerPersonName || '');
        setCustomerAddress(bill.customerAddress || '');
        setCustomerContact(bill.contact || '');
        setCustomerEmail(bill.email || '');
        setCustomerWhatsapp(bill.whatsapp || '');
        setCustomerGSTIN(bill.gstin || '');
        setWorkProgress(bill.workProgress || 'Ordered');
        setPaymentProgress(bill.paymentProgress || 'Payment Pending');
        setPaymentAmount(bill.paymentAmount || '');
        setBillRemark(bill.remark || '');
        setBillItems(bill.items || []);
        setMessage('Editing existing bill. Make changes and click "Update Bill".');
        setSelectedSalesItemId('');
        setCurrentNos('');
        setCurrentLength('');
        setCurrentHeight('');
        setCurrentRate('');
        setCurrentArea(0);
        setCurrentItemAmount(0);
    };

    // Handle saving or updating the entire bill to Firestore
    const handleSaveBill = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }

        if (!billDate || !selectedCustomerId || billItems.length === 0) {
            setMessage("Please fill in Bill Date, select a Customer, and add at least one item to the bill.");
            return;
        }

        const totalBillAmount = billItems.reduce((sum, item) => sum + item.itemAmount, 0);

        try {
            const salesBillsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
            const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);

            // Check stock availability before saving
            for (const item of billItems) {
                const stockDocRef = doc(db, stockCollectionRef, item.itemId);
                const stockDocSnap = await getDoc(stockDocRef);

                if (!stockDocSnap.exists() || (stockDocSnap.data().itemQuantity || 0) < item.nos) {
                    setMessage(`Error: Insufficient stock for item "${item.workType}". Available: ${stockDocSnap.exists() ? stockDocSnap.data().itemQuantity : 0}, Required: ${item.nos}`);
                    return;
                }
            }

            const billData = {
                billDate: billDate,
                customerId: selectedCustomerId,
                customerFirmName: customerFirmName,
                customerPersonName: customerPersonName,
                customerAddress: customerAddress,
                contact: customerContact,
                email: customerEmail,
                whatsapp: customerWhatsapp,
                gstin: customerGSTIN,
                workProgress: workProgress,
                paymentProgress: paymentProgress,
                paymentAmount: parseFloat(paymentAmount) || 0,
                remark: billRemark,
                items: billItems,
                totalAmount: totalBillAmount.toFixed(2),
                timestamp: serverTimestamp()
            };

            if (editingBillId) {
                const billRef = doc(db, `artifacts/${appId}/users/${userId}/salesBills`, editingBillId);
                await setDoc(billRef, billData);
                setMessage("Bill updated successfully!");
            } else {
                await addDoc(salesBillsCollectionRef, billData);
                setMessage("Bill saved successfully!");
            }

            // Deduct from stock for each item in the bill
            for (const item of billItems) {
                const stockDocRef = doc(db, stockCollectionRef, item.itemId);
                const stockDocSnap = await getDoc(stockDocRef);

                if (stockDocSnap.exists()) {
                    const currentStock = stockDocSnap.data();
                    const updatedQuantity = (currentStock.itemQuantity || 0) - item.nos;
                    if (updatedQuantity > 0) {
                        await setDoc(stockDocRef, {
                            itemQuantity: updatedQuantity,
                            timestamp: serverTimestamp()
                        }, { merge: true });
                    } else {
                        await deleteDoc(stockDocRef);
                    }
                }
            }

            clearForm();
        } catch (error) {
            console.error("Error saving/updating bill or stock:", error);
            setMessage("Error saving/updating bill or stock. Please try again.");
        }
    };

    // Handle deleting a bill
    const handleDeleteBill = async (billId) => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }

        try {
            const billRef = doc(db, `artifacts/${appId}/users/${userId}/salesBills`, billId);
            const billToDeleteSnap = await getDoc(billRef);
            const billData = billToDeleteSnap.data();

            await deleteDoc(billRef);
            setMessage("Bill deleted successfully!");

            // Revert stock for each item in the deleted bill
            if (billData && billData.items) {
                const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
                for (const item of billData.items) {
                    const stockDocRef = doc(stockCollectionRef, item.itemId);
                    const stockDocSnap = await getDoc(stockDocRef);

                    if (stockDocSnap.exists()) {
                        const currentStock = stockDocSnap.data();
                        const updatedQuantity = (currentStock.itemQuantity || 0) + item.nos;
                        await setDoc(stockDocRef, {
                            itemQuantity: updatedQuantity,
                            timestamp: serverTimestamp()
                        }, { merge: true });
                    } else {
                        const itemDetails = itemsList.find(i => i.id === item.itemId);
                        await setDoc(stockDocRef, {
                            itemId: item.itemId,
                            itemName: itemDetails ? itemDetails.itemName : item.workType,
                            quantityMeasurement: itemDetails ? itemDetails.quantityMeasurement : 'N/A',
                            itemQuantity: item.nos,
                            purchasePrice: 0,
                            timestamp: serverTimestamp()
                        });
                    }
                }
            }

        } catch (error) {
            console.error("Error deleting bill or reverting stock:", error);
            setMessage("Error deleting bill or reverting stock. Please try again.");
        }
    };

    return (
        <>
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Sales Management</h2>

                {message && (
                    <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}

                <h3 className="text-xl font-bold text-gray-800 mb-4">{editingBillId ? 'Edit Existing Bill' : 'Create New Bill'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label htmlFor="billDate" className="block text-sm font-medium text-gray-700">Bill Date</label>
                        <input
                            type="date"
                            id="billDate"
                            value={billDate}
                            onChange={(e) => setBillDate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="customerSelect" className="block text-sm font-medium text-gray-700">Select Buyer (Firm Name)</label>
                        <select
                            id="customerSelect"
                            value={selectedCustomerId}
                            onChange={handleCustomerSelect}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="">-- Select Customer --</option>
                            {buyersList.map(buyer => (
                                <option key={buyer.id} value={buyer.id}>{buyer.firmName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="customerPersonName" className="block text-sm font-medium text-gray-700">Contact Person Name</label>
                        <input
                            type="text"
                            id="customerPersonName"
                            value={customerPersonName}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="customerAddress" className="block text-sm font-medium text-gray-700">Address</label>
                        <textarea
                            id="customerAddress"
                            value={customerAddress}
                            readOnly
                            rows="2"
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="customerContact" className="block text-sm font-medium text-gray-700">Contact No.</label>
                        <input
                            type="text"
                            id="customerContact"
                            value={customerContact}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            id="customerEmail"
                            value={customerEmail}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="customerWhatsapp" className="block text-sm font-medium text-gray-700">WhatsApp No.</label>
                        <input
                            type="text"
                            id="customerWhatsapp"
                            value={customerWhatsapp}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="customerGSTIN" className="block text-sm font-medium text-700">GSTIN (Optional)</label>
                        <input
                            type="text"
                            id="customerGSTIN"
                            value={customerGSTIN}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="workProgress" className="block text-sm font-medium text-gray-700">Work Progress</label>
                        <select
                            id="workProgress"
                            value={workProgress}
                            onChange={(e) => setWorkProgress(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="Ordered">Ordered</option>
                            <option value="Order Accepted">Order Accepted</option>
                            <option value="At Designing">At Designing</option>
                            <option value="At Printing">At Printing</option>
                            <option value="At Fitting">At Fitting</option>
                            <option value="Work Completed">Work Completed</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="paymentProgress" className="block text-sm font-medium text-gray-700">Payment Progress</label>
                        <select
                            id="paymentProgress"
                            value={paymentProgress}
                            onChange={(e) => setPaymentProgress(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="Advance">Advance</option>
                            <option value="Payment Pending">Payment Pending</option>
                            <option value="Payment Received">Payment Received</option>
                            <option value="Order Cancelled">Order Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700">Payment Amount (₹)</label>
                        <input
                            type="number"
                            id="paymentAmount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 500.00"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <label htmlFor="billRemark" className="block text-sm font-medium text-gray-700">General Remark (Optional)</label>
                        <textarea
                            id="billRemark"
                            value={billRemark}
                            onChange={(e) => setBillRemark(e.target.value)}
                            rows="2"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Any additional notes for this bill"
                        ></textarea>
                    </div>
                </div>

                {/* Add Item Section */}
                <h3 className="text-xl font-bold text-gray-800 mb-4">Add Item to Bill</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label htmlFor="selectedSalesItemId" className="block text-sm font-medium text-gray-700">Select Item (Work Type)</label>
                        <select
                            id="selectedSalesItemId"
                            value={selectedSalesItemId}
                            onChange={handleSalesItemSelect}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="">-- Select an Item --</option>
                            {itemsList.map(item => (
                                <option key={item.id} value={item.id}>{item.itemName} ({item.quantityMeasurement})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="currentNos" className="block text-sm font-medium text-gray-700">Nos (Quantity)</label>
                        <input
                            type="number"
                            id="currentNos"
                            value={currentNos}
                            onChange={(e) => setCurrentNos(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 1, 5000"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="currentLength" className="block text-sm font-medium text-gray-700">Length (Optional)</label>
                        <input
                            type="number"
                            id="currentLength"
                            value={currentLength}
                            onChange={(e) => setCurrentLength(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 10 (for area calculation)"
                        />
                    </div>
                    <div>
                        <label htmlFor="currentHeight" className="block text-sm font-medium text-gray-700">Height (Optional)</label>
                        <input
                            type="number"
                            id="currentHeight"
                            value={currentHeight}
                            onChange={(e) => setCurrentHeight(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 5 (for area calculation)"
                        />
                    </div>
                    <div>
                        <label htmlFor="currentRate" className="block text-sm font-medium text-gray-700">Rate</label>
                        <input
                            type="number"
                            id="currentRate"
                            value={currentRate}
                            onChange={(e) => setCurrentRate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 7, 12, 130"
                            required
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleAddItemToBill}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Add Item to Bill
                        </button>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 flex justify-between items-center bg-gray-50 p-3 rounded-md">
                        <p className="text-lg font-medium text-gray-800">Item Area: <span className="font-semibold text-blue-700">{currentArea}</span></p>
                        <p className="text-lg font-medium text-gray-800">Item Amount: <span className="font-semibold text-blue-700">₹{currentItemAmount}</span></p>
                    </div>
                </div>

                {/* Items in Current Bill Table */}
                {billItems.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Items in Current Bill</h3>
                        <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Type</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nos</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Length</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Height</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {billItems.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.workType}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.nos}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.length}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.height}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.area}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.rate}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{item.itemAmount}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">
                                                <button
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-red-600 hover:text-red-800 font-medium"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan="6" className="px-4 py-2 text-right text-base font-bold text-gray-900">Total Bill Amount:</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-base font-bold text-blue-700">
                                            ₹{billItems.reduce((sum, item) => sum + item.itemAmount, 0).toFixed(2)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
                <div className="flex gap-4 mt-4">
                    <button
                        onClick={handleSaveBill}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        {editingBillId ? 'Update Bill' : 'Save Complete Bill'}
                    </button>
                    {editingBillId && (
                        <button
                            onClick={clearForm}
                            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>


                <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">Recent Sales Bills</h3>
                {salesBills.length === 0 ? (
                    <p className="text-gray-600">No sales bills yet. Create your first bill above!</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firm Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact No.</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GSTIN</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Progress</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Progress</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Amount</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">General Remark</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                    <th className="px-4 py-2 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {salesBills.map((bill) => (
                                    <tr key={bill.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.billDate}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.customerFirmName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.customerPersonName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.contact}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.email}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.whatsapp}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.gstin}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.workProgress}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.paymentProgress}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.paymentAmount}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.totalAmount}</td>
                                        <td className="px-4 py-2 text-sm text-gray-800 max-w-xs overflow-hidden text-ellipsis">{bill.remark}</td>
                                        <td className="px-4 py-2 text-sm text-gray-800">
                                            <ul className="list-disc list-inside">
                                                {bill.items && bill.items.map((item, idx) => (
                                                    <li key={idx}>
                                                        {item.workType} ({item.nos} {item.quantityMeasurement}) @ ₹{item.rate}/unit = ₹{item.itemAmount}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => handleEditBill(bill)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBill(bill.id)}
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
        </>
    );
};

export default Sales; 