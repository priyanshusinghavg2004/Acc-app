import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

const Stock = ({ db, userId, isAuthReady, appId }) => {
    const [stockItems, setStockItems] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [itemQuantity, setItemQuantity] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [message, setMessage] = useState('');
    const [editingStockItemId, setEditingStockItemId] = useState(null);

    // Fetch all items to populate the dropdown
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
            const unsubscribe = onSnapshot(itemsCollectionRef, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                items.sort((a, b) => a.itemName.localeCompare(b.itemName));
                setItemsList(items);
            }, (error) => {
                console.error("Error fetching items for stock:", error);
                setMessage("Error fetching items for stock management.");
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Fetch stock data from Firestore
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
            const q = query(stockCollectionRef);

            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const stock = [];
                for (const docSnapshot of snapshot.docs) {
                    const stockData = docSnapshot.data();
                    if (stockData.itemId) {
                        const itemDocRef = doc(db, `artifacts/${appId}/users/${userId}/items`, stockData.itemId);
                        const itemDocSnap = await getDoc(itemDocRef);
                        if (itemDocSnap.exists()) {
                            stock.push({ id: docSnapshot.id, ...stockData, itemName: itemDocSnap.data().itemName, quantityMeasurement: itemDocSnap.data().quantityMeasurement });
                        } else {
                            stock.push({ id: docSnapshot.id, ...stockData, itemName: 'Item Not Found', quantityMeasurement: 'N/A' });
                        }
                    } else {
                        stock.push({ id: docSnapshot.id, ...stockData, itemName: 'N/A', quantityMeasurement: 'N/A' });
                    }
                }
                stock.sort((a, b) => a.itemName.localeCompare(b.itemName));
                setStockItems(stock);
            }, (error) => {
                console.error("Error fetching stock items:", error);
                setMessage("Error fetching stock items. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Function to clear stock form fields
    const clearStockForm = () => {
        setSelectedItemId('');
        setItemQuantity('');
        setPurchasePrice('');
        setEditingStockItemId(null);
        setMessage('');
    };

    // Handle adding/updating a stock item
    const handleSaveStock = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        if (!selectedItemId || !itemQuantity || !purchasePrice) {
            setMessage("Please select an Item, and fill in Quantity and Purchase Price.");
            return;
        }

        try {
            const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
            const stockData = {
                itemId: selectedItemId,
                itemQuantity: parseFloat(itemQuantity),
                purchasePrice: parseFloat(purchasePrice),
                timestamp: serverTimestamp()
            };

            if (editingStockItemId) {
                const stockRef = doc(db, `artifacts/${appId}/users/${userId}/stock`, editingStockItemId);
                await setDoc(stockRef, stockData);
                setMessage("Stock item updated successfully!");
            } else {
                await addDoc(stockCollectionRef, stockData);
                setMessage("Stock item added successfully!");
            }
            clearStockForm();
        } catch (error) {
            console.error("Error saving stock item:", error);
            setMessage("Error saving stock item. Please try again.");
        }
    };

    // Handle editing a stock item
    const handleEditStock = (stockItem) => {
        setEditingStockItemId(stockItem.id);
        setSelectedItemId(stockItem.itemId);
        setItemQuantity(stockItem.itemQuantity);
        setPurchasePrice(stockItem.purchasePrice);
        setMessage('Editing existing stock item.');
    };

    // Handle deleting a stock item
    const handleDeleteStock = async (stockItemId) => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        try {
            const stockRef = doc(db, `artifacts/${appId}/users/${userId}/stock`, stockItemId);
            await deleteDoc(stockRef);
            setMessage("Stock item deleted successfully!");
        } catch (error) {
            console.error("Error deleting stock item:", error);
            setMessage("Error deleting stock item. Please try again.");
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Stock Management</h2>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-4">{editingStockItemId ? 'Edit Stock Item' : 'Add New Stock Item'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                    <label htmlFor="itemSelect" className="block text-sm font-medium text-gray-700">Select Item</label>
                    <select
                        id="itemSelect"
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
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
                    <label htmlFor="itemQuantity" className="block text-sm font-medium text-gray-700">Quantity in Stock</label>
                    <input type="number" id="itemQuantity" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 100, 500" required />
                </div>
                <div>
                    <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">Purchase Price (₹)</label>
                    <input type="number" id="purchasePrice" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 1500.00" required />
                </div>
            </div>
            <div className="flex gap-4 mt-4">
                <button onClick={handleSaveStock}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                    {editingStockItemId ? 'Update Stock Item' : 'Add Stock Item'}
                </button>
                {editingStockItemId && (
                    <button onClick={clearStockForm}
                        className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        Cancel Edit
                    </button>
                )}
            </div>

            <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">Current Stock</h3>
            {stockItems.length === 0 ? (
                <p className="text-gray-600">No stock items added yet. Add your first stock item above!</p>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price (₹)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stockItems.map((stockItem) => (
                                <tr key={stockItem.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{stockItem.itemName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{stockItem.itemQuantity} {stockItem.quantityMeasurement}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{stockItem.purchasePrice}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                                        <button
                                            onClick={() => handleEditStock(stockItem)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteStock(stockItem.id)}
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
    );
};

export default Stock; 