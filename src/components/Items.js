import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';

const Items = ({ db, userId, isAuthReady, appId }) => {
    const [itemName, setItemName] = useState('');
    const [quantityMeasurement, setQuantityMeasurement] = useState('');
    const [defaultRate, setDefaultRate] = useState('');
    const [itemType, setItemType] = useState('Service');
    const [hsnCode, setHsnCode] = useState('');
    const [gstPercentage, setGstPercentage] = useState('');
    const [message, setMessage] = useState('');
    const [itemsList, setItemsList] = useState([]);
    const [editingItemId, setEditingItemId] = useState(null);

    // Fetch items data from Firestore
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
            const q = query(itemsCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                items.sort((a, b) => a.itemName.localeCompare(b.itemName));
                setItemsList(items);
            }, (error) => {
                console.error("Error fetching items:", error);
                setMessage("Error fetching items. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Function to clear item form fields
    const clearItemForm = () => {
        setItemName('');
        setQuantityMeasurement('');
        setDefaultRate('');
        setItemType('Service');
        setHsnCode('');
        setGstPercentage('');
        setEditingItemId(null);
        setMessage('');
    };

    // Handle adding/updating an item
    const handleSaveItem = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        if (!itemName || !quantityMeasurement) {
            setMessage("Item Name and Quantity Measurement are required.");
            return;
        }

        try {
            const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
            const itemData = {
                itemName,
                quantityMeasurement,
                defaultRate: parseFloat(defaultRate) || 0,
                itemType,
                hsnCode: hsnCode,
                gstPercentage: parseFloat(gstPercentage) || 0,
                timestamp: serverTimestamp()
            };

            if (editingItemId) {
                const itemRef = doc(db, `artifacts/${appId}/users/${userId}/items`, editingItemId);
                await setDoc(itemRef, itemData);
                setMessage("Item updated successfully!");
            } else {
                await addDoc(itemsCollectionRef, itemData);
                setMessage("Item added successfully!");
            }
            clearItemForm();
        } catch (error) {
            console.error("Error saving item:", error);
            setMessage("Error saving item. Please try again.");
        }
    };

    // Handle editing an item
    const handleEditItem = (item) => {
        setEditingItemId(item.id);
        setItemName(item.itemName);
        setQuantityMeasurement(item.quantityMeasurement);
        setDefaultRate(item.defaultRate);
        setItemType(item.itemType);
        setHsnCode(item.hsnCode || '');
        setGstPercentage(item.gstPercentage || '');
        setMessage('Editing existing item.');
    };

    // Handle deleting an item
    const handleDeleteItem = async (itemId) => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        try {
            const itemRef = doc(db, `artifacts/${appId}/users/${userId}/items`, itemId);
            await deleteDoc(itemRef);
            setMessage("Item deleted successfully!");
        } catch (error) {
            console.error("Error deleting item:", error);
            setMessage("Error deleting item. Please try again.");
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Items (Products & Services)</h2>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-4">{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                    <label htmlFor="itemName" className="block text-sm font-medium text-gray-700">Item Name</label>
                    <input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Flex Printing, Paper Roll" required />
                </div>
                <div>
                    <label htmlFor="quantityMeasurement" className="block text-sm font-medium text-gray-700">Quantity Measurement</label>
                    <input type="text" id="quantityMeasurement" value={quantityMeasurement} onChange={(e) => setQuantityMeasurement(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Sq. Ft., Pieces, Meters" required />
                </div>
                <div>
                    <label htmlFor="defaultRate" className="block text-sm font-medium text-gray-700">Default Rate (₹) (Optional)</label>
                    <input type="number" id="defaultRate" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 12, 5000" />
                </div>
                <div>
                    <label htmlFor="itemType" className="block text-sm font-medium text-gray-700">Item Type</label>
                    <select id="itemType" value={itemType} onChange={(e) => setItemType(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        required>
                        <option value="Service">Service</option>
                        <option value="Raw Material">Raw Material</option>
                        <option value="Finished Good">Finished Good</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="hsnCode" className="block text-sm font-medium text-gray-700">HSN Code (Optional)</label>
                    <input type="text" id="hsnCode" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 48025510" />
                </div>
                <div>
                    <label htmlFor="gstPercentage" className="block text-sm font-medium text-gray-700">GST Percentage</label>
                    <select id="gstPercentage" value={gstPercentage} onChange={(e) => setGstPercentage(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        required>
                        <option value="">-- Select GST % --</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                    </select>
                </div>
            </div>
            <div className="flex gap-4 mt-4">
                <button onClick={handleSaveItem}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                    {editingItemId ? 'Update Item' : 'Add Item'}
                </button>
                {editingItemId && (
                    <button onClick={clearItemForm}
                        className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        Cancel Edit
                    </button>
                )}
            </div>

            <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">All Items</h3>
            {itemsList.length === 0 ? (
                <p className="text-gray-600">No items added yet. Add your first item above!</p>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measurement</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default Rate (₹)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HSN Code</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST %</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {itemsList.map((item) => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.itemName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantityMeasurement}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{item.defaultRate}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.itemType}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.hsnCode || 'N/A'}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.gstPercentage ? `${item.gstPercentage}%` : 'N/A'}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                                        <button
                                            onClick={() => handleEditItem(item)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium mr-2"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
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

export default Items; 