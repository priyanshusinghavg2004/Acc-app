import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';

const Reports = ({ db, userId, isAuthReady, appId }) => {
    const [partiesList, setPartiesList] = useState([]);
    const [selectedPartyId, setSelectedPartyId] = useState('');
    const [partyTransactions, setPartyTransactions] = useState([]);
    const [message, setMessage] = useState('');

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

            {selectedPartyId && partyTransactions.length > 0 ? (
                <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid/Received</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Running Balance</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {partyTransactions.map((transaction) => (
                                <tr key={transaction.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{transaction.date}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{transaction.type}</td>
                                    <td className="px-4 py-2 text-sm text-gray-800 max-w-xs overflow-hidden text-ellipsis">{transaction.description}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{transaction.totalAmount}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">₹{transaction.amountPaid}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-red-600">₹{transaction.outstanding}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{transaction.paymentProgress}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">
                                        ₹{transaction.runningBalance}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : selectedPartyId ? (
                <p className="text-gray-600">No transactions found for the selected party.</p>
            ) : (
                <p className="text-gray-600">Select a party from the dropdown to view their ledger.</p>
            )}
        </div>
    );
};

export default Reports; 