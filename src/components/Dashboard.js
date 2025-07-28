import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

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
    const [payments, setPayments] = useState([]);
    
    // Chart data states
    const [monthlyData, setMonthlyData] = useState([]);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [paymentStatusData, setPaymentStatusData] = useState([]);

    // Todo list state
    const [todos, setTodos] = useState([
        { id: 1, text: "Add GST return filing reminders", completed: false, priority: "high" },
        { id: 2, text: "Implement multi-currency support", completed: false, priority: "medium" },
        { id: 3, text: "Add barcode scanning for inventory", completed: false, priority: "medium" },
        { id: 4, text: "Create customer portal for bill viewing", completed: false, priority: "low" },
        { id: 5, text: "Add email/SMS notifications for payments", completed: false, priority: "high" },
        { id: 6, text: "Implement advanced reporting with filters", completed: false, priority: "medium" },
        { id: 7, text: "Add backup and restore functionality", completed: false, priority: "high" },
        { id: 8, text: "Create mobile app for field operations", completed: false, priority: "low" }
    ]);

    const [partiesList, setPartiesList] = useState([]);
    const [partyOutstanding, setPartyOutstanding] = useState([]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    const [receivableList, setReceivableList] = useState([]);
    const [payableList, setPayableList] = useState([]);

    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;
        const fetchDashboardData = async () => {
            // Fetch parties
            const partiesSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/parties`));
            const parties = [];
            let buyersCount = 0;
            let sellersCount = 0;
            partiesSnap.forEach(doc => {
                const partyData = doc.data();
                parties.push({ id: doc.id, ...partyData });
                if (partyData.partyType === 'Buyer' || partyData.partyType === 'Both') buyersCount++;
                if (partyData.partyType === 'Seller' || partyData.partyType === 'Both') sellersCount++;
            });
            setPartiesList(parties);
            setTotalCustomers(buyersCount);
            setTotalSuppliers(sellersCount);

            // Fetch payments
            const paymentsSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/payments`));
            const paymentsData = [];
            paymentsSnap.forEach(doc => paymentsData.push({ id: doc.id, ...doc.data() }));
            setPayments(paymentsData);

            // Fetch salesBills
            const salesSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/salesBills`));
            const salesBills = [];
            salesSnap.forEach(doc => salesBills.push({ id: doc.id, ...doc.data() }));

            // Fetch purchaseBills
            const purchaseSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`));
            const purchaseBills = [];
            purchaseSnap.forEach(doc => purchaseBills.push({ id: doc.id, ...doc.data() }));

            // Calculate summary cards
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            let monthlySales = 0;
            let monthlyPurchases = 0;
            let outstandingReceivables = 0;
            let outstandingPayables = 0;
            salesBills.forEach(bill => {
                const billDate = new Date(bill.invoiceDate || bill.date);
                const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                // Monthly sales
                if (billDate >= firstDayOfMonth && billDate <= today) {
                    monthlySales += totalAmount;
                }
                // Outstanding receivables
                const billPayments = paymentsData.filter(p =>
                    p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
                );
                const totalPaid = billPayments.reduce((sum, payment) => {
                    const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
                    return sum + (allocation ? allocation.allocatedAmount : 0);
                }, 0);
                if (totalAmount > totalPaid) {
                    outstandingReceivables += (totalAmount - totalPaid);
                }
            });
            purchaseBills.forEach(bill => {
                const billDate = new Date(bill.billDate);
                const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                // Monthly purchases
                if (billDate >= firstDayOfMonth && billDate <= today) {
                    monthlyPurchases += totalAmount;
                }
                // Outstanding payables
                const billPayments = paymentsData.filter(p =>
                    p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
                );
                const totalPaid = billPayments.reduce((sum, payment) => {
                    const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
                    return sum + (allocation ? allocation.allocatedAmount : 0);
                }, 0);
                if (totalAmount > totalPaid) {
                    outstandingPayables += (totalAmount - totalPaid);
                }
            });
            setTotalSalesThisMonth(monthlySales.toFixed(2));
            setTotalPurchasesThisMonth(monthlyPurchases.toFixed(2));
            setTotalOutstandingReceivables(outstandingReceivables.toFixed(2));
            setTotalOutstandingPayables(outstandingPayables.toFixed(2));

            // Receivable: party, outstanding, days since last payment
            let receivables = [];
            parties.forEach(party => {
                // Find all invoices for this party, sorted by invoice number (or date)
                const partyBills = salesBills.filter(bill => (bill.party || bill.customerId) === party.id);
                // Sort by date, then invoice number (ascending)
                partyBills.sort((a, b) => {
                    const dateA = new Date(a.invoiceDate || a.date);
                    const dateB = new Date(b.invoiceDate || b.date);
                    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
                    return (a.number || a.invoiceNumber || '').localeCompare(b.number || b.invoiceNumber || '');
                });
                // Find the oldest outstanding invoice
                let oldestOutstandingBill = null;
                for (let bill of partyBills) {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = paymentsData.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    if (totalAmount > totalPaid) {
                        oldestOutstandingBill = bill;
                        break;
                    }
                }
                if (!oldestOutstandingBill) return;
                // Try to find a payment for that invoice
                let lastPaymentDate = null;
                const billPayments = paymentsData.filter(p =>
                    p.allocations && p.allocations.some(a => a.billId === oldestOutstandingBill.id && a.billType === 'invoice') && p.date
                );
                if (billPayments.length > 0) {
                    lastPaymentDate = billPayments.reduce((latest, p) => {
                        return (!latest || new Date(p.date) > new Date(latest)) ? p.date : latest;
                    }, null);
                } else {
                    // If not found, look for the latest payment for any previous invoice
                    // Find all previous invoices (smaller invoice number or earlier date)
                    const oldestDate = new Date(oldestOutstandingBill.invoiceDate || oldestOutstandingBill.date);
                    const oldestNumber = oldestOutstandingBill.number || oldestOutstandingBill.invoiceNumber || '';
                    const previousBills = partyBills.filter(bill => {
                        const billDate = new Date(bill.invoiceDate || bill.date);
                        if (billDate < oldestDate) return true;
                        if (billDate.getTime() === oldestDate.getTime()) {
                            return (bill.number || bill.invoiceNumber || '') < oldestNumber;
                        }
                        return false;
                    });
                    // Find the latest payment for any previous invoice
                    let previousPaymentDate = null;
                    previousBills.forEach(bill => {
                        const prevPayments = paymentsData.filter(p =>
                            p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice') && p.date
                        );
                        prevPayments.forEach(p => {
                            if (!previousPaymentDate || new Date(p.date) > new Date(previousPaymentDate)) {
                                previousPaymentDate = p.date;
                            }
                        });
                    });
                    if (previousPaymentDate) lastPaymentDate = previousPaymentDate;
                }
                // Calculate total outstanding for this party
                const outstandingBills = partyBills.filter(bill => {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = paymentsData.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    return totalAmount > totalPaid;
                });
                const totalOutstanding = outstandingBills.reduce((sum, bill) => {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = paymentsData.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    return sum + (totalAmount - totalPaid);
                }, 0);
                let daysAgo = '-';
                if (lastPaymentDate) {
                    const days = dayjs().diff(dayjs(lastPaymentDate), 'day');
                    daysAgo = days === 0 ? 'Today' : `${days} days ago`;
                } else {
                    daysAgo = 'Never';
                }
                receivables.push({
                    partyName: party.firmName,
                    outstanding: totalOutstanding,
                    lastPaymentAgo: daysAgo
                });
            });
            receivables.sort((a, b) => b.outstanding - a.outstanding);
            setReceivableList(receivables.slice(0, 5));
            // Payable: party, outstanding, days since last payment
            let payables = [];
            parties.forEach(party => {
                // Find all outstanding purchase bills for this party
                const outstandingBills = purchaseBills.filter(bill => {
                    const partyId = bill.party || bill.supplierId;
                    if (partyId !== party.id) return false;
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = paymentsData.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    return totalAmount > totalPaid;
                });
                if (outstandingBills.length === 0) return;
                // Find the newest bill (by date, fallback to bill number if needed)
                let newestBill = outstandingBills[0];
                outstandingBills.forEach(bill => {
                    const billDate = new Date(bill.billDate);
                    const newestDate = new Date(newestBill.billDate);
                    if (billDate > newestDate) {
                        newestBill = bill;
                    } else if (billDate.getTime() === newestDate.getTime()) {
                        if ((bill.number || bill.billNumber || '') > (newestBill.number || newestBill.billNumber || '')) {
                            newestBill = bill;
                        }
                    }
                });
                // Find newest payment entry for this bill
                let lastPaymentDate = null;
                const billPayments = paymentsData.filter(p =>
                    p.allocations && p.allocations.some(a => a.billId === newestBill.id && a.billType === 'purchase') && p.date
                );
                if (billPayments.length > 0) {
                    lastPaymentDate = billPayments.reduce((latest, p) => {
                        return (!latest || new Date(p.date) > new Date(latest)) ? p.date : latest;
                    }, null);
                }
                // Calculate total outstanding for this party
                const totalOutstanding = outstandingBills.reduce((sum, bill) => {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = paymentsData.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    return sum + (totalAmount - totalPaid);
                }, 0);
                let daysAgo = '-';
                if (lastPaymentDate) {
                    const days = dayjs().diff(dayjs(lastPaymentDate), 'day');
                    daysAgo = days === 0 ? 'Today' : `${days} days ago`;
                } else {
                    daysAgo = 'Never';
                }
                payables.push({
                    partyName: party.firmName,
                    outstanding: totalOutstanding,
                    lastPaymentAgo: daysAgo
                });
            });
            payables.sort((a, b) => b.outstanding - a.outstanding);
            setPayableList(payables.slice(0, 5));

            // Fetch items count
            const itemsSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/items`));
            setTotalItems(itemsSnap.size);

            // Fetch company details
            const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
            const companySnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/companyDetails`));
            if (!companySnap.empty) {
                setCompanyDetails(companySnap.docs[0].data());
            } else {
                setCompanyDetails({ firmName: '', gstin: '', contactNumber: '', address: '', gstinType: '' });
            }
        };
        fetchDashboardData();
    }, [db, userId, isAuthReady, appId]);

// Calculate party-wise outstanding/receivable
useEffect(() => {
    if (!partiesList.length || !payments.length || !db || !userId || !isAuthReady) return;
    // Fetch all salesBills and purchaseBills
    const fetchBills = async () => {
        const salesRef = collection(db, `artifacts/${appId}/users/${userId}/salesBills`);
        const purchaseRef = collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`);
        let salesBills = [];
        let purchaseBills = [];
        let outstandingMap = {};
        // Fetch sales bills
        await new Promise((resolve) => {
            onSnapshot(salesRef, (snapshot) => {
                salesBills = [];
                snapshot.forEach(doc => {
                    salesBills.push({ id: doc.id, ...doc.data() });
                });
                resolve();
            });
        });
        // Fetch purchase bills
        await new Promise((resolve) => {
            onSnapshot(purchaseRef, (snapshot) => {
                purchaseBills = [];
                snapshot.forEach(doc => {
                    purchaseBills.push({ id: doc.id, ...doc.data() });
                });
                resolve();
            });
        });
        // Calculate outstanding for each party
        partiesList.forEach(party => {
            let receivable = 0;
            let payable = 0;
            // Sales (receivable)
            salesBills.forEach(bill => {
                if ((bill.party || bill.customerId) === party.id) {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = payments.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    if (totalAmount > totalPaid) {
                        receivable += (totalAmount - totalPaid);
                    }
                }
            });
            // Purchases (payable)
            purchaseBills.forEach(bill => {
                if ((bill.party || bill.supplierId) === party.id) {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = payments.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    if (totalAmount > totalPaid) {
                        payable += (totalAmount - totalPaid);
                    }
                }
            });
            outstandingMap[party.id] = {
                partyName: party.firmName,
                receivable,
                payable
            };
        });
        setPartyOutstanding(Object.values(outstandingMap));
    };
    fetchBills();
}, [partiesList, payments, db, userId, isAuthReady, appId]);

    const toggleTodo = (id) => {
        setTodos(todos.map(todo => 
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
        ));
    };

    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'high': return 'text-red-600 bg-red-100';
            case 'medium': return 'text-yellow-600 bg-yellow-100';
            case 'low': return 'text-green-600 bg-green-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
                    <p className="text-gray-600">Welcome back! Here's your business overview.</p>
                </div>

                {message && (
                    <div className={`p-4 mb-6 rounded-lg ${message.includes('Error') ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                        {message}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Monthly Sales</p>
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSalesThisMonth)}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Monthly Purchases</p>
                                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPurchasesThisMonth)}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Outstanding Receivables</p>
                                <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstandingReceivables)}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-full">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Outstanding Payables</p>
                                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstandingPayables)}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-full">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Outstanding Receivable */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Outstanding Receivable</h3>
                        <table className="min-w-full bg-white rounded-lg shadow border">
                            <thead>
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Party Name</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Days Since Last Payment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {receivableList.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-sm text-gray-900">{p.partyName}</td>
                                        <td className="px-3 py-2 text-sm text-right text-green-700 font-semibold">{formatCurrency(p.outstanding)}</td>
                                        <td className="px-3 py-2 text-center text-sm">{p.lastPaymentAgo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Outstanding Payable */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Outstanding Payable</h3>
                        <table className="min-w-full bg-white rounded-lg shadow border">
                            <thead>
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Party Name</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Days Since Last Payment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payableList.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-sm text-gray-900">{p.partyName}</td>
                                        <td className="px-3 py-2 text-sm text-right text-red-700 font-semibold">{formatCurrency(p.outstanding)}</td>
                                        <td className="px-3 py-2 text-center text-sm">{p.lastPaymentAgo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Additional Info and Todo Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Company Info */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Company Information</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Company Name</p>
                                <p className="text-gray-800">{companyDetails.firmName || 'Not set'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">GSTIN</p>
                                <p className="text-gray-800">{companyDetails.gstin || 'Not set'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Contact</p>
                                <p className="text-gray-800">{companyDetails.contactNumber || 'Not set'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                                <p className="text-gray-800">{totalCustomers}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
                                <p className="text-gray-800">{totalSuppliers}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Items</p>
                                <p className="text-gray-800">{totalItems}</p>
                            </div>
                        </div>
                    </div>

                    {/* Todo List */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 lg:col-span-2">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Development Roadmap</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {todos.map((todo) => (
                                <div key={todo.id} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={todo.completed}
                                        onChange={() => toggleTodo(todo.id)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className={`flex-1 ${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                        {todo.text}
                                    </span>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(todo.priority)}`}>
                                        {todo.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-gray-500 mt-4">
                            These features are planned for future development. Check them off as they're completed!
                        </p>
                    </div>
                </div>

                {/* User ID Info */}
                {userId && (
                    <div className="mt-8 bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-blue-800">
                            <strong>User ID:</strong> <span className="font-mono bg-blue-100 p-1 rounded">{userId}</span>
                        </p>
                        <p className="text-sm text-blue-700 mt-2">
                            <strong>Important:</strong> Your data is saved in the cloud and linked to this User ID. 
                            If you see a different User ID in a new session, your previous data won't be visible under the new ID.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard; 