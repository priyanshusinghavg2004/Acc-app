import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { getCompanyInfo, getCompanyTypeLabel } from '../utils/companyUtils';

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
    const [companyInfo, setCompanyInfo] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [message, setMessage] = useState('');
    const [payments, setPayments] = useState([]);
    


    // Todo list state
    const [todos, setTodos] = useState([
        // Personal Tasks
        { id: 1, text: "kal collectorate me meating hai 10 baje", completed: true, priority: "medium", category: "personal" },
        { id: 2, text: "Welcome ka 5x3 aur 6x4 ka banner bhejna hai 11 baje tak", completed: true, priority: "medium", category: "urgent" },
        { id: 3, text: "RB ko payment ke liye bolna hai", completed: true, priority: "medium", category: "followup" },
    ]);

    const [newTodoText, setNewTodoText] = useState('');
    const [newTodoPriority, setNewTodoPriority] = useState('medium');
    const [newTodoCategory, setNewTodoCategory] = useState('personal');
    const [showAddTodo, setShowAddTodo] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');

    const [partiesList, setPartiesList] = useState([]);
    const [partyOutstanding, setPartyOutstanding] = useState([]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    const [receivableList, setReceivableList] = useState([]);
    const [payableList, setPayableList] = useState([]);
  // Privacy: collapse toggles for outstanding tables
  const [hideReceivable, setHideReceivable] = useState(() => {
    try { return localStorage.getItem('dash_hide_receivable') === 'true'; } catch (_) { return false; }
  });
  const [hidePayable, setHidePayable] = useState(() => {
    try { return localStorage.getItem('dash_hide_payable') === 'true'; } catch (_) { return false; }
  });
  useEffect(() => { try { localStorage.setItem('dash_hide_receivable', String(hideReceivable)); } catch (_) {} }, [hideReceivable]);
  useEffect(() => { try { localStorage.setItem('dash_hide_payable', String(hidePayable)); } catch (_) {} }, [hidePayable]);

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
            // Load user info and company info
            try {
                const userDoc = await getDocs(collection(db, 'users'));
                userDoc.forEach(doc => {
                    if (doc.id === userId) {
                        const userData = doc.data();
                        setUserInfo(userData);
                        
                        // Load company info if user has company ID
                        if (userData.companyId) {
                            getCompanyInfo(userData.companyId, appId).then(companyData => {
                                setCompanyInfo(companyData);
                            });
                        }
                    }
                });
            } catch (error) {
                console.error('Error loading user/company info:', error);
            }
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
            let receivable = party.openingBalance > 0 ? party.openingBalance : 0; // Start with positive opening balance
            let payable = party.openingBalance < 0 ? Math.abs(party.openingBalance) : 0; // Start with negative opening balance
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
            case 'personal': return 'bg-blue-100 text-blue-800';
            case 'meeting': return 'bg-green-100 text-green-800';
            case 'urgent': return 'bg-red-100 text-red-800';
            case 'followup': return 'bg-yellow-100 text-yellow-800';
            case 'business': return 'bg-purple-100 text-purple-800';
            case 'reminder': return 'bg-orange-100 text-orange-800';
            case 'project': return 'bg-indigo-100 text-indigo-800';
            case 'other': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getCategoryLabel = (category) => {
        switch(category) {
            case 'personal': return 'Personal';
            case 'meeting': return 'Meeting';
            case 'urgent': return 'Urgent';
            case 'followup': return 'Follow Up';
            case 'business': return 'Business';
            case 'reminder': return 'Reminder';
            case 'project': return 'Project';
            case 'other': return 'Other';
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
            <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 id="dashboard-title" className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
                    <p className="text-sm sm:text-base text-gray-600">Welcome back! Here's your business overview.</p>
                </div>

                {/* Quick Action Buttons */}
                <div className="mb-6 sm:mb-8" id="quick-actions">
                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 quick-actions-section">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <Link 
                                to="/sales"
                                id="qa-sales"
                                className="flex items-center justify-center p-4 sm:p-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[120px] sm:min-h-[140px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2 sm:mb-3">
                                        <svg className="w-8 h-8 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm sm:text-lg font-bold mb-1">Create Sales Invoice</h3>
                                    <p className="text-green-100 text-xs sm:text-sm">Generate invoices and manage sales</p>
                                </div>
                            </Link>
                            
                            <Link 
                                to="/purchases"
                                id="qa-purchases"
                                className="flex items-center justify-center p-4 sm:p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[120px] sm:min-h-[140px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2 sm:mb-3">
                                        <svg className="w-8 h-8 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm sm:text-lg font-bold mb-1">Create Purchase Bill</h3>
                                    <p className="text-blue-100 text-xs sm:text-sm">Record purchases and manage vendors</p>
                                </div>
                            </Link>

                            <Link 
                                to="/payments"
                                id="qa-payments"
                                className="flex items-center justify-center p-4 sm:p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[120px] sm:min-h-[140px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2 sm:mb-3">
                                        <svg className="w-8 h-8 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm sm:text-lg font-bold mb-1">Manage Payments</h3>
                                    <p className="text-purple-100 text-xs sm:text-sm">Track receivables and payables</p>
                                </div>
                            </Link>

                            <Link 
                                to="/parties"
                                id="qa-parties"
                                className="flex items-center justify-center p-4 sm:p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[120px] sm:min-h-[140px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2 sm:mb-3">
                                        <svg className="w-8 h-8 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm sm:text-lg font-bold mb-1">Manage Parties</h3>
                                    <p className="text-orange-100 text-xs sm:text-sm">Add customers and suppliers</p>
                                </div>
                            </Link>
                        </div>
                        
                        {/* Secondary Quick Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <Link 
                                to="/items"
                                id="qa-items"
                                className="flex items-center justify-center p-3 sm:p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[100px] sm:min-h-[120px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2">
                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-bold mb-1">Manage Items</h3>
                                    <p className="text-teal-100 text-xs">Add products and services</p>
                                </div>
                            </Link>

                            <Link 
                                to="/expenses"
                                id="qa-expenses"
                                className="flex items-center justify-center p-3 sm:p-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[100px] sm:min-h-[120px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2">
                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2m7-5H7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-bold mb-1">Expenses</h3>
                                    <p className="text-red-100 text-xs">Record daily expenses</p>
                                </div>
                            </Link>

                            <Link 
                                to="/reports"
                                id="qa-reports"
                                className="flex items-center justify-center p-3 sm:p-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[100px] sm:min-h-[120px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2">
                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-bold mb-1">Reports</h3>
                                    <p className="text-pink-100 text-xs">Business analytics</p>
                                </div>
                            </Link>

                            <Link 
                                to="/taxes"
                                id="qa-taxes"
                                className="flex items-center justify-center p-3 sm:p-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200 transform hover:scale-105 shadow-lg min-h-[100px] sm:min-h-[120px]"
                            >
                                <div className="text-center">
                                    <div className="mb-2">
                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-bold mb-1">Taxes</h3>
                                    <p className="text-yellow-100 text-xs">View and manage taxes</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Your To Do List (moved under Quick Actions) */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6 sm:mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 todo-list-section">Your To Do List</h3>
                    <button
                      onClick={() => setShowAddTodo(!showAddTodo)}
                      className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      {showAddTodo ? 'Cancel' : '+ Add Item'}
                    </button>
                  </div>

                  {showAddTodo && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newTodoText}
                          onChange={(e) => setNewTodoText(e.target.value)}
                          placeholder="What do you want to get done?"
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
                            <option value="personal">Personal</option>
                            <option value="meeting">Meeting</option>
                            <option value="urgent">Urgent Work</option>
                            <option value="followup">Follow Up</option>
                            <option value="business">Business</option>
                            <option value="reminder">Reminder</option>
                            <option value="project">Project</option>
                            <option value="other">Other</option>
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

                  <div className="mb-4">
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Categories</option>
                      <option value="personal">Personal</option>
                      <option value="meeting">Meeting</option>
                      <option value="urgent">Urgent Work</option>
                      <option value="followup">Follow Up</option>
                      <option value="business">Business</option>
                      <option value="reminder">Reminder</option>
                      <option value="project">Project</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-800">Completed: {todos.filter(t => t.completed).length} / {todos.length}</span>
                      <span className="text-blue-800">{Math.round((todos.filter(t => t.completed).length / (todos.length || 1)) * 100)}% Complete</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(todos.filter(t => t.completed).length / (todos.length || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>

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
                </div>

            {message && (
                    <div className={`p-4 mb-6 rounded-lg ${message.includes('Error') ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                    {message}
                </div>
            )}

                {/* Stats Cards with privacy toggle */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-gray-800">Quick Summary</h3>
                  <button
                    id="quick-summary-toggle"
                    onClick={() => {
                      const next = document.getElementById('dash-stats-cards')?.style?.display === 'none' ? 'block' : 'none';
                      const el = document.getElementById('dash-stats-cards');
                      if (el) el.style.display = next;
                      try { localStorage.setItem('dash_hide_stats', String(next === 'none')); } catch (_) {}
                    }}
                    className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
                  >
                    {(() => { try { return localStorage.getItem('dash_hide_stats') === 'true' ? 'Show' : 'Hide'; } catch (_) { return 'Hide'; } })()}
                  </button>
                </div>
                <div id="dash-stats-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8" style={{ display: (typeof window !== 'undefined' && localStorage.getItem('dash_hide_stats') === 'true') ? 'none' : 'grid' }}>
                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Monthly Sales</p>
                                <p className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(totalSalesThisMonth)}</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-green-100 rounded-full">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Monthly Purchases</p>
                                <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(totalPurchasesThisMonth)}</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Outstanding Receivables</p>
                                <p className="text-lg sm:text-2xl font-bold text-orange-600">{formatCurrency(totalOutstandingReceivables)}</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-orange-100 rounded-full">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Outstanding Payables</p>
                                <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(totalOutstandingPayables)}</p>
                            </div>
                            <div className="p-2 sm:p-3 bg-red-100 rounded-full">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>



                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Outstanding Receivable */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100" id="outstanding-receivable-section">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Outstanding Receivable</h3>
                            <div className="flex items-center gap-2">
                              <button
                                id="outstanding-receivable-toggle"
                                onClick={() => setHideReceivable(v => !v)}
                                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
                              >
                                {hideReceivable ? 'Show' : 'Hide'}
                              </button>
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
                        </div>
                        <div style={{ display: hideReceivable ? 'none' : 'block' }}>
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
                    </div>
                    {/* Outstanding Payable */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100" id="outstanding-payable-section">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Outstanding Payable</h3>
                            <div className="flex items-center gap-2">
                              <button
                                id="outstanding-payable-toggle"
                                onClick={() => setHidePayable(v => !v)}
                                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
                              >
                                {hidePayable ? 'Show' : 'Hide'}
                              </button>
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
                        </div>
                        <div style={{ display: hidePayable ? 'none' : 'block' }}>
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
                </div>

                {/* Company Information (full-width, centered, compact) */}
                <div className="bg-white rounded-lg shadow p-4 border border-gray-100 mb-6" id="company-info">
                  <div className="flex flex-col items-center text-center gap-1">
                    {companyDetails.logoUrl ? (
                      <img src={companyDetails.logoUrl} alt="Company Logo" className="w-12 h-12 rounded object-cover border border-gray-200" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center border border-gray-200">
                        <span className="text-lg font-bold text-gray-600">{companyDetails.firmName ? companyDetails.firmName[0].toUpperCase() : 'A'}</span>
                      </div>
                    )}
                    <div className="text-base font-semibold text-gray-900">{companyDetails.firmName || 'Company Name Not Set'}</div>
                    <div className="text-xs text-gray-500">{companyDetails.gstinType || 'Business Type Not Set'}</div>
                  </div>

                  <div className="mt-3 text-sm text-gray-800 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
                    {companyInfo && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-gray-500">Company ID</span>
                        <span className="font-mono break-all">{companyInfo.companyId}</span>
                      </div>
                    )}
                    <div><span className="text-[10px] uppercase text-gray-500 mr-1">GSTIN</span>{companyDetails.gstin || '—'}</div>
                    <div><span className="text-[10px] uppercase text-gray-500 mr-1">Contact</span>{companyDetails.contactNumber || '—'}</div>
                    <div><span className="text-[10px] uppercase text-gray-500 mr-1">Email</span>{companyDetails.email || '—'}</div>
                  </div>

                  <div className="mt-2 text-sm text-center text-gray-800">
                    <span className="text-[10px] uppercase text-gray-500 mr-1">Address</span>
                    {companyDetails.address ? `${companyDetails.address}${companyDetails.city ? `, ${companyDetails.city}` : ''}${companyDetails.state ? `, ${companyDetails.state}` : ''}${companyDetails.pincode ? ` - ${companyDetails.pincode}` : ''}` : '—'}
                  </div>

                  <div className="mt-2 flex justify-center gap-4 text-xs text-gray-600">
                    <div>{totalCustomers} Customers</div>
                    <div>{totalSuppliers} Suppliers</div>
                    <div>{totalItems} Items</div>
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