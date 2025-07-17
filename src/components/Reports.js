import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';

const Reports = ({ db, userId, isAuthReady, appId }) => {
    const [partiesList, setPartiesList] = useState([]);
    const [selectedPartyId, setSelectedPartyId] = useState('');
    const [partyTransactions, setPartyTransactions] = useState([]);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('party');
    const [itemsList, setItemsList] = useState([]);
    const [salesBills, setSalesBills] = useState([]);
    const [purchaseBills, setPurchaseBills] = useState([]);

    // Fetch all parties to populate the dropdown
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
            const unsubscribe = onSnapshot(partiesCollectionRef, (snapshot) => {
                const parties = [];
                snapshot.forEach((doc) => {
                    parties.push({ id: doc.id, ...doc.data() });
                });
                parties.sort((a, b) => a.firmName.localeCompare(b.firmName));
                setPartiesList(parties);
            }, (error) => {
                console.error("Error fetching parties for reports:", error);
                setMessage("Error fetching parties for reports.");
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);

    // Fetch transactions for the selected party
    useEffect(() => {
        if (db && userId && isAuthReady && selectedPartyId) {
            const fetchTransactions = async () => {
                setMessage('Loading transactions...');
                const transactions = [];
                let runningBalance = 0;

                // Fetch Sales Bills for the selected party (where selected party is the customer)
                const salesQuery = query(
                    collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
                    where("customerId", "==", selectedPartyId)
                );
                const salesSnapshot = await new Promise(resolve => {
                    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
                        unsubscribe();
                        resolve(snapshot);
                    }, (error) => {
                        console.error("Error fetching sales transactions:", error);
                        setMessage("Error fetching sales transactions.");
                        resolve(null);
                    });
                });

                if (salesSnapshot) {
                    salesSnapshot.forEach(doc => {
                        const data = doc.data();
                        const total = parseFloat(data.totalAmount) || 0;
                        const paid = parseFloat(data.paymentAmount) || 0;
                        const outstanding = total - paid;
                        runningBalance += outstanding;
                        transactions.push({
                            id: doc.id,
                            type: 'Sale',
                            date: data.billDate,
                            description: data.items.map(item => `${item.workType} (${item.nos} ${item.quantityMeasurement})`).join(', '),
                            totalAmount: total,
                            amountPaid: paid,
                            outstanding: outstanding.toFixed(2),
                            paymentProgress: data.paymentProgress,
                            runningBalance: runningBalance.toFixed(2)
                        });
                    });
                }

                // Fetch Purchase Bills for the selected party (where selected party is the seller)
                const purchasesQuery = query(
                    collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
                    where("sellerId", "==", selectedPartyId)
                );
                const purchasesSnapshot = await new Promise(resolve => {
                    const unsubscribe = onSnapshot(purchasesQuery, (snapshot) => {
                        unsubscribe();
                        resolve(snapshot);
                    }, (error) => {
                        console.error("Error fetching purchase transactions:", error);
                        setMessage("Error fetching purchase transactions.");
                        resolve(null);
                    });
                });

                if (purchasesSnapshot) {
                    purchasesSnapshot.forEach(doc => {
                        const data = doc.data();
                        const total = parseFloat(data.totalAmount) || 0;
                        const paid = parseFloat(data.amountPaid) || 0;
                        const outstanding = total - paid;
                        runningBalance -= outstanding;
                        transactions.push({
                            id: doc.id,
                            type: 'Purchase',
                            date: data.purchaseDate,
                            description: data.items.map(item => `${item.itemName} (${item.quantity} ${item.quantityMeasurement})`).join(', '),
                            totalAmount: total,
                            amountPaid: paid,
                            outstanding: outstanding.toFixed(2),
                            paymentProgress: data.paymentProgress,
                            runningBalance: runningBalance.toFixed(2)
                        });
                    });
                }

                transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

                let finalRunningBalance = 0;
                const sortedTransactionsWithBalance = transactions.map(t => {
                    if (t.type === 'Sale') {
                        finalRunningBalance += (parseFloat(t.totalAmount) - parseFloat(t.amountPaid));
                    } else {
                        finalRunningBalance -= (parseFloat(t.totalAmount) - parseFloat(t.amountPaid));
                    }
                    return { ...t, runningBalance: finalRunningBalance.toFixed(2) };
                });

                setPartyTransactions(sortedTransactionsWithBalance);
                setMessage('');
            };

            fetchTransactions();
        } else if (!selectedPartyId) {
            setPartyTransactions([]);
            setMessage('Please select a party to view their ledger.');
        }
    }, [db, userId, isAuthReady, selectedPartyId, appId]);

    // Fetch items
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
            const unsubscribe = onSnapshot(itemsCollectionRef, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                setItemsList(items);
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);
    // Fetch sales bills
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
            const unsubscribe = onSnapshot(salesCollectionRef, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
                setSalesBills(bills);
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);
    // Fetch purchase bills
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const purchasesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
            const unsubscribe = onSnapshot(purchasesCollectionRef, (snapshot) => {
                const bills = [];
                snapshot.forEach((doc) => {
                    bills.push({ id: doc.id, ...doc.data() });
                });
                setPurchaseBills(bills);
            });
            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady, appId]);


    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Reports</h2>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-4">Party Ledger</h3>
            <div className="mb-6">
                <label htmlFor="partySelect" className="block text-sm font-medium text-gray-700">Select Party</label>
                <select
                    id="partySelect"
                    value={selectedPartyId}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Select a Party --</option>
                    {partiesList.map(party => (
                        <option key={party.id} value={party.id}>{party.firmName} ({party.partyType})</option>
                    ))}
                </select>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 mb-6">
                <button onClick={() => setActiveTab('party')} className={`px-4 py-2 rounded ${activeTab === 'party' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Party List</button>
                <button onClick={() => setActiveTab('item')} className={`px-4 py-2 rounded ${activeTab === 'item' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Item List</button>
                <button onClick={() => setActiveTab('sales')} className={`px-4 py-2 rounded ${activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Sales Bill List</button>
                <button onClick={() => setActiveTab('purchase')} className={`px-4 py-2 rounded ${activeTab === 'purchase' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Purchase Bill List</button>
                <button onClick={() => setActiveTab('challan')} className={`px-4 py-2 rounded ${activeTab === 'challan' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Challan List</button>
                <button onClick={() => setActiveTab('quotation')} className={`px-4 py-2 rounded ${activeTab === 'quotation' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Quotation List</button>
            </div>

            {/* Tab content */}
            {activeTab === 'party' && (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firm Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GSTIN</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {partiesList.map(party => (
                                <tr key={party.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.firmName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.partyType}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.gstin}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{party.address}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {activeTab === 'item' && (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2">Item Name</th>
                                <th className="px-4 py-2">Unit</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">HSN</th>
                                <th className="px-4 py-2">GST</th>
                                <th className="px-4 py-2">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsList.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2">{item.itemName}</td>
                                    <td className="px-4 py-2">{item.quantityMeasurement}</td>
                                    <td className="px-4 py-2">{item.itemType}</td>
                                    <td className="px-4 py-2">{item.hsnCode}</td>
                                    <td className="px-4 py-2">{item.gstPercentage}%</td>
                                    <td className="px-4 py-2">{item.currentStock}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {activeTab === 'sales' && (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2">Invoice No.</th>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Party</th>
                                <th className="px-4 py-2">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesBills.map(bill => (
                                <tr key={bill.id}>
                                    <td className="px-4 py-2">{bill.invoiceNumber}</td>
                                    <td className="px-4 py-2">{bill.billDate}</td>
                                    <td className="px-4 py-2">{bill.customerFirmName}</td>
                                    <td className="px-4 py-2">₹{bill.totalAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {activeTab === 'purchase' && (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2">Bill No.</th>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Seller</th>
                                <th className="px-4 py-2">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseBills.map(bill => (
                                <tr key={bill.id}>
                                    <td className="px-4 py-2">{bill.id}</td>
                                    <td className="px-4 py-2">{bill.purchaseDate}</td>
                                    <td className="px-4 py-2">{bill.sellerFirmName}</td>
                                    <td className="px-4 py-2">₹{bill.totalAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {activeTab === 'challan' && (
                <div className="p-4 text-gray-600">Challan list feature coming soon.</div>
            )}
            {activeTab === 'quotation' && (
                <div className="p-4 text-gray-600">Quotation list feature coming soon.</div>
            )}
        </div>
    );
};

export default Reports; 