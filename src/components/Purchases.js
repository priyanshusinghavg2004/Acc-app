import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

const Purchases = ({ db, userId, isAuthReady, appId }) => {
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSellerId, setSelectedSellerId] = useState('');
    const [sellerFirmName, setSellerFirmName] = useState('');
    const [sellerPersonName, setSellerPersonName] = useState('');
    const [sellerAddress, setSellerAddress] = useState('');
    const [sellerContact, setSellerContact] = useState('');
    const [sellerEmail, setSellerEmail] = useState('');
    const [sellerWhatsapp, setSellerWhatsapp] = useState('');
    const [sellerGSTIN, setSellerGSTIN] = useState('');

    const [purchaseRemark, setPurchaseRemark] = useState('');
    const [purchaseItems, setPurchaseItems] = useState([]);

    const [selectedPurchaseItemId, setSelectedPurchaseItemId] = useState('');
    const [currentPurchaseQuantity, setCurrentPurchaseQuantity] = useState('');
    const [currentPurchaseRate, setCurrentPurchaseRate] = useState('');
    const [currentPurchaseAmount, setCurrentPurchaseAmount] = useState(0);

    const [paymentProgress, setPaymentProgress] = useState('Payment Pending');
    const [amountPaid, setAmountPaid] = useState('');

    const [message, setMessage] = useState('');
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [sellersList, setSellersList] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [editingPurchaseBillId, setEditingPurchaseBillId] = useState(null);

    // Fetch sellers from Parties module and items from Items module
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
            const unsubscribeParties = onSnapshot(partiesCollectionRef, (snapshot) => {
                const sellers = [];
                snapshot.forEach((doc) => {
                    const partyData = doc.data();
                    if (partyData.partyType === 'Seller' || partyData.partyType === 'Both') {
                        sellers.push({ id: doc.id, ...partyData });
                    }
                });
                sellers.sort((a, b) => a.firmName.localeCompare(b.firmName));
                setSellersList(sellers);
            }, (error) => {
                console.error("Error fetching sellers:", error);
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
                console.error("Error fetching items for purchase module:", error);
            });

            return () => {
                unsubscribeParties();
                unsubscribeItems();
            };
        }
    }, [db, userId, isAuthReady, appId]);

    // Handle item selection from dropdown
    const handleItemSelect = (e) => {
        const itemId = e.target.value;
        setSelectedPurchaseItemId(itemId);
        const selectedItem = itemsList.find(item => item.id === itemId);
        if (selectedItem) {
            setCurrentPurchaseRate(selectedItem.defaultRate || '');
        } else {
            setCurrentPurchaseRate('');
        }
    };

    // Calculate current purchase item amount
    useEffect(() => {
        const numQuantity = parseFloat(currentPurchaseQuantity) || 0;
        const numRate = parseFloat(currentPurchaseRate) || 0;
        setCurrentPurchaseAmount((numQuantity * numRate).toFixed(2));
    }, [currentPurchaseQuantity, currentPurchaseRate]);

    // Fetch purchase data from Firestore
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const purchasesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
            const q = query(purchasesCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
                bills.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
                setPurchaseBills(bills);
            }, (error) => {
                console.error("Error fetching purchase bills:", error);
                setMessage("Error fetching purchase bills. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Function to clear purchase form fields
    const clearPurchaseForm = () => {
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        setSelectedSellerId('');
        setSellerFirmName('');
        setSellerPersonName('');
        setSellerAddress('');
        setSellerContact('');
        setSellerEmail('');
        setSellerWhatsapp('');
        setSellerGSTIN('');
        setPurchaseRemark('');
        setPurchaseItems([]);
        setSelectedPurchaseItemId('');
        setCurrentPurchaseQuantity('');
        setCurrentPurchaseRate('');
        setCurrentPurchaseAmount(0);
        setPaymentProgress('Payment Pending');
        setAmountPaid('');
        setEditingPurchaseBillId(null);
        setMessage('');
    };

    // Handle selection of a seller from the dropdown
    const handleSellerSelect = (e) => {
        const selectedId = e.target.value;
        setSelectedSellerId(selectedId);
        const selectedSeller = sellersList.find(seller => seller.id === selectedId);

        if (selectedSeller) {
            setSellerFirmName(selectedSeller.firmName);
            setSellerPersonName(selectedSeller.personName || '');
            setSellerAddress(selectedSeller.address || '');
            setSellerContact(selectedSeller.contact || '');
            setSellerEmail(selectedSeller.email || '');
            setSellerWhatsapp(selectedSeller.whatsapp || '');
            setSellerGSTIN(selectedSeller.gstin || '');
        } else {
            setSellerFirmName('');
            setSellerPersonName('');
            setSellerAddress('');
            setSellerContact('');
            setSellerEmail('');
            setSellerWhatsapp('');
            setSellerGSTIN('');
        }
    };

    // Add current item to the purchaseItems list
    const handleAddPurchaseItem = () => {
        if (!selectedPurchaseItemId || !currentPurchaseQuantity || !currentPurchaseRate) {
            setMessage("Please select an Item, and fill in Quantity and Rate for the purchase item.");
            return;
        }

        const selectedItemDetails = itemsList.find(item => item.id === selectedPurchaseItemId);
        if (!selectedItemDetails) {
            setMessage("Selected item not found in master data.");
            return;
        }

        const newItem = {
            itemId: selectedPurchaseItemId,
            itemName: selectedItemDetails.itemName,
            quantityMeasurement: selectedItemDetails.quantityMeasurement,
            quantity: parseFloat(currentPurchaseQuantity),
            rate: parseFloat(currentPurchaseRate),
            itemAmount: parseFloat(currentPurchaseAmount),
        };

        setPurchaseItems([...purchaseItems, newItem]);
        setMessage('Item added to current purchase bill. Add more items or save the bill.');
        setSelectedPurchaseItemId('');
        setCurrentPurchaseQuantity('');
        setCurrentPurchaseRate('');
        setCurrentPurchaseAmount(0);
    };

    // Remove an item from the purchaseItems list
    const handleRemovePurchaseItem = (indexToRemove) => {
        setPurchaseItems(purchaseItems.filter((_, index) => index !== indexToRemove));
        setMessage('Item removed from the purchase bill.');
    };

    // Handle editing an existing purchase bill
    const handleEditPurchaseBill = (bill) => {
        setEditingPurchaseBillId(bill.id);
        setPurchaseDate(bill.purchaseDate);
        setSelectedSellerId(bill.sellerId || '');
        setSellerFirmName(bill.sellerFirmName || '');
        setSellerPersonName(bill.sellerPersonName || '');
        setSellerAddress(bill.sellerAddress || '');
        setSellerContact(bill.contact || '');
        setSellerEmail(bill.email || '');
        setSellerWhatsapp(bill.whatsapp || '');
        setSellerGSTIN(bill.gstin || '');
        setPurchaseRemark(bill.remark || '');
        setPurchaseItems(bill.items || []);
        setPaymentProgress(bill.paymentProgress || 'Payment Pending');
        setAmountPaid(bill.amountPaid || '');
        setMessage('Editing existing purchase bill. Make changes and click "Update Bill".');
        setSelectedPurchaseItemId('');
        setCurrentPurchaseQuantity('');
        setCurrentPurchaseRate('');
        setCurrentPurchaseAmount(0);
    };

    // Handle saving or updating the entire purchase bill to Firestore
    const handleSavePurchaseBill = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }

        if (!purchaseDate || !selectedSellerId || purchaseItems.length === 0) {
            setMessage("Please fill in Purchase Date, select a Seller, and add at least one item to the bill.");
            return;
        }

        const totalPurchaseAmount = purchaseItems.reduce((sum, item) => sum + item.itemAmount, 0);

        try {
            const purchasesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
            const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);

            const billData = {
                purchaseDate: purchaseDate,
                sellerId: selectedSellerId,
                sellerFirmName: sellerFirmName,
                sellerPersonName: sellerPersonName,
                sellerAddress: sellerAddress,
                contact: sellerContact,
                email: sellerEmail,
                whatsapp: sellerWhatsapp,
                gstin: sellerGSTIN,
                remark: purchaseRemark,
                items: purchaseItems,
                totalAmount: totalPurchaseAmount.toFixed(2),
                paymentProgress: paymentProgress,
                amountPaid: parseFloat(amountPaid) || 0,
                timestamp: serverTimestamp()
            };

            if (editingPurchaseBillId) {
                const billRef = doc(db, `artifacts/${appId}/users/${userId}/purchaseBills`, editingPurchaseBillId);
                await setDoc(billRef, billData);
                setMessage("Purchase bill updated successfully!");
            } else {
                await addDoc(purchasesCollectionRef, billData);
                setMessage("Purchase bill saved successfully!");
            }

            // Update stock for each item in the bill
            for (const item of purchaseItems) {
                const stockDocRef = doc(db, stockCollectionRef, item.itemId);
                const stockDocSnap = await getDoc(stockDocRef);

                if (stockDocSnap.exists()) {
                    const currentStock = stockDocSnap.data();
                    const updatedQuantity = (currentStock.itemQuantity || 0) + item.quantity;
                    await setDoc(stockDocRef, {
                        itemQuantity: updatedQuantity,
                        purchasePrice: item.rate,
                        timestamp: serverTimestamp()
                    }, { merge: true });
                } else {
                    await setDoc(stockDocRef, {
                        itemId: item.itemId,
                        itemName: item.itemName,
                        quantityMeasurement: item.quantityMeasurement,
                        itemQuantity: item.quantity,
                        purchasePrice: item.rate,
                        timestamp: serverTimestamp()
                    });
                }
            }

            clearPurchaseForm();
        } catch (error) {
            console.error("Error saving/updating purchase bill or stock:", error);
            setMessage("Error saving/updating purchase bill or stock. Please try again.");
        }
    };

    // Handle deleting a purchase bill
    const handleDeletePurchaseBill = async (billId) => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }

        try {
            const billRef = doc(db, `artifacts/${appId}/users/${userId}/purchaseBills`, billId);
            const billToDeleteSnap = await getDoc(billRef);
            const billData = billToDeleteSnap.data();

            await deleteDoc(billRef);
            setMessage("Bill deleted successfully!");

            // Revert stock for each item in the deleted bill
            if (billData && billData.items) {
                const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
                for (const item of billData.items) {
                    const stockDocRef = doc(db, stockCollectionRef, item.itemId);
                    const stockDocSnap = await getDoc(stockDocRef);

                    if (stockDocSnap.exists()) {
                        const currentStock = stockDocSnap.data();
                        const updatedQuantity = (currentStock.itemQuantity || 0) - item.quantity;
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
            }

        } catch (error) {
            console.error("Error deleting bill or reverting stock:", error);
            setMessage("Error deleting bill or reverting stock. Please try again.");
        }
    };

    return (
        <>
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Purchase Management</h2>

                {message && (
                    <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}

                <h3 className="text-xl font-bold text-gray-800 mb-4">{editingPurchaseBillId ? 'Edit Existing Purchase Bill' : 'Create New Purchase Bill'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">Purchase Date</label>
                        <input
                            type="date"
                            id="purchaseDate"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="sellerSelect" className="block text-sm font-medium text-gray-700">Select Seller (Firm Name)</label>
                        <select
                            id="sellerSelect"
                            value={selectedSellerId}
                            onChange={handleSellerSelect}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="">-- Select Seller --</option>
                            {sellersList.map(seller => (
                                <option key={seller.id} value={seller.id}>{seller.firmName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="sellerPersonName" className="block text-sm font-medium text-gray-700">Contact Person Name</label>
                        <input
                            type="text"
                            id="sellerPersonName"
                            value={sellerPersonName}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="sellerAddress" className="block text-sm font-medium text-gray-700">Address</label>
                        <textarea
                            id="sellerAddress"
                            value={sellerAddress}
                            readOnly
                            rows="2"
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="sellerContact" className="block text-sm font-medium text-gray-700">Contact No.</label>
                        <input
                            type="text"
                            id="sellerContact"
                            value={sellerContact}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="sellerEmail" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            id="sellerEmail"
                            value={sellerEmail}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="sellerWhatsapp" className="block text-sm font-medium text-gray-700">WhatsApp No.</label>
                        <input
                            type="text"
                            id="sellerWhatsapp"
                            value={sellerWhatsapp}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="sellerGSTIN" className="block text-sm font-medium text-gray-700">GSTIN (Optional)</label>
                        <input
                            type="text"
                            id="sellerGSTIN"
                            value={sellerGSTIN}
                            readOnly
                            className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="purchaseRemark" className="block text-sm font-medium text-gray-700">General Remark (Optional)</label>
                        <textarea
                            id="purchaseRemark"
                            value={purchaseRemark}
                            onChange={(e) => setPurchaseRemark(e.target.value)}
                            rows="2"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Any additional notes for this purchase"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="paymentProgress" className="block text-sm font-medium text-gray-700">Payment Progress</label>
                        <select
                            id="paymentProgress"
                            value={paymentProgress}
                            onChange={(e) => setPaymentProgress(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="Payment Pending">Payment Pending</option>
                            <option value="Advance Paid">Advance Paid</option>
                            <option value="Partially Paid">Partially Paid</option>
                            <option value="Payment Paid">Payment Paid</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700">Amount Paid (₹)</label>
                        <input
                            type="number"
                            id="amountPaid"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 1000.00"
                        />
                    </div>
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-4">Add Purchase Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label htmlFor="selectedPurchaseItemId" className="block text-sm font-medium text-gray-700">Select Item</label>
                        <select
                            id="selectedPurchaseItemId"
                            value={selectedPurchaseItemId}
                            onChange={handleItemSelect}
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
                        <label htmlFor="currentPurchaseQuantity" className="block text-sm font-medium text-gray-700">Quantity</label>
                        <input
                            type="number"
                            id="currentPurchaseQuantity"
                            value={currentPurchaseQuantity}
                            onChange={(e) => setCurrentPurchaseQuantity(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 1, 100"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="currentPurchaseRate" className="block text-sm font-medium text-gray-700">Rate (₹)</label>
                        <input
                            type="number"
                            id="currentPurchaseRate"
                            value={currentPurchaseRate}
                            onChange={(e) => setCurrentPurchaseRate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 5000, 250"
                            required
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleAddPurchaseItem}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Add Item to Purchase Bill
                        </button>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 flex justify-between items-center bg-gray-50 p-3 rounded-md">
                        <p className="text-lg font-medium text-gray-800">Item Amount: <span className="font-semibold text-blue-700">₹{currentPurchaseAmount}</span></p>
                    </div>
                </div>

                {purchaseItems.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Items in Current Purchase Bill</h3>
                        <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measurement</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {purchaseItems.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.itemName}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantity}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantityMeasurement}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{item.rate}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{item.itemAmount}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">
                                                <button
                                                    onClick={() => handleRemovePurchaseItem(index)}
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
                                        <td colSpan="4" className="px-4 py-2 text-right text-base font-bold text-gray-900">Total Purchase Amount:</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-base font-bold text-blue-700">
                                            ₹{purchaseItems.reduce((sum, item) => sum + item.itemAmount, 0).toFixed(2)}
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
                        onClick={handleSavePurchaseBill}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        {editingPurchaseBillId ? 'Update Purchase Bill' : 'Save Complete Purchase Bill'}
                    </button>
                    {editingPurchaseBillId && (
                        <button
                            onClick={clearPurchaseForm}
                            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">Recent Purchase Bills</h3>
                {purchaseBills.length === 0 ? (
                    <p className="text-gray-600">No purchase bills yet. Create your first bill above!</p>
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
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Progress</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">General Remark</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                    <th className="px-4 py-2 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {purchaseBills.map((bill) => (
                                    <tr key={bill.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.purchaseDate}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.sellerFirmName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.sellerPersonName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.contact}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.email}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.whatsapp}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.gstin}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.totalAmount}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{bill.amountPaid}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">
                                            ₹{(parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid)).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{bill.paymentProgress}</td>
                                        <td className="px-4 py-2 text-sm text-gray-800 max-w-xs overflow-hidden text-ellipsis">{bill.remark}</td>
                                        <td className="px-4 py-2 text-sm text-gray-800">
                                            <ul className="list-disc list-inside">
                                                {bill.items && bill.items.map((item, idx) => (
                                                    <li key={idx}>
                                                        {item.itemName} ({item.quantity} {item.quantityMeasurement}) @ ₹{item.rate}/unit = ₹{item.itemAmount}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => handleEditPurchaseBill(bill)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeletePurchaseBill(bill.id)}
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

export default Purchases; 