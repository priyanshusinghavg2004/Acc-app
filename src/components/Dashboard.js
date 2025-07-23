import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';

const Dashboard = ({ db, userId, isAuthReady, appId }) => {
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [totalSuppliers, setTotalSuppliers] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [totalSalesThisMonth, setTotalSalesThisMonth] = useState(0);
    const [totalPurchasesThisMonth, setTotalPurchasesThisMonth] = useState(0);
    const [lastSevenDaysSales, setLastSevenDaysSales] = useState(0);
    const [totalOutstandingReceivables, setTotalOutstandingReceivables] = useState(0);
    const [totalOutstandingPayables, setTotalOutstandingPayables] = useState(0);
    const [companyDetails, setCompanyDetails] = useState({ firmName: '', gstin: '', contactNumber: '', address: '', gstinType: '' });
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (db && userId && isAuthReady) {
            // Fetch Parties data
            const partiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/parties`);
            const unsubscribeParties = onSnapshot(partiesCollectionRef, (snapshot) => {
                let buyersCount = 0;
                let sellersCount = 0;
                snapshot.forEach((doc) => {
                    const partyData = doc.data();
                    if (partyData.partyType === 'Buyer' || partyData.partyType === 'Both') {
                        buyersCount++;
                    }
                    if (partyData.partyType === 'Seller' || partyData.partyType === 'Both') {
                        sellersCount++;
                    }
                });
                setTotalCustomers(buyersCount);
                setTotalSuppliers(sellersCount);
            }, (error) => {
                console.error("Error fetching parties for dashboard:", error);
                setMessage("Error fetching party data for dashboard.");
            });

            // Fetch Items data
            const itemsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/items`);
            const unsubscribeItems = onSnapshot(itemsCollectionRef, (snapshot) => {
                setTotalItems(snapshot.size);
            }, (error) => {
                console.error("Error fetching items for dashboard:", error);
                setMessage("Error fetching item data for dashboard.");
            });

            // Fetch Company Details
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            const unsubscribeCompany = onSnapshot(companyDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setCompanyDetails(docSnap.data());
                } else {
                    setCompanyDetails({ firmName: '', gstin: '', contactNumber: '', address: '', gstinType: '' });
                }
            }, (error) => {
                console.error("Error fetching company details:", error);
                setMessage("Error fetching company details.");
            });

            // Calculate dates for filtering
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);

            // Calculate Indian financial year range
            let fyStart, fyEnd;
            if (today.getMonth() >= 3) { // April (3) or later
                fyStart = new Date(today.getFullYear(), 3, 1); // April 1st this year
                fyEnd = new Date(today.getFullYear() + 1, 2, 31, 23, 59, 59, 999); // March 31st next year
            } else {
                fyStart = new Date(today.getFullYear() - 1, 3, 1); // April 1st last year
                fyEnd = new Date(today.getFullYear(), 2, 31, 23, 59, 59, 999); // March 31st this year
            }

            // Fetch Sales data
            const salesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
            const unsubscribeSales = onSnapshot(salesCollectionRef, (snapshot) => {
                let monthlySales = 0;
                let sevenDaysSales = 0;
                let outstandingReceivables = 0;
                snapshot.forEach((doc) => {
                    const billData = doc.data();
                    const billDate = new Date(billData.invoiceDate || billData.date);
                    const totalAmount = parseFloat(billData.amount) || 0;
                    const payments = Array.isArray(billData.payments) ? billData.payments : [];
                    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                    const paymentStatus = billData.paymentStatus || 'Pending';

                    // Check for current month sales
                    if (billDate >= firstDayOfMonth && billDate <= today) {
                        monthlySales += totalAmount;
                    }

                    // Check for last 7 days sales
                    if (billDate >= sevenDaysAgo && billDate <= today) {
                        sevenDaysSales += totalAmount;
                    }

                    // Calculate outstanding receivables for Indian financial year
                    if (
                        billDate >= fyStart && billDate <= fyEnd &&
                        paymentStatus !== 'Paid' &&
                        totalAmount > totalPaid
                    ) {
                        outstandingReceivables += (totalAmount - totalPaid);
                    }
                });
                setTotalSalesThisMonth(monthlySales.toFixed(2));
                setLastSevenDaysSales(sevenDaysSales.toFixed(2));
                setTotalOutstandingReceivables(outstandingReceivables.toFixed(2));
            }, (error) => {
                console.error("Error fetching sales for dashboard:", error);
                setMessage("Error fetching sales data for dashboard.");
            });

            // Fetch Purchases data
            const purchaseTypes = [
                { collection: 'purchaseBills' },
                { collection: 'purchaseOrders' }
            ];
            let unsubscribePurchasesArr = [];
                let monthlyPurchases = 0;
                let outstandingPayables = 0;
            purchaseTypes.forEach(type => {
                const purchasesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/${type.collection}`);
                const unsubscribe = onSnapshot(purchasesCollectionRef, (snapshot) => {
                snapshot.forEach((doc) => {
                    const billData = doc.data();
                        const billDate = new Date(billData.billDate);
                        const totalAmount = parseFloat(billData.amount) || 0;
                        const payments = Array.isArray(billData.payments) ? billData.payments : [];
                        const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                        const paymentStatus = billData.paymentStatus || 'Pending';
                    // Check for current month purchases
                    if (billDate >= firstDayOfMonth && billDate <= today) {
                        monthlyPurchases += totalAmount;
                    }
                        // Calculate outstanding payables for Indian financial year
                        if (
                            billDate >= fyStart && billDate <= fyEnd &&
                            paymentStatus !== 'Paid' &&
                            totalAmount > totalPaid
                        ) {
                            outstandingPayables += (totalAmount - totalPaid);
                    }
                });
                setTotalPurchasesThisMonth(monthlyPurchases.toFixed(2));
                setTotalOutstandingPayables(outstandingPayables.toFixed(2));
            }, (error) => {
                console.error("Error fetching purchases for dashboard:", error);
                setMessage("Error fetching purchase data for dashboard.");
                });
                unsubscribePurchasesArr.push(unsubscribe);
            });

            // Cleanup listeners on unmount
            return () => {
                unsubscribeParties();
                unsubscribeItems();
                unsubscribeSales();
                unsubscribePurchasesArr.forEach(unsub => unsub()); // Unsubscribe all purchase listeners
                unsubscribeCompany();
            };
        }
    }, [db, userId, isAuthReady, appId]);


    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Dashboard</h2>
            <p className="text-gray-600">Welcome to your accounting software! Here's a quick overview of your business.</p>

            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            {userId && (
                <p className="text-sm text-gray-500 mt-4">Your User ID: <span className="font-mono bg-gray-100 p-1 rounded">{userId}</span></p>
            )}
            {!isAuthReady && (
                <p className="text-orange-500 mt-2">Initializing Firebase authentication and loading data...</p>
            )}
            {userId && (
                <p className="text-sm text-blue-700 mt-4">
                    **Important:** Your data is saved in the cloud and linked to this User ID. If you see a different User ID in a new session, your previous data won't be visible under the new ID.
                </p>
            )}

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Company Details Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Company Details</h3>
                    <p className="text-gray-700">
                        <strong>Company Name:</strong> {companyDetails.firmName}<br />
                        <strong>GSTIN:</strong> {companyDetails.gstin}<br />
                        <strong>GSTIN Type:</strong> {companyDetails.gstinType}<br />
                        <strong>Contact:</strong> {companyDetails.contactNumber}<br />
                        <strong>Address:</strong> {companyDetails.address}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        (Manage Company Details in the dedicated "Company Details" module.)
                    </p>
                </div>

                {/* Sales Performance Card */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">Sales Performance</h3>
                    <p className="text-gray-700">
                        <strong>Last 7 Days Sales:</strong> ₹{lastSevenDaysSales}<br />
                        <strong>Total Sales This Month:</strong> ₹{totalSalesThisMonth}<br />
                        <strong className="text-red-700">Outstanding Receivables:</strong> ₹{totalOutstandingReceivables}
                    </p>
                </div>

                {/* Purchase Performance Card */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3">Purchase Performance</h3>
                    <p className="text-gray-700">
                        <strong>Total Purchases This Month:</strong> ₹{totalPurchasesThisMonth}<br />
                        <strong className="text-red-700">Outstanding Payables:</strong> ₹{totalOutstandingPayables}
                    </p>
                </div>

                {/* Parties and Items Overview Card */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-3">Master Data Overview</h3>
                    <p className="text-gray-700">
                        <strong>Total Customers:</strong> {totalCustomers}<br />
                        <strong>Total Suppliers:</strong> {totalSuppliers}<br />
                        <strong>Total Items:</strong> {totalItems}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard; 