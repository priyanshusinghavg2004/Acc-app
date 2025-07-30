import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
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
        // Core Business Modules
        { id: 1, text: "Taxes Management Page - GST, TDS, TCS calculations", completed: false, priority: "high", category: "core" },
        { id: 2, text: "Manufacturing/Production Management Module", completed: true, priority: "high", category: "core" },
        { id: 3, text: "Expenses Management with categories and approvals", completed: false, priority: "high", category: "core" },
        { id: 4, text: "Inventory/Stock Management with real-time tracking", completed: false, priority: "high", category: "core" },
        { id: 5, text: "Employee/Staff Management with payroll", completed: false, priority: "medium", category: "core" },
        { id: 6, text: "Asset Management for equipment and machinery", completed: false, priority: "medium", category: "core" },
        
        // WMS (Warehouse Management System) Features
        { id: 7, text: "Warehouse Management System (WMS) - Location tracking", completed: false, priority: "high", category: "wms" },
        { id: 8, text: "WMS - Bin management and optimization", completed: false, priority: "high", category: "wms" },
        { id: 9, text: "WMS - Picking and packing workflows", completed: false, priority: "high", category: "wms" },
        { id: 10, text: "WMS - Receiving and putaway processes", completed: false, priority: "high", category: "wms" },
        { id: 11, text: "WMS - Cycle counting and inventory accuracy", completed: false, priority: "medium", category: "wms" },
        { id: 12, text: "WMS - Wave planning and order fulfillment", completed: false, priority: "medium", category: "wms" },
        { id: 13, text: "WMS - Cross-docking operations", completed: false, priority: "low", category: "wms" },
        { id: 14, text: "WMS - Labor management and productivity tracking", completed: false, priority: "medium", category: "wms" },
        
        // Advanced Features
        { id: 15, text: "Multi-currency support for international transactions", completed: false, priority: "medium", category: "advanced" },
        { id: 16, text: "Barcode/QR code scanning for inventory", completed: false, priority: "medium", category: "advanced" },
        { id: 17, text: "Email/SMS notifications for payments and reminders", completed: false, priority: "high", category: "advanced" },
        { id: 18, text: "Customer/Supplier portal for self-service", completed: false, priority: "low", category: "advanced" },
        { id: 19, text: "Advanced reporting with custom filters and exports", completed: false, priority: "medium", category: "advanced" },
        { id: 20, text: "Backup and restore functionality", completed: false, priority: "high", category: "advanced" },
        
        // Integration & Automation
        { id: 21, text: "Bank integration for automatic payment reconciliation", completed: false, priority: "medium", category: "integration" },
        { id: 22, text: "GST portal integration for return filing", completed: false, priority: "high", category: "integration" },
        { id: 23, text: "Tally/QuickBooks data import/export", completed: false, priority: "medium", category: "integration" },
        { id: 24, text: "Automated invoice generation and sending", completed: false, priority: "medium", category: "integration" },
        { id: 25, text: "E-commerce platform integration (Amazon, Flipkart)", completed: false, priority: "medium", category: "integration" },
        { id: 26, text: "Logistics and courier integration", completed: false, priority: "medium", category: "integration" },
        
        // Mobile & Field Operations
        { id: 27, text: "Mobile app for field operations and sales", completed: false, priority: "low", category: "mobile" },
        { id: 28, text: "Offline mode for mobile app", completed: false, priority: "low", category: "mobile" },
        { id: 29, text: "GPS tracking for delivery and field staff", completed: false, priority: "low", category: "mobile" },
        { id: 30, text: "Mobile barcode scanning app", completed: false, priority: "medium", category: "mobile" },
        
        // Analytics & Insights
        { id: 31, text: "Business analytics dashboard with KPIs", completed: false, priority: "medium", category: "analytics" },
        { id: 32, text: "Cash flow forecasting and projections", completed: false, priority: "medium", category: "analytics" },
        { id: 33, text: "Profitability analysis by product/customer", completed: false, priority: "medium", category: "analytics" },
        { id: 34, text: "Sales forecasting and demand planning", completed: false, priority: "medium", category: "analytics" },
        { id: 35, text: "Real-time dashboard with live data feeds", completed: false, priority: "medium", category: "analytics" },
        
        // Security & Compliance
        { id: 36, text: "Role-based access control and permissions", completed: false, priority: "high", category: "security" },
        { id: 37, text: "Audit trail for all transactions", completed: false, priority: "medium", category: "security" },
        { id: 38, text: "Data encryption and security compliance", completed: false, priority: "high", category: "security" },
        { id: 39, text: "Two-factor authentication (2FA)", completed: false, priority: "high", category: "security" },
        { id: 40, text: "Data backup and disaster recovery", completed: false, priority: "high", category: "security" },
        
        // User Experience
        { id: 41, text: "Dark mode theme option", completed: false, priority: "low", category: "ux" },
        { id: 42, text: "Multi-language support (Hindi, English)", completed: false, priority: "low", category: "ux" },
        { id: 43, text: "Keyboard shortcuts for power users", completed: false, priority: "low", category: "ux" },
        { id: 44, text: "Bulk operations for data entry", completed: false, priority: "medium", category: "ux" },
        { id: 45, text: "Template management for invoices and reports", completed: false, priority: "medium", category: "ux" },
        { id: 46, text: "Drag and drop file uploads", completed: false, priority: "low", category: "ux" },
        { id: 47, text: "Advanced search and filtering", completed: false, priority: "medium", category: "ux" },
        
        // Empty Pages & Missing Features
        { id: 48, text: "Reports page - Partywise sales/purchase reports", completed: false, priority: "high", category: "missing" },
        { id: 49, text: "Reports page - GST reports and summaries", completed: false, priority: "high", category: "missing" },
        { id: 50, text: "Reports page - Profit and loss statements", completed: false, priority: "high", category: "missing" },
        { id: 51, text: "Reports page - Balance sheet", completed: false, priority: "medium", category: "missing" },
        { id: 52, text: "Reports page - Cash flow statements", completed: false, priority: "medium", category: "missing" },
        { id: 53, text: "Settings page - User preferences and configurations", completed: false, priority: "medium", category: "missing" },
        { id: 54, text: "Help and documentation page", completed: false, priority: "low", category: "missing" },
        { id: 55, text: "About page with version information", completed: false, priority: "low", category: "missing" }
    ]);

    const [newTodoText, setNewTodoText] = useState('');
    const [newTodoPriority, setNewTodoPriority] = useState('medium');
    const [newTodoCategory, setNewTodoCategory] = useState('core');
    const [showAddTodo, setShowAddTodo] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');

    const [partiesList, setPartiesList] = useState([]);
    const [partyOutstanding, setPartyOutstanding] = useState([]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    const [receivableList, setReceivableList] = useState([]);
    const [payableList, setPayableList] = useState([]);

    // Load todos from Firebase
    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;
        
        const loadTodos = async () => {
            try {
                const todosSnap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/todos`));
                const loadedTodos = [];
                todosSnap.forEach(doc => {
                    loadedTodos.push({ id: parseInt(doc.id), ...doc.data() });
                });
                
                if (loadedTodos.length > 0) {
                    setTodos(loadedTodos);
                }
            } catch (error) {
                console.error('Error loading todos:', error);
            }
        };
        
        loadTodos();
    }, [db, userId, isAuthReady, appId]);

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
                
                // Try to find the payment for that invoice with the largest allocatedAmount
                let lastPaymentDate = null;
                let lastPaymentAmount = null;
                const billPayments = paymentsData.filter(p =>
                    p.allocations && p.allocations.some(a => a.billId === oldestOutstandingBill.id && a.billType === 'invoice') && (p.date || p.paymentDate)
                );
                
                if (billPayments.length > 0) {
                    // Find the allocation with the largest allocatedAmount for this bill
                    let maxAllocated = 0;
                    let paymentWithMax = null;
                    billPayments.forEach(p => {
                        const allocation = p.allocations.find(a => a.billId === oldestOutstandingBill.id && a.billType === 'invoice');
                        if (allocation && allocation.allocatedAmount > maxAllocated) {
                            maxAllocated = allocation.allocatedAmount;
                            paymentWithMax = p;
                        }
                    });
                    if (paymentWithMax) {
                        lastPaymentDate = paymentWithMax.date || paymentWithMax.paymentDate;
                        lastPaymentAmount = maxAllocated;
                    } else {
                        // fallback to latest payment date
                        lastPaymentDate = billPayments.reduce((latest, p) => {
                            const paymentDate = p.date || p.paymentDate;
                            return (!latest || new Date(paymentDate) > new Date(latest)) ? paymentDate : latest;
                        }, null);
                    }
                } else {
                    // If not found, look for the latest payment for any previous invoice
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
                    let previousPaymentDate = null;
                    let previousPaymentAmount = null;
                    previousBills.forEach(bill => {
                        const prevPayments = paymentsData.filter(p =>
                            p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'invoice') && (p.date || p.paymentDate)
                        );
                        prevPayments.forEach(p => {
                            const paymentDate = p.date || p.paymentDate;
                            if (!previousPaymentDate || new Date(paymentDate) > new Date(previousPaymentDate)) {
                                previousPaymentDate = paymentDate;
                                // Find allocation for this bill
                                const allocation = p.allocations.find(a => a.billId === bill.id && a.billType === 'invoice');
                                previousPaymentAmount = allocation ? allocation.allocatedAmount : null;
                            }
                        });
                    });
                    if (previousPaymentDate) {
                        lastPaymentDate = previousPaymentDate;
                        lastPaymentAmount = previousPaymentAmount;
                    }
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

            // Calculate outstanding payables
            let payables = [];
            parties.forEach(party => {
                // Find all purchase bills for this party, sorted by bill number (or date)
                const partyBills = purchaseBills.filter(bill => (bill.party || bill.supplierId) === party.id);
                // Sort by date, then bill number (ascending)
                partyBills.sort((a, b) => {
                    const dateA = new Date(a.billDate || a.date);
                    const dateB = new Date(b.billDate || b.date);
                    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
                    return (a.number || a.billNumber || '').localeCompare(b.number || b.billNumber || '');
                });
                // Find the oldest outstanding bill
                let oldestOutstandingBill = null;
                for (let bill of partyBills) {
                    const totalAmount = parseFloat(bill.amount || bill.totalAmount || 0);
                    const billPayments = paymentsData.filter(p =>
                        p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase')
                    );
                    const totalPaid = billPayments.reduce((sum, payment) => {
                        const allocation = payment.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
                        return sum + (allocation ? allocation.allocatedAmount : 0);
                    }, 0);
                    if (totalAmount > totalPaid) {
                        oldestOutstandingBill = bill;
                        break;
                    }
                }
                if (!oldestOutstandingBill) return;
                
                // Try to find the payment for that bill with the largest allocatedAmount
                let lastPaymentDate = null;
                let lastPaymentAmount = null;
                const billPayments = paymentsData.filter(p =>
                    p.allocations && p.allocations.some(a => a.billId === oldestOutstandingBill.id && a.billType === 'purchase') && (p.date || p.paymentDate)
                );
                
                if (billPayments.length > 0) {
                    // Find the allocation with the largest allocatedAmount for this bill
                    let maxAllocated = 0;
                    let paymentWithMax = null;
                    billPayments.forEach(p => {
                        const allocation = p.allocations.find(a => a.billId === oldestOutstandingBill.id && a.billType === 'purchase');
                        if (allocation && allocation.allocatedAmount > maxAllocated) {
                            maxAllocated = allocation.allocatedAmount;
                            paymentWithMax = p;
                        }
                    });
                    if (paymentWithMax) {
                        lastPaymentDate = paymentWithMax.date || paymentWithMax.paymentDate;
                        lastPaymentAmount = maxAllocated;
                    } else {
                        // fallback to latest payment date
                        lastPaymentDate = billPayments.reduce((latest, p) => {
                            const paymentDate = p.date || p.paymentDate;
                            return (!latest || new Date(paymentDate) > new Date(latest)) ? paymentDate : latest;
                        }, null);
                    }
                } else {
                    // If not found, look for the latest payment for any previous bill
                    const oldestDate = new Date(oldestOutstandingBill.billDate || oldestOutstandingBill.date);
                    const oldestNumber = oldestOutstandingBill.number || oldestOutstandingBill.billNumber || '';
                    const previousBills = partyBills.filter(bill => {
                        const billDate = new Date(bill.billDate || bill.date);
                        if (billDate < oldestDate) return true;
                        if (billDate.getTime() === oldestDate.getTime()) {
                            return (bill.number || bill.billNumber || '') < oldestNumber;
                        }
                        return false;
                    });
                    let previousPaymentDate = null;
                    let previousPaymentAmount = null;
                    previousBills.forEach(bill => {
                        const prevPayments = paymentsData.filter(p =>
                            p.allocations && p.allocations.some(a => a.billId === bill.id && a.billType === 'purchase') && (p.date || p.paymentDate)
                        );
                        prevPayments.forEach(p => {
                            const paymentDate = p.date || p.paymentDate;
                            if (!previousPaymentDate || new Date(paymentDate) > new Date(previousPaymentDate)) {
                                previousPaymentDate = paymentDate;
                                // Find allocation for this bill
                                const allocation = p.allocations.find(a => a.billId === bill.id && a.billType === 'purchase');
                                previousPaymentAmount = allocation ? allocation.allocatedAmount : null;
                            }
                        });
                    });
                    if (previousPaymentDate) {
                        lastPaymentDate = previousPaymentDate;
                        lastPaymentAmount = previousPaymentAmount;
                    }
                }
                // Calculate total outstanding for this party
                const outstandingBills = partyBills.filter(bill => {
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

    const toggleTodo = async (id) => {
        const updatedTodos = todos.map(todo => 
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
        );
        setTodos(updatedTodos);
        
        // Save to Firebase
        if (db && userId && isAuthReady) {
            try {
                const todoRef = doc(db, `artifacts/${appId}/users/${userId}/todos`, id.toString());
                const todo = updatedTodos.find(t => t.id === id);
                await setDoc(todoRef, todo);
            } catch (error) {
                console.error('Error saving todo:', error);
            }
        }
    };

    const addTodo = async () => {
        if (!newTodoText.trim()) return;
        
        const newTodo = {
            id: Date.now(),
            text: newTodoText.trim(),
            completed: false,
            priority: newTodoPriority,
            category: newTodoCategory,
            createdAt: new Date().toISOString()
        };
        
        const updatedTodos = [...todos, newTodo];
        setTodos(updatedTodos);
        
        // Save to Firebase
        if (db && userId && isAuthReady) {
            try {
                const todoRef = doc(db, `artifacts/${appId}/users/${userId}/todos`, newTodo.id.toString());
                await setDoc(todoRef, newTodo);
            } catch (error) {
                console.error('Error saving new todo:', error);
            }
        }
        
        setNewTodoText('');
        setNewTodoPriority('medium');
        setNewTodoCategory('core');
        setShowAddTodo(false);
    };

    const removeTodo = async (id) => {
        const updatedTodos = todos.filter(todo => todo.id !== id);
        setTodos(updatedTodos);
        
        // Remove from Firebase
        if (db && userId && isAuthReady) {
            try {
                const todoRef = doc(db, `artifacts/${appId}/users/${userId}/todos`, id.toString());
                await deleteDoc(todoRef);
            } catch (error) {
                console.error('Error removing todo:', error);
            }
        }
    };

    const getCategoryColor = (category) => {
        switch(category) {
            case 'core': return 'bg-blue-100 text-blue-800';
            case 'wms': return 'bg-purple-100 text-purple-800';
            case 'advanced': return 'bg-green-100 text-green-800';
            case 'integration': return 'bg-orange-100 text-orange-800';
            case 'mobile': return 'bg-pink-100 text-pink-800';
            case 'analytics': return 'bg-indigo-100 text-indigo-800';
            case 'security': return 'bg-red-100 text-red-800';
            case 'ux': return 'bg-yellow-100 text-yellow-800';
            case 'missing': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getCategoryLabel = (category) => {
        switch(category) {
            case 'core': return 'Core';
            case 'wms': return 'WMS';
            case 'advanced': return 'Advanced';
            case 'integration': return 'Integration';
            case 'mobile': return 'Mobile';
            case 'analytics': return 'Analytics';
            case 'security': return 'Security';
            case 'ux': return 'UX';
            case 'missing': return 'Missing';
            default: return 'Other';
        }
    };

    const filteredTodos = filterCategory === 'all' 
        ? todos 
        : todos.filter(todo => todo.category === filterCategory);

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
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Outstanding Receivable</h3>
                            <Link 
                                to="/payments?tab=invoice" 
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
                            >
                                <span>View More</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
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
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Outstanding Payable</h3>
                            <Link 
                                to="/payments?tab=purchase" 
                                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2"
                            >
                                <span>View More</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
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
                        
                        {/* Company Logo and Basic Info */}
                        <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0">
                                {companyDetails.logoUrl ? (
                                    <img 
                                        src={companyDetails.logoUrl} 
                                        alt="Company Logo" 
                                        className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                                    />
                                ) : (
                                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-gray-200">
                                        <span className="text-2xl font-bold text-blue-600">
                                            {companyDetails.firmName ? companyDetails.firmName[0].toUpperCase() : 'A'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-semibold text-gray-900">
                                    {companyDetails.firmName || 'Company Name Not Set'}
                                </h4>
                                <p className="text-sm text-gray-600">
                                    {companyDetails.gstinType || 'Business Type Not Set'}
                                </p>
                            </div>
                        </div>

                        {/* Company Details Grid */}
                        <div className="space-y-4 mb-6">
                            {/* First Row - GSTIN and Contact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-2 p-3 bg-blue-50 rounded-lg">
                                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">GSTIN</span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {companyDetails.gstin || 'Not set'}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col space-y-2 p-3 bg-green-50 rounded-lg">
                                    <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Contact</span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {companyDetails.contactNumber || 'Not set'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Second Row - Email (Full Width) */}
                            <div className="flex flex-col space-y-2 p-3 bg-purple-50 rounded-lg">
                                <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">Email</span>
                                <span className="text-sm font-semibold text-gray-800">
                                    {companyDetails.email || 'Not set'}
                                </span>
                            </div>
                            
                            {/* Third Row - Address (Full Width) */}
                            <div className="flex flex-col space-y-2 p-3 bg-orange-50 rounded-lg">
                                <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Address</span>
                                <span className="text-sm font-semibold text-gray-800 break-words leading-relaxed">
                                    {companyDetails.address ? 
                                        `${companyDetails.address}${companyDetails.city ? `, ${companyDetails.city}` : ''}${companyDetails.state ? `, ${companyDetails.state}` : ''}${companyDetails.pincode ? ` - ${companyDetails.pincode}` : ''}` 
                                        : 'Not set'
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Business Statistics */}
                        <div className="border-t border-gray-200 pt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Business Statistics</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center space-x-2 px-3 py-2 bg-blue-100 rounded-full">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    <span className="text-sm font-medium text-blue-800">
                                        {totalCustomers} Customers
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 rounded-full">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    <span className="text-sm font-medium text-green-800">
                                        {totalSuppliers} Suppliers
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2 px-3 py-2 bg-purple-100 rounded-full">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                    <span className="text-sm font-medium text-purple-800">
                                        {totalItems} Items
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Todo List */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">To Do List</h3>
                            <button
                                onClick={() => setShowAddTodo(!showAddTodo)}
                                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                            >
                                {showAddTodo ? 'Cancel' : '+ Add Item'}
                            </button>
                        </div>

                        {/* Add New Todo Form */}
                        {showAddTodo && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={newTodoText}
                                        onChange={(e) => setNewTodoText(e.target.value)}
                                        placeholder="Enter new todo item..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                                    />
                                    <div className="flex gap-3">
                                        <select
                                            value={newTodoPriority}
                                            onChange={(e) => setNewTodoPriority(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="high">High Priority</option>
                                            <option value="medium">Medium Priority</option>
                                            <option value="low">Low Priority</option>
                                        </select>
                                        <select
                                            value={newTodoCategory}
                                            onChange={(e) => setNewTodoCategory(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="core">Core Business</option>
                                            <option value="wms">WMS Features</option>
                                            <option value="advanced">Advanced Features</option>
                                            <option value="integration">Integration</option>
                                            <option value="mobile">Mobile</option>
                                            <option value="analytics">Analytics</option>
                                            <option value="security">Security</option>
                                            <option value="ux">User Experience</option>
                                            <option value="missing">Missing Pages</option>
                                        </select>
                                        <button
                                            onClick={addTodo}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Category Filter */}
                        <div className="mb-4">
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">All Categories</option>
                                <option value="core">Core Business</option>
                                <option value="wms">WMS Features</option>
                                <option value="advanced">Advanced Features</option>
                                <option value="integration">Integration</option>
                                <option value="mobile">Mobile</option>
                                <option value="analytics">Analytics</option>
                                <option value="security">Security</option>
                                <option value="ux">User Experience</option>
                                <option value="missing">Missing Pages</option>
                            </select>
                        </div>

                        {/* Progress Summary */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-blue-800">
                                    Completed: {todos.filter(t => t.completed).length} / {todos.length}
                                </span>
                                <span className="text-blue-800">
                                    {Math.round((todos.filter(t => t.completed).length / todos.length) * 100)}% Complete
                                </span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(todos.filter(t => t.completed).length / todos.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Todo Items */}
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {filteredTodos.map((todo) => (
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
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(todo.category)}`}>
                                            {getCategoryLabel(todo.category)}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(todo.priority)}`}>
                                            {todo.priority}
                                        </span>
                                        <button
                                            onClick={() => removeTodo(todo.id)}
                                            className="text-red-500 hover:text-red-700 text-sm"
                                            title="Remove item"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {filteredTodos.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                {filterCategory === 'all' ? 'No todo items found.' : `No items in ${getCategoryLabel(filterCategory)} category.`}
                            </div>
                        )}

                        <p className="text-sm text-gray-500 mt-4">
                            These features are planned for future development. Check them off as they're completed! Later we'll convert this to a full WMS system.
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