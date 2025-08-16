import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../utils/tableSort';
import { useTablePagination } from '../utils/tablePagination';
import PaginationControls from '../utils/PaginationControls';

const Items = ({ db, userId, isAuthReady, appId }) => {
    const [itemName, setItemName] = useState('');
    const [quantityMeasurement, setQuantityMeasurement] = useState('');
    const [defaultRate, setDefaultRate] = useState('');
    const location = useLocation();
    const [itemType, setItemType] = useState(() => {
        const p = new URLSearchParams(location.search).get('type');
        return p === 'Goods' ? 'Goods' : 'Service';
    });
    const [hsnCode, setHsnCode] = useState('');
    const [gstPercentage, setGstPercentage] = useState('');
    const [message, setMessage] = useState('');
    const [itemsList, setItemsList] = useState([]);
    const [editingItemId, setEditingItemId] = useState(null);
    const [description, setDescription] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('0');
    const [salePrice, setSalePrice] = useState('0');
    const [openingStock, setOpeningStock] = useState('0');
    const [gstSplitRate, setGstSplitRate] = useState('0');
    const [isActive, setIsActive] = useState(true);
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [salesBills, setSalesBills] = useState([]);
    const [stockMap, setStockMap] = useState({});
    // Add new state for composition GST and raw material
    const [compositionGstRate, setCompositionGstRate] = useState('');
    const [isRawMaterial, setIsRawMaterial] = useState(false);
    const [rawMaterialType, setRawMaterialType] = useState('Base Material');

    // Sync itemType to URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        if (params.get('type') !== itemType) {
            params.set('type', itemType);
            const base = window.location.hash.split('?')[0] || '#/items';
            const next = `${base}?${params.toString()}`;
            if (window.location.hash !== next) window.location.hash = next;
        }
    }, [itemType]);

    // Table sorting hook with default sort by creation date descending (LIFO)
    const { sortConfig, handleSort, getSortedData } = useTableSort([], { key: 'createdAt', direction: 'desc' });
    
    // Table pagination hook
    const sortedItems = getSortedData(itemsList);
    const pagination = useTablePagination(sortedItems, 10);

    // 1. Add 'Nos.' to predefinedUnits, alphabetically
    const predefinedUnits = [
        'Bag', 'Barrel', 'Block', 'Board', 'Bottle', 'Box', 'Bundle', 'Can', 'Carton', 'Centimeter', 'Cubic Feet', 'Cubic Meter', 'Cu. Inch', 'Cu. Yard', 'Cylinder', 'Day', 'Drum', 'Foot', 'Gallon', 'Gram', 'Hour', 'Impression', 'Inch', 'Jar', 'Job', 'Kg', 'Litre', 'Lot', 'Meter', 'Millimeter', 'Month', 'Nos.', 'Packet', 'Pair', 'Panel', 'Piece', 'Pieces', 'Plate', 'Quintal', 'Ream', 'Roll', 'Run', 'Set', 'Sheet', 'Slab', 'Sq. Ft.', 'Sq. Inch', 'Sq. Yard', 'Square Meter', 'Strip', 'Ton', 'Tube', 'Year', 'Other'
    ];
    const [customUnit, setCustomUnit] = useState('');

    // 2. Replace <select> with searchable input+dropdown for quantity measurement
    const [unitSearch, setUnitSearch] = useState('');
    const filteredUnits = predefinedUnits.filter(u => u.toLowerCase().includes(unitSearch.toLowerCase())).sort();

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
                // LIFO sorting is now handled by the pagination utility
                setItemsList(items);
            }, (error) => {
                console.error("Error fetching items:", error);
                setMessage("Error fetching items. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Fetch purchase and sales bills for stock calculation
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const purchasesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
            const unsubscribePurchases = onSnapshot(purchasesCollectionRef, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
                setPurchaseBills(bills);
            });
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
            const unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
                setSalesBills(bills);
            });
            return () => {
                unsubscribePurchases();
                unsubscribeSales();
            };
        }
    }, [db, userId, isAuthReady, appId]);

    // Fetch live stock from stock collection
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const stockCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stock`);
            const unsubscribe = onSnapshot(stockCollectionRef, (snapshot) => {
                const stock = {};
                snapshot.forEach((doc) => {
                    stock[doc.id] = doc.data().itemQuantity || 0;
                });
                setStockMap(stock);
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
        setDescription('');
        setPurchasePrice('0');
        setSalePrice('0');
        setOpeningStock('0');
        setGstSplitRate('0');
        setIsActive(true);
        setEditingItemId(null);
        setMessage('');
        setCustomUnit('');
        setCompositionGstRate('');
        setIsRawMaterial(false);
        setRawMaterialType('Base Material');
    };

    // Handle adding/updating an item
    const handleSaveItem = async () => {
        if (!db || !userId) {
            setMessage("Firebase not initialized or user not authenticated.");
            return;
        }
        if (!itemName) {
            setMessage("Item Name is required.");
            return;
        }
        let sgstRate = 0, cgstRate = 0;
        if (parseFloat(gstSplitRate) > 0) {
            sgstRate = (parseFloat(gstSplitRate) / 2).toFixed(2);
            cgstRate = (parseFloat(gstSplitRate) / 2).toFixed(2);
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
                compositionGstRate: parseFloat(compositionGstRate) || 0,
                isRawMaterial: itemType === 'Goods' ? isRawMaterial : false,
                rawMaterialType: itemType === 'Goods' && isRawMaterial ? rawMaterialType : '',
                description,
                purchasePrice: parseFloat(purchasePrice) || 0,
                salePrice: parseFloat(salePrice) || 0,
                openingStock: parseFloat(openingStock) || 0,
                sgstRate: parseFloat(sgstRate) || 0,
                cgstRate: parseFloat(cgstRate) || 0,
                isActive,
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
        setCompositionGstRate(item.compositionGstRate || '');
        setIsRawMaterial(item.isRawMaterial || false);
        setRawMaterialType(item.rawMaterialType || 'Base Material');
        setDescription(item.description || '');
        setPurchasePrice(item.purchasePrice?.toString() || '0');
        setSalePrice(item.salePrice?.toString() || '0');
        setOpeningStock(item.openingStock?.toString() || '0');
        setGstSplitRate(item.sgstRate && item.cgstRate ? (parseFloat(item.sgstRate) + parseFloat(item.cgstRate)).toString() : '0');
        setIsActive(item.isActive !== false);
        setMessage('Editing existing item.');
        setCustomUnit(predefinedUnits.includes(item.quantityMeasurement) ? '' : (item.quantityMeasurement || ''));
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

    // Calculate stock for each item
    const getStockForItem = (itemId) => {
        let purchased = 0;
        let sold = 0;
        purchaseBills.forEach(bill => {
            if (bill.items && Array.isArray(bill.items)) {
                bill.items.forEach(item => {
                    if (item.itemId === itemId) {
                        purchased += parseFloat(item.quantity) || 0;
                    }
                });
            }
        });
        salesBills.forEach(bill => {
            if (bill.items && Array.isArray(bill.items)) {
                bill.items.forEach(item => {
                    if (item.itemId === itemId) {
                        sold += parseFloat(item.nos) || 0;
                    }
                });
            }
        });
        return purchased - sold;
    };

    // SGST/CGST vs IGST logic
    const sgstCgstUsed = parseFloat(gstSplitRate) > 0;

    const gstRateOptions = ['0', '0.25', '3', '5', '12', '18', '28'];

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
                    <input
                        type="text"
                        id="quantityMeasurement"
                        value={quantityMeasurement}
                        onChange={e => {
                            setQuantityMeasurement(e.target.value);
                            setUnitSearch(e.target.value);
                        }}
                        onFocus={e => setUnitSearch(quantityMeasurement)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Type or select unit"
                        autoComplete="off"
                        required
                    />
                    {unitSearch && (
                        <div className="border border-gray-300 rounded bg-white shadow-md max-h-40 overflow-y-auto absolute z-10 w-full">
                            {filteredUnits.map(unit => (
                                <div
                                    key={unit}
                                    className="px-3 py-1 hover:bg-blue-100 cursor-pointer"
                                    onMouseDown={() => {
                                        setQuantityMeasurement(unit);
                                        setUnitSearch('');
                                        if (unit !== 'Other') setCustomUnit('');
                                    }}
                                >
                                    {unit}
                                </div>
                        ))}
                            {filteredUnits.length === 0 && <div className="px-3 py-1 text-gray-400">No units found</div>}
                        </div>
                    )}
                    {((quantityMeasurement === 'Other') || (!predefinedUnits.includes(quantityMeasurement) && quantityMeasurement)) && (
                        <input
                            type="text"
                            id="customUnit"
                            value={customUnit}
                            onChange={e => {
                                setCustomUnit(e.target.value);
                                setQuantityMeasurement(e.target.value);
                            }}
                            className="mt-2 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter custom unit"
                            required
                        />
                    )}
                </div>
                <div>
                    <label htmlFor="defaultRate" className="block text-sm font-medium text-gray-700">Default Rate (₹) (Optional)</label>
                    <input type="number" id="defaultRate" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 12, 5000" />
                </div>
                <div>
                    <label htmlFor="itemType" className="block text-sm font-medium text-gray-700">Item Type</label>
                    <select id="itemType" value={itemType} onChange={e => setItemType(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required>
                        <option value="Goods">Goods</option>
                        <option value="Services">Services</option>
                        <option value="Restaurant">Restaurant</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                {(itemType === 'Goods') && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Raw Material</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input type="checkbox" id="isRawMaterial" checked={isRawMaterial} onChange={e => setIsRawMaterial(e.target.checked)} />
                            <label htmlFor="isRawMaterial" className="text-sm">Is this a Raw Material?</label>
                        </div>
                        {isRawMaterial && (
                            <div className="mt-2">
                                <label htmlFor="rawMaterialType" className="block text-xs font-medium text-gray-600">Raw Material Type</label>
                                <select id="rawMaterialType" value={rawMaterialType} onChange={e => setRawMaterialType(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="Base Material">Base Material</option>
                                    <option value="Consumable">Consumable</option>
                                    <option value="Packing Material">Packing Material</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}
                <div>
                    <label htmlFor="compositionGstRate" className="block text-sm font-medium text-gray-700">GST Rate for Composition (%)</label>
                    <input
                        type="number"
                        id="compositionGstRate"
                        value={compositionGstRate}
                        onChange={e => setCompositionGstRate(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 1, 5, 6"
                        min="0"
                        max="100"
                        step="0.01"
                    />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows="2"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Item description" />
                </div>
                <div>
                    <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">Purchase Price (per unit)</label>
                    <input type="number" id="purchasePrice" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0" />
                </div>
                <div>
                    <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">Sale Price (per unit)</label>
                    <input type="number" id="salePrice" value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0" />
                </div>
                <div>
                    <label htmlFor="openingStock" className="block text-sm font-medium text-gray-700">Opening Stock</label>
                    <input type="number" id="openingStock" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0" />
                </div>
                <div>
                    <label htmlFor="hsnCode" className="block text-sm font-medium text-gray-700">HSN Code</label>
                    <input type="text" id="hsnCode" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 48025510" />
                </div>
                <div>
                    <label htmlFor="gstPercentage" className="block text-sm font-medium text-gray-700">GST %</label>
                    <input
                        type="number"
                        id="gstPercentage"
                        value={gstPercentage}
                        onChange={e => setGstPercentage(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 0, 5, 12, 18, 28"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                    />
                </div>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                        className="mr-2" />
                    <label htmlFor="isActive" className="text-sm text-gray-700">Is Active</label>
                </div>
            </div>
            <div className="flex gap-4 mt-4">
                <button data-tour="add-item" onClick={handleSaveItem}
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
                    <table id="items-table" className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableHeader columnKey="itemName" label="Item Name" onSort={handleSort} sortConfig={sortConfig} />
                                <SortableHeader columnKey="quantityMeasurement" label="Measurement" onSort={handleSort} sortConfig={sortConfig} />
                                <SortableHeader columnKey="defaultRate" label="Default Rate (₹)" onSort={handleSort} sortConfig={sortConfig} />
                                <SortableHeader columnKey="itemType" label="Type" onSort={handleSort} sortConfig={sortConfig} />
                                <SortableHeader columnKey="hsnCode" label="HSN Code" onSort={handleSort} sortConfig={sortConfig} />
                                <SortableHeader columnKey="gstPercentage" label="GST %" onSort={handleSort} sortConfig={sortConfig} />
                                <SortableHeader columnKey="stock" label="Stock" onSort={handleSort} sortConfig={sortConfig} />
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {pagination.currentData.map((item) => {
                                const opening = parseFloat(item.openingStock) || 0;
                                // Purchases and sales up to today (for running stock)
                                const allPurchases = purchaseBills
                                    .flatMap(bill => (bill.rows || []).filter(row => row.item === item.id))
                                    .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
                                const allSales = salesBills
                                    .flatMap(bill => (bill.rows || []).filter(row => row.item === item.id))
                                    .reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
                                const liveStock = opening + allPurchases - allSales;
                                
                                return (
                                    <tr key={item.id}>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.itemName}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantityMeasurement}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{item.defaultRate}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.itemType}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.hsnCode || 'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{typeof item.gstPercentage !== 'undefined' ? `${item.gstPercentage}%` : '0%'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{liveStock}</td>
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
                                );
                            })}
                        </tbody>
                    </table>
                    
                    {/* Pagination Controls */}
                    <PaginationControls {...pagination} />
                </div>
            )}
        </div>
    );
};

export default Items;