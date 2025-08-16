import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase.config';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { migrateExpenseData, checkMigrationNeeded } from '../utils/migrateExpenseData';


const GROUPS = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'variable', label: 'Variable' },
  { key: 'advances', label: 'Labour/Advances' },
  { key: 'employee', label: 'Employees' },
  { key: 'salaries', label: 'Salary' },
];

const FIXED_HEADS = ['Rent', 'Electricity', 'Internet', 'Water', 'Other'];
const VARIABLE_HEADS = ['Office Expense', 'Stationery', 'Travel', 'Miscellaneous'];

const storage = getStorage();
const PAGE_SIZE_OPTIONS = [10, 20, 50];

// Employee ID generator utility
function generateEmployeeId(employees) {
  const maxId = employees.reduce((max, emp) => {
    const match = (emp.employeeId || '').match(/^EMP(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `EMP${String(maxId + 1).padStart(3, '0')}`;
}

// 1. Add helper function at the top of the component
function getMonthlySalaryRows(emp) {
  if (!emp) return [];
  
  // Use the calculated actual amounts that are saved in the database
  const basicSalary = Number(emp.basicSalaryAmount || emp.basicSalary || 0);
  const hraAmount = Number(emp.hraAmount || emp.hra || 0);
  const conveyanceAmount = Number(emp.conveyanceAmount || emp.conveyanceAllowance || 0);
  const employerPFAmount = Number(emp.employerPFAmount || emp.employerPF || 0);
  const gratuityAmount = Number(emp.gratuityAmount || emp.gratuity || 0);
  const specialAllowanceAmount = Number(emp.specialAllowanceAmount || emp.specialAllowance || 0);
  
  return [
    { type: 'Basic Salary', amount: (basicSalary / 12).toFixed(2), remark: 'Fixed Component', fixed: true, removable: false },
    { type: 'HRA', amount: (hraAmount / 12).toFixed(2), remark: 'Fixed Component', fixed: true, removable: false },
    { type: 'Conveyance', amount: (conveyanceAmount / 12).toFixed(2), remark: 'Fixed Component', fixed: true, removable: false },
    { type: 'Employer PF', amount: (employerPFAmount / 12).toFixed(2), remark: 'Fixed Component', fixed: true, removable: false },
    { type: 'Gratuity', amount: (gratuityAmount / 12).toFixed(2), remark: 'Fixed Component', fixed: true, removable: false },
    { type: 'Special Allowance', amount: (specialAllowanceAmount / 12).toFixed(2), remark: 'Fixed Component', fixed: true, removable: false },
  ];
}

// 1. Add helper function at the top of the component
function getComponentAnnualAmount(type, value, mode, basicSalary, ctc) {
  if (mode === 'percentage') {
    if (['HRA', 'Employer PF', 'Gratuity'].includes(type)) {
      return ((Number(basicSalary) || 0) * (Number(value) || 0) / 100).toFixed(2);
    } else {
      // For others, % of CTC
      return ((Number(ctc) || 0) * (Number(value) || 0) / 100).toFixed(2);
    }
  } else {
    return (Number(value) || 0).toFixed(2);
  }
}

const Expenses = ({ db, userId, isAuthReady, appId, setShowSettings }) => {
  // Component loaded successfully (only log once)
  useEffect(() => {
  
  }, []);
  

  const [selectedGroup, setSelectedGroup] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const tab = params.get('tab');
      if (tab && GROUPS.some(g => g.key === tab)) return tab;
    } catch {}
    return GROUPS[0].key;
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (params.get('tab') !== selectedGroup) {
      params.set('tab', selectedGroup);
      const base = window.location.hash.split('?')[0];
      const next = `${base}?${params.toString()}`;
      if (window.location.hash !== next) window.location.hash = next;
    }
  }, [selectedGroup]);

  // Respond to hash changes (for deep-linking from tours)
  useEffect(() => {
    const handler = () => {
      try {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const tab = params.get('tab');
        if (tab && GROUPS.some(g => g.key === tab) && tab !== selectedGroup) {
          setSelectedGroup(tab);
        }
      } catch {}
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [selectedGroup]);
  const [filters, setFilters] = useState({ date: '', head: '', amount: '' });
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportRef = useRef();

  // Employees - Updated to be user-specific
  const [employees, setEmployees] = useState([]);
  const [employeeForm, setEmployeeForm] = useState({ 
    name: '', 
    personType: 'Employee',
    designation: '', 
    basicSalary: '', 
    hra: '', 
    hraType: 'amount', // 'percentage' or 'amount'
    conveyanceAllowance: '',
    conveyanceAllowanceType: 'amount', // 'percentage' or 'amount'
    employerPF: '',
    employerPFType: 'amount', // 'percentage' or 'amount'
    gratuity: '',
    gratuityType: 'amount', // 'percentage' or 'amount'
    specialAllowance: '',
    specialAllowanceType: 'amount', // 'percentage' or 'amount'
    contact: '', 
    aadhaar: '', 
    pan: '', 
    bankName: '',
    bankAccount: '', 
    ifsc: '', 
    address: '' 
  });
  const [employeeDocuments, setEmployeeDocuments] = useState({
    aadhaarCard: null,
    panCard: null,
    bankPassbook: null,
    photo: null,
    resume: null,
    otherDocuments: []
  });
  const [salaryForm, setSalaryForm] = useState({ employeeId: '', month: '', amount: '', remarks: '' });
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState({});
  const [editingEmployeeDocuments, setEditingEmployeeDocuments] = useState({
    aadhaarCard: null,
    panCard: null,
    bankPassbook: null,
    photo: null,
    resume: null,
    otherDocuments: []
  });

  // KYC validation states
  const [kycErrors, setKycErrors] = useState({
    contact: '',
    aadhaar: '',
    pan: '',
    bankName: '',
    bankAccount: '',
    ifsc: ''
  });
  const [showEditForm, setShowEditForm] = useState(false);

  // Expenses
  const [expenseForm, setExpenseForm] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    head: '', 
    amount: '', 
    description: '', 
    receipt: null,
    paymentMode: 'Cash'
  });
  const [expenses, setExpenses] = useState([]);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingExpense, setEditingExpense] = useState({});

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');



  // --- Salary Tab State ---
  const [fixedSalaryRows, setFixedSalaryRows] = useState([]);
  const [performanceSalaryRows, setPerformanceSalaryRows] = useState([]);
  const [salaryDeductions, setSalaryDeductions] = useState([]);
  const [salaryEmployeeId, setSalaryEmployeeId] = useState('');
  const [salaryDate, setSalaryDate] = useState('');
  const [salaryMonth, setSalaryMonth] = useState('');
  const [salarySearch, setSalarySearch] = useState('');
  const [salaryError, setSalaryError] = useState('');
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [salaryPaymentMode, setSalaryPaymentMode] = useState('Cash');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedEmployeeIndex, setSelectedEmployeeIndex] = useState(-1);
  const [selectedEmployeeDisplay, setSelectedEmployeeDisplay] = useState('');
  const [editingSalaryPayment, setEditingSalaryPayment] = useState(null);
  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  
  // Irregular payments (Labour/Advances)
  const [irregularPayments, setIrregularPayments] = useState([]);
  const [irregularForm, setIrregularForm] = useState({
    date: new Date().toISOString().split('T')[0],
    personType: 'Employee',
    employeeId: '',
    personName: '',
    paymentType: 'Advance',
    amount: '',
    remark: '',
    paymentMode: 'Cash'
  });
  // id -> 'Earning' | 'Deduction'
  const [appliedIrregularSelections, setAppliedIrregularSelections] = useState({});
  
  // Employee table sorting and pagination
  const [employeeFilters, setEmployeeFilters] = useState({ search: '', designation: '' });
  const [employeeSortKey, setEmployeeSortKey] = useState('name');
  const [employeeSortDir, setEmployeeSortDir] = useState('asc');
  const [employeeCurrentPage, setEmployeeCurrentPage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(10);
  // Manual refresh triggers for rare cases where realtime listener lags
  const reloadExpenses = async () => {
    try {
      if (!isAuthReady || !userId || !appId) return;
      const q = query(collection(db, `artifacts/${appId}/users/${userId}/expenses`), where('group', '==', selectedGroup));
      const snap = await getDocs(q);
      const expenseData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(expenseData);
    } catch (e) {
      console.warn('reloadExpenses failed', e);
    }
  };
  const reloadSalaryPayments = async () => {
    try {
      if (!isAuthReady || !userId || !appId) return;
      const snap = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`));
      const payments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSalaryPayments(payments);
    } catch (e) {
      console.warn('reloadSalaryPayments failed', e);
    }
  };

  // --- Firestore listeners ---
  useEffect(() => {
    // Employees - Updated to be user-specific
    if (!isAuthReady || !userId || !appId) {
      console.log('Skipping employees listener - not ready:', { isAuthReady, userId, appId });
      return;
    }
    
    const unsub = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/employees`), snap => {
      const employeeData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(employeeData);
    }, (error) => {
      console.error('Error in employees listener:', error);
    });
    return () => unsub();
  }, [isAuthReady, userId, appId]);

  useEffect(() => {
    // Expenses for selected group - Updated to be user-specific
    if (!isAuthReady || !userId || !appId) {
      console.log('Skipping expenses listener - not ready:', { isAuthReady, userId, appId });
      return;
    }
    
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/expenses`), where('group', '==', selectedGroup));
    const unsub = onSnapshot(q, snap => {
      const expenseData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(expenseData);
    }, (error) => {
      console.error('Error in expenses listener:', error);
    });
    return () => unsub();
  }, [selectedGroup, isAuthReady, userId, appId]);

  useEffect(() => {
    // Salary Payments - Updated to be user-specific
    if (!isAuthReady || !userId || !appId) {
      return;
    }
    
    const unsub = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`), snap => {
      const payments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSalaryPayments(payments);
    }, (error) => {
      console.error('Error in salary payments listener:', error);
    });
    
    return () => unsub();
  }, [isAuthReady, userId, appId]);

  useEffect(() => {
    // Irregular Payments - Labour/Advances listener
    if (!isAuthReady || !userId || !appId) return;
    const unsub = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/irregularPayments`), snap => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIrregularPayments(rows);
    }, (error) => {
      console.error('Error in irregular payments listener:', error);
    });
    return () => unsub();
  }, [isAuthReady, userId, appId]);

  // ESC key handler for edit modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        console.log('ESC key pressed');
        if (showEditSalaryModal) {
          handleCancelEditSalaryPayment();
        } else if (editingExpenseId) {
          handleCancelEditExpense();
        }
      }
    };

    if (showEditSalaryModal || editingExpenseId) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [showEditSalaryModal, editingExpenseId]);

  // --- Employee handlers ---
  const handleEmployeeFormChange = e => {
    const { name, value } = e.target;
    setEmployeeForm(f => ({ ...f, [name]: value }));
    
    // KYC validation
    if (name === 'contact' && value) {
      const validation = validateContact(value);
      setKycErrors(prev => ({ ...prev, contact: validation.isValid ? '' : validation.message }));
    } else if (name === 'aadhaar' && value) {
      const validation = validateAadhaar(value);
      setKycErrors(prev => ({ ...prev, aadhaar: validation.isValid ? '' : validation.message }));
    } else if (name === 'pan' && value) {
      const validation = validatePAN(value);
      setKycErrors(prev => ({ ...prev, pan: validation.isValid ? '' : validation.message }));
    } else if (name === 'bankAccount' && value) {
      const validation = validateBankAccount(value);
      setKycErrors(prev => ({ ...prev, bankAccount: validation.isValid ? '' : validation.message }));
    } else if (name === 'ifsc' && value) {
      const validation = validateIFSC(value);
      setKycErrors(prev => ({ ...prev, ifsc: validation.isValid ? '' : validation.message }));
    } else if (name === 'bankName' && value) {
      setKycErrors(prev => ({ ...prev, bankName: value.trim() ? '' : 'Bank name is required' }));
    }
    
    // Auto-calculate salary components when CTC changes
    if (name === 'ctc' && value) {
      const salaryBreakdown = calculateSalaryFromCTC(value, employeeForm);
      setEmployeeForm(f => ({
        ...f,
        [name]: value,
        basicSalary: salaryBreakdown.annual.basicSalary.toString(),
        hra: salaryBreakdown.annual.hra.toString(),
        conveyanceAllowance: salaryBreakdown.annual.conveyanceAllowance.toString(),
        employerPF: salaryBreakdown.annual.employerPF.toString(),
        gratuity: salaryBreakdown.annual.gratuity.toString(),
        specialAllowance: salaryBreakdown.annual.specialAllowance.toString()
      }));
    }
    
    // Recalculate when component type or value changes
    if ((name.includes('Type') || name.includes('hra') || name.includes('conveyanceAllowance') || name.includes('employerPF') || name.includes('gratuity') || name.includes('specialAllowance')) && employeeForm.ctc) {
      const salaryBreakdown = calculateSalaryFromCTC(employeeForm.ctc, { ...employeeForm, [name]: value });
      setEmployeeForm(f => ({
        ...f,
        [name]: value,
        // Don't overwrite the input values, just update the calculated totals
        // The calculation function will handle the percentage vs fixed logic
      }));
    }
  };
  // --- Salary calculation functions ---
  const calculateSalaryFromCTC = (ctc, formData = employeeForm) => {
    const annualCTC = Number(ctc) || 0;
    const monthlyCTC = annualCTC / 12;
    
    // Calculate components based on form configuration
    let basicSalary, hra, conveyanceAllowance, employerPF, gratuity, specialAllowance;
    
    // Basic Salary is always fixed amount (no percentage option)
    basicSalary = Number(formData.basicSalary) || 0;
    
    // HRA calculation - percentage of Basic Salary or fixed amount
    if (formData.hraType === 'percentage') {
      const hraPercentage = Number(formData.hra) || 40;
      hra = basicSalary * (hraPercentage / 100);
    } else {
      hra = Number(formData.hra) || 0;
    }
    
    // Conveyance Allowance calculation - percentage of Basic Salary or fixed amount
    if (formData.conveyanceAllowanceType === 'percentage') {
      const conveyancePercentage = Number(formData.conveyanceAllowance) || 0;
      conveyanceAllowance = basicSalary * (conveyancePercentage / 100);
    } else {
      conveyanceAllowance = Number(formData.conveyanceAllowance) || 19200;
    }
    
    // Employer PF calculation - percentage of Basic Salary or fixed amount
    if (formData.employerPFType === 'percentage') {
      const pfPercentage = Number(formData.employerPF) || 12;
      employerPF = basicSalary * (pfPercentage / 100);
    } else {
      employerPF = Number(formData.employerPF) || 0;
    }
    
    // Gratuity calculation - percentage of Basic Salary or fixed amount
    if (formData.gratuityType === 'percentage') {
      const gratuityPercentage = Number(formData.gratuity) || 4.81;
      gratuity = basicSalary * (gratuityPercentage / 100);
    } else {
      gratuity = Number(formData.gratuity) || 0;
    }
    
    // Special Allowance calculation - percentage of Basic Salary or fixed amount
    if (formData.specialAllowanceType === 'percentage') {
      const specialPercentage = Number(formData.specialAllowance) || 0;
      specialAllowance = basicSalary * (specialPercentage / 100);
    } else {
      specialAllowance = Number(formData.specialAllowance) || 0;
    }
    
    return {
      annual: {
        basicSalary: Math.round(basicSalary),
        hra: Math.round(hra),
        conveyanceAllowance: Math.round(conveyanceAllowance),
        employerPF: Math.round(employerPF),
        gratuity: Math.round(gratuity),
        specialAllowance: Math.round(specialAllowance),
        total: annualCTC
      },
      monthly: {
        basicSalary: Math.round(basicSalary / 12),
        hra: Math.round(hra / 12),
        conveyanceAllowance: Math.round(conveyanceAllowance / 12),
        employerPF: Math.round(employerPF / 12),
        gratuity: Math.round(gratuity / 12),
        specialAllowance: Math.round(specialAllowance / 12),
        total: Math.round(monthlyCTC)
      }
    };
  };

  const calculateTotalSalary = () => {
    const basic = Number(employeeForm.basicSalary) || 0;
    
    // Calculate HRA based on type
    let hra = 0;
    if (employeeForm.hraType === 'percentage') {
      const hraPercentage = Number(employeeForm.hra) || 0;
      hra = basic * (hraPercentage / 100);
    } else {
      hra = Number(employeeForm.hra) || 0;
    }
    
    // Calculate Conveyance based on type
    let conveyance = 0;
    if (employeeForm.conveyanceAllowanceType === 'percentage') {
      const conveyancePercentage = Number(employeeForm.conveyanceAllowance) || 0;
      conveyance = basic * (conveyancePercentage / 100);
    } else {
      conveyance = Number(employeeForm.conveyanceAllowance) || 0;
    }
    
    // Calculate Employer PF based on type
    let pf = 0;
    if (employeeForm.employerPFType === 'percentage') {
      const pfPercentage = Number(employeeForm.employerPF) || 0;
      pf = basic * (pfPercentage / 100);
    } else {
      pf = Number(employeeForm.employerPF) || 0;
    }
    
    // Calculate Gratuity based on type
    let gratuity = 0;
    if (employeeForm.gratuityType === 'percentage') {
      const gratuityPercentage = Number(employeeForm.gratuity) || 0;
      gratuity = basic * (gratuityPercentage / 100);
    } else {
      gratuity = Number(employeeForm.gratuity) || 0;
    }
    
    // Calculate Special Allowance based on type
    let special = 0;
    if (employeeForm.specialAllowanceType === 'percentage') {
      const specialPercentage = Number(employeeForm.specialAllowance) || 0;
      special = basic * (specialPercentage / 100);
    } else {
      special = Number(employeeForm.specialAllowance) || 0;
    }
    
    return (basic + hra + conveyance + pf + gratuity + special).toLocaleString('en-IN');
  };

  const calculateEditTotal = () => {
    const basic = Number(editingEmployee.basicSalary) || 0;
    
    // Calculate HRA based on type
    let hra = 0;
    if (editingEmployee.hraType === 'percentage') {
      const hraPercentage = Number(editingEmployee.hra) || 0;
      hra = basic * (hraPercentage / 100);
    } else {
      hra = Number(editingEmployee.hra) || 0;
    }
    
    // Calculate Conveyance based on type
    let conveyance = 0;
    if (editingEmployee.conveyanceAllowanceType === 'percentage') {
      const conveyancePercentage = Number(editingEmployee.conveyanceAllowance) || 0;
      conveyance = basic * (conveyancePercentage / 100);
    } else {
      conveyance = Number(editingEmployee.conveyanceAllowance) || 0;
    }
    
    // Calculate Employer PF based on type
    let pf = 0;
    if (editingEmployee.employerPFType === 'percentage') {
      const pfPercentage = Number(editingEmployee.employerPF) || 0;
      pf = basic * (pfPercentage / 100);
    } else {
      pf = Number(editingEmployee.employerPF) || 0;
    }
    
    // Calculate Gratuity based on type
    let gratuity = 0;
    if (editingEmployee.gratuityType === 'percentage') {
      const gratuityPercentage = Number(editingEmployee.gratuity) || 0;
      gratuity = basic * (gratuityPercentage / 100);
    } else {
      gratuity = Number(editingEmployee.gratuity) || 0;
    }
    
    // Calculate Special Allowance based on type
    let special = 0;
    if (editingEmployee.specialAllowanceType === 'percentage') {
      const specialPercentage = Number(editingEmployee.specialAllowance) || 0;
      special = basic * (specialPercentage / 100);
    } else {
      special = Number(editingEmployee.specialAllowance) || 0;
    }
    
    return (basic + hra + conveyance + pf + gratuity + special).toLocaleString('en-IN');
  };

  // --- KYC Validation Functions ---
  const validateAadhaar = (aadhaar) => {
    // Remove spaces and dashes
    const cleanAadhaar = aadhaar.replace(/[\s-]/g, '');
    
    // Check if it's exactly 12 digits
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return { isValid: false, message: 'Aadhaar must be exactly 12 digits' };
    }
    
    // Check if it doesn't start with 0 or 1
    if (cleanAadhaar.startsWith('0') || cleanAadhaar.startsWith('1')) {
      return { isValid: false, message: 'Aadhaar cannot start with 0 or 1' };
    }
    
    // Verhoeff algorithm check (simplified)
    const digits = cleanAadhaar.split('').map(Number);
    const checkDigit = digits[digits.length - 1];
    const dataDigits = digits.slice(0, -1);
    
    // Simple validation: sum of first 11 digits should not be divisible by 10
    const sum = dataDigits.reduce((acc, digit) => acc + digit, 0);
    if (sum % 10 === 0) {
      return { isValid: false, message: 'Invalid Aadhaar number' };
    }
    
    return { isValid: true, message: 'Valid Aadhaar number' };
  };

  const validatePAN = (pan) => {
    // Remove spaces
    const cleanPAN = pan.replace(/\s/g, '').toUpperCase();
    
    // Check format: ABCDE1234F (5 letters + 4 digits + 1 letter)
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPAN)) {
      return { isValid: false, message: 'PAN must be in format: ABCDE1234F' };
    }
    
    // Check if it's not a fake PAN (common patterns)
    const fakePatterns = ['AAAAA0000A', 'BBBBB0000B', 'CCCCC0000C'];
    if (fakePatterns.includes(cleanPAN)) {
      return { isValid: false, message: 'Invalid PAN number' };
    }
    
    return { isValid: true, message: 'Valid PAN number' };
  };

  const validateIFSC = (ifsc) => {
    // Remove spaces
    const cleanIFSC = ifsc.replace(/\s/g, '').toUpperCase();
    
    // Check format: 4 letters + 7 alphanumeric
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIFSC)) {
      return { isValid: false, message: 'IFSC must be in format: ABCD0123456' };
    }
    
    return { isValid: true, message: 'Valid IFSC code' };
  };

  const validateBankAccount = (account) => {
    // Remove spaces and dashes
    const cleanAccount = account.replace(/[\s-]/g, '');
    
    // Check if it's 9-18 digits
    if (!/^\d{9,18}$/.test(cleanAccount)) {
      return { isValid: false, message: 'Bank account must be 9-18 digits' };
    }
    
    return { isValid: true, message: 'Valid bank account number' };
  };

  const validateContact = (contact) => {
    // Remove spaces, dashes, and plus
    const cleanContact = contact.replace(/[\s\-+]/g, '');
    
    // Check if it's 10 digits (Indian mobile)
    if (!/^\d{10}$/.test(cleanContact)) {
      return { isValid: false, message: 'Contact must be 10 digits' };
    }
    
    // Check if it starts with valid Indian mobile prefixes
    const validPrefixes = ['6', '7', '8', '9'];
    if (!validPrefixes.includes(cleanContact[0])) {
      return { isValid: false, message: 'Invalid mobile number prefix' };
    }
    
    return { isValid: true, message: 'Valid contact number' };
  };

  // --- Document upload handlers ---
  const handleDocumentUpload = (field, file) => {
    setEmployeeDocuments(prev => ({ ...prev, [field]: file }));
  };

  // --- Employee Selection Handlers (for Salary Tab) ---
  const handleEmployeeSelect = (employee) => {
    setSalaryEmployeeId(employee.value);
    setSelectedEmployeeDisplay(employee.label);
    setSalarySearch(''); // Clear search field
    setShowEmployeeDropdown(false);
    setSelectedEmployeeIndex(-1);
    
    // Find the selected employee and populate fixed salary rows
    const selectedEmp = employees.find(emp => emp.employeeId === employee.value);
    if (selectedEmp) {
      const monthlyRows = getMonthlySalaryRows(selectedEmp);
      setFixedSalaryRows(monthlyRows);
      // Only reset performance rows when NOT editing
      if (!isEditingSalary) {
        setPerformanceSalaryRows([]); // Reset performance rows when employee changes
      }
    }
  };

  // Click outside handler for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (showEmployeeDropdown && !event.target.closest('.employee-dropdown')) {
        setShowEmployeeDropdown(false);
        setSelectedEmployeeIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmployeeDropdown]);
  
  const handleDropdownToggle = () => {
    if (showEmployeeDropdown) {
      setShowEmployeeDropdown(false);
      setSelectedEmployeeIndex(-1);
    } else {
      setShowEmployeeDropdown(true);
      setSalarySearch(''); // Clear search when opening
    }
  };
  
  // Employee dropdown options (searchable) - computed at component level
  const validEmployees = employees.filter(emp => emp.employeeId);
  const employeeOptions = validEmployees.map(emp => ({
    value: emp.employeeId,
    label: `${emp.name} (${emp.employeeId})${emp.designation ? ' - ' + emp.designation : ''}`,
    post: emp.designation || ''
  }));
  const filteredEmployeeOptions = salarySearch
    ? employeeOptions.filter(opt => opt.label.toLowerCase().includes(salarySearch.toLowerCase()))
    : employeeOptions;
  
  // Get selected employee for salary form
  const selectedEmp = employees.find(emp => emp.employeeId === salaryEmployeeId);

  const handleEmployeeKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
    e.preventDefault();
      setSelectedEmployeeIndex(prev => 
        prev < filteredEmployeeOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedEmployeeIndex(prev => 
        prev > 0 ? prev - 1 : filteredEmployeeOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedEmployeeIndex >= 0 && filteredEmployeeOptions[selectedEmployeeIndex]) {
        handleEmployeeSelect(filteredEmployeeOptions[selectedEmployeeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowEmployeeDropdown(false);
      setSelectedEmployeeIndex(-1);
    }
  };

  const handleMultipleDocuments = (files) => {
    setEmployeeDocuments(prev => ({ 
      ...prev, 
      otherDocuments: [...prev.otherDocuments, ...Array.from(files)]
    }));
  };

  const removeDocument = (field, index = null) => {
    if (index !== null) {
      setEmployeeDocuments(prev => ({
        ...prev,
        otherDocuments: prev.otherDocuments.filter((_, i) => i !== index)
      }));
    } else {
      setEmployeeDocuments(prev => ({ ...prev, [field]: null }));
    }
  };

  // --- Employee Add Handler (with Employee ID) ---
  const handleAddEmployee = async e => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.basicSalary) return;
    
    const newId = generateEmployeeId(employees);
    const basic = Number(employeeForm.basicSalary || 0);
    
    // Calculate HRA based on type
    let hra = 0;
    if (employeeForm.hraType === 'percentage') {
      const hraPercentage = Number(employeeForm.hra) || 0;
      hra = basic * (hraPercentage / 100);
    } else {
      hra = Number(employeeForm.hra) || 0;
    }
    
    // Calculate Conveyance based on type
    let conveyance = 0;
    if (employeeForm.conveyanceAllowanceType === 'percentage') {
      const conveyancePercentage = Number(employeeForm.conveyanceAllowance) || 0;
      conveyance = basic * (conveyancePercentage / 100);
    } else {
      conveyance = Number(employeeForm.conveyanceAllowance) || 0;
    }
    
    // Calculate Employer PF based on type
    let pf = 0;
    if (employeeForm.employerPFType === 'percentage') {
      const pfPercentage = Number(employeeForm.employerPF) || 0;
      pf = basic * (pfPercentage / 100);
    } else {
      pf = Number(employeeForm.employerPF) || 0;
    }
    
    // Calculate Gratuity based on type
    let gratuity = 0;
    if (employeeForm.gratuityType === 'percentage') {
      const gratuityPercentage = Number(employeeForm.gratuity) || 0;
      gratuity = basic * (gratuityPercentage / 100);
    } else {
      gratuity = Number(employeeForm.gratuity) || 0;
    }
    
    // Calculate Special Allowance based on type
    let special = 0;
    if (employeeForm.specialAllowanceType === 'percentage') {
      const specialPercentage = Number(employeeForm.specialAllowance) || 0;
      special = basic * (specialPercentage / 100);
    } else {
      special = Number(employeeForm.specialAllowance) || 0;
    }
    
    const totalSalary = basic + hra + conveyance + pf + gratuity + special;
    
    // Upload documents to Firebase Storage
    const documentUrls = {};
    
    try {
      // Upload individual documents
      const uploadPromises = [];
      
      if (employeeDocuments.aadhaarCard) {
        const aadhaarRef = ref(storage, `employees/${newId}/aadhaar_${Date.now()}.pdf`);
        uploadPromises.push(uploadBytes(aadhaarRef, employeeDocuments.aadhaarCard).then(() => getDownloadURL(aadhaarRef)));
      }
      
      if (employeeDocuments.panCard) {
        const panRef = ref(storage, `employees/${newId}/pan_${Date.now()}.pdf`);
        uploadPromises.push(uploadBytes(panRef, employeeDocuments.panCard).then(() => getDownloadURL(panRef)));
      }
      
      if (employeeDocuments.bankPassbook) {
        const bankRef = ref(storage, `employees/${newId}/bank_${Date.now()}.pdf`);
        uploadPromises.push(uploadBytes(bankRef, employeeDocuments.bankPassbook).then(() => getDownloadURL(bankRef)));
      }
      
      if (employeeDocuments.photo) {
        const photoRef = ref(storage, `employees/${newId}/photo_${Date.now()}.jpg`);
        uploadPromises.push(uploadBytes(photoRef, employeeDocuments.photo).then(() => getDownloadURL(photoRef)));
      }
      
      if (employeeDocuments.resume) {
        const resumeRef = ref(storage, `employees/${newId}/resume_${Date.now()}.pdf`);
        uploadPromises.push(uploadBytes(resumeRef, employeeDocuments.resume).then(() => getDownloadURL(resumeRef)));
      }
      
      // Upload multiple other documents
      employeeDocuments.otherDocuments.forEach((doc, index) => {
        const otherRef = ref(storage, `employees/${newId}/other_${index}_${Date.now()}.pdf`);
        uploadPromises.push(uploadBytes(otherRef, doc).then(() => getDownloadURL(otherRef)));
      });
      
      const urls = await Promise.all(uploadPromises);
      
      // Map URLs to document fields
      let urlIndex = 0;
      if (employeeDocuments.aadhaarCard) documentUrls.aadhaarUrl = urls[urlIndex++];
      if (employeeDocuments.panCard) documentUrls.panUrl = urls[urlIndex++];
      if (employeeDocuments.bankPassbook) documentUrls.bankUrl = urls[urlIndex++];
      if (employeeDocuments.photo) documentUrls.photoUrl = urls[urlIndex++];
      if (employeeDocuments.resume) documentUrls.resumeUrl = urls[urlIndex++];
      documentUrls.otherUrls = urls.slice(urlIndex);
      
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Error uploading documents. Please try again.');
      return;
    }
    
    // Save employee data with document URLs and calculated amounts
    const totalCTC = calculateTotalCTC();
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/employees`), { 
      ...employeeForm, 
      salary: totalCTC,
      employeeId: newId, 
      documents: documentUrls,
      createdAt: serverTimestamp(),
      // Save calculated actual amounts for salary page usage
      basicSalaryAmount: basic,
      hraAmount: hra,
      conveyanceAmount: conveyance,
      employerPFAmount: pf,
      gratuityAmount: gratuity,
      specialAllowanceAmount: special,
      totalCTC: totalCTC
    });
    
            // Reset form
        setEmployeeForm({
          name: '',
          personType: 'Employee',
          designation: '',
          basicSalary: '',
          hra: '',
          hraType: 'amount',
          conveyanceAllowance: '',
          conveyanceAllowanceType: 'amount',
          employerPF: '',
          employerPFType: 'amount',
          gratuity: '',
          gratuityType: 'amount',
          specialAllowance: '',
          specialAllowanceType: 'amount',
          contact: '',
          aadhaar: '',
          pan: '',
          bankName: '',
          bankAccount: '',
          ifsc: '',
          address: ''
        });
    setEmployeeDocuments({
      aadhaarCard: null,
      panCard: null,
      bankPassbook: null,
      photo: null,
      resume: null,
      otherDocuments: []
    });
  };
  
  // --- Fix existing employees without employeeId ---
  const fixExistingEmployees = async () => {
    console.log('Total employees:', employees.length);
    console.log('All employees data:', JSON.stringify(employees, null, 2));
    
    const employeesWithoutId = employees.filter(emp => !emp.employeeId);
    console.log('Employees without ID:', employeesWithoutId);
    
    for (const emp of employeesWithoutId) {
      const newId = generateEmployeeId(employees);
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/employees`, emp.id), { employeeId: newId });
      console.log(`Fixed employee ${emp.name} with ID: ${newId}`);
    }
  };
  
  // --- Employee table sorting and pagination logic ---
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = !employeeFilters.search || 
        emp.name?.toLowerCase().includes(employeeFilters.search.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(employeeFilters.search.toLowerCase());
      const matchesDesignation = !employeeFilters.designation || emp.designation === employeeFilters.designation;
      return matchesSearch && matchesDesignation;
    });
  }, [employees, employeeFilters]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      let aVal = a[employeeSortKey] || '';
      let bVal = b[employeeSortKey] || '';
      
      if (employeeSortKey === 'salary') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      
      if (aVal < bVal) return employeeSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return employeeSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEmployees, employeeSortKey, employeeSortDir]);

  const employeeTotalPages = Math.ceil(sortedEmployees.length / employeePageSize);
  const paginatedEmployees = useMemo(() => {
    const start = (employeeCurrentPage - 1) * employeePageSize;
    return sortedEmployees.slice(start, start + employeePageSize);
  }, [sortedEmployees, employeeCurrentPage, employeePageSize]);

  const handleEmployeeSort = (key) => {
    if (employeeSortKey === key) {
      setEmployeeSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setEmployeeSortKey(key);
      setEmployeeSortDir('asc');
    }
    setEmployeeCurrentPage(1);
  };

  const renderSortIcon = (key) => {
    if (employeeSortKey !== key) return '⇅';
    return employeeSortDir === 'asc' ? '↑' : '↓';
  };

  // Reset pagination when filters change
  useEffect(() => {
    setEmployeeCurrentPage(1);
  }, [employeeFilters, employeePageSize]);

  // --- Employee action handlers ---
  const handleViewEmployee = (emp) => {
    const documents = emp.documents || {};
    const documentLinks = [];
    
    if (documents.aadhaarUrl) documentLinks.push(`Aadhaar: ${documents.aadhaarUrl}`);
    if (documents.panUrl) documentLinks.push(`PAN: ${documents.panUrl}`);
    if (documents.bankUrl) documentLinks.push(`Bank Passbook: ${documents.bankUrl}`);
    if (documents.photoUrl) documentLinks.push(`Photo: ${documents.photoUrl}`);
    if (documents.resumeUrl) documentLinks.push(`Resume: ${documents.resumeUrl}`);
    if (documents.otherUrls) {
      documents.otherUrls.forEach((url, index) => {
        documentLinks.push(`Other Doc ${index + 1}: ${url}`);
      });
    }
    
    const documentText = documentLinks.length > 0 ? '\n\nDocuments:\n' + documentLinks.join('\n') : '\n\nNo documents uploaded';
    
    alert(`Employee Details:\n\nID: ${emp.employeeId}\nName: ${emp.name}\nPost: ${emp.designation}\nBasic Salary: ₹${emp.basicSalary || emp.salary}\nHRA: ₹${emp.hra || 0}\nConveyance: ₹${emp.conveyanceAllowance || 0}\nEmployer PF: ₹${emp.employerPF || 0}\nGratuity: ₹${emp.gratuity || 0}\nSpecial Allowance: ₹${emp.specialAllowance || 0}\nTotal CTC: ₹${emp.salary}\nContact: ${emp.contact}\nAadhaar: ${emp.aadhaar}\nPAN: ${emp.pan}\nBank: ${emp.bankAccount}\nIFSC: ${emp.ifsc}\nAddress: ${emp.address}${documentText}`);
  };
  
  const handleExportEmployee = (emp) => {
    const basicSalary = Number(emp.basicSalary || emp.salary || 0);
    const hra = Number(emp.hra || 0);
    const conveyance = Number(emp.conveyanceAllowance || 0);
    const employerPF = Number(emp.employerPF || 0);
    const gratuity = Number(emp.gratuity || 0);
    const specialAllowance = Number(emp.specialAllowance || 0);
    const total = Number(emp.salary || 0);
    
    const monthlySalary = Math.round(total / 12);
    const csvContent = [
      ['Employee ID', 'Name', 'Post', 'Basic Salary', 'HRA', 'Conveyance', 'Employer PF', 'Gratuity', 'Special Allowance', 'Total CTC', 'Monthly Salary'],
      [emp.employeeId, emp.name, emp.designation, basicSalary, hra, conveyance, employerPF, gratuity, specialAllowance, total, monthlySalary]
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee_${emp.employeeId}_salary_breakdown.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const handleDeleteEmployee = async id => {
    const emp = employees.find(e => e.id === id);
    if (emp && window.confirm(`Are you sure you want to delete employee ${emp.name}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/employees`, id));
        alert('Employee deleted successfully!');
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Error deleting employee. Please try again.');
      }
    }
  };


  const handleEditEmployee = emp => {
    setEditingEmployeeId(emp.id);
    setEditingEmployee({ 
      ...emp,
      basicSalary: emp.basicSalary || emp.salary || '',
      hra: emp.hra || '',
      hraType: emp.hraType || 'amount',
      conveyanceAllowance: emp.conveyanceAllowance || '',
      conveyanceAllowanceType: emp.conveyanceAllowanceType || 'amount',
      employerPF: emp.employerPF || '',
      employerPFType: emp.employerPFType || 'amount',
      gratuity: emp.gratuity || '',
      gratuityType: emp.gratuityType || 'amount',
      specialAllowance: emp.specialAllowance || '',
      specialAllowanceType: emp.specialAllowanceType || 'amount',
      bankName: emp.bankName || ''
    });
    setShowEditForm(true);
  };
  const handleEditingEmployeeChange = e => {
    const { name, value } = e.target;
    setEditingEmployee(f => ({ ...f, [name]: value }));
    
    // KYC validation for edit form
    if (name === 'contact' && value) {
      const validation = validateContact(value);
      setKycErrors(prev => ({ ...prev, contact: validation.isValid ? '' : validation.message }));
    } else if (name === 'aadhaar' && value) {
      const validation = validateAadhaar(value);
      setKycErrors(prev => ({ ...prev, aadhaar: validation.isValid ? '' : validation.message }));
    } else if (name === 'pan' && value) {
      const validation = validatePAN(value);
      setKycErrors(prev => ({ ...prev, pan: validation.isValid ? '' : validation.message }));
    } else if (name === 'bankAccount' && value) {
      const validation = validateBankAccount(value);
      setKycErrors(prev => ({ ...prev, bankAccount: validation.isValid ? '' : validation.message }));
    } else if (name === 'ifsc' && value) {
      const validation = validateIFSC(value);
      setKycErrors(prev => ({ ...prev, ifsc: validation.isValid ? '' : validation.message }));
    } else if (name === 'bankName' && value) {
      setKycErrors(prev => ({ ...prev, bankName: value.trim() ? '' : 'Bank name is required' }));
    }
  };
  const handleSaveEmployee = async id => {
    const basic = Number(editingEmployee.basicSalary || 0);
    
    // Calculate HRA based on type
    let hra = 0;
    if (editingEmployee.hraType === 'percentage') {
      const hraPercentage = Number(editingEmployee.hra) || 0;
      hra = basic * (hraPercentage / 100);
    } else {
      hra = Number(editingEmployee.hra) || 0;
    }
    
    // Calculate Conveyance based on type
    let conveyance = 0;
    if (editingEmployee.conveyanceAllowanceType === 'percentage') {
      const conveyancePercentage = Number(editingEmployee.conveyanceAllowance) || 0;
      conveyance = basic * (conveyancePercentage / 100);
    } else {
      conveyance = Number(editingEmployee.conveyanceAllowance) || 0;
    }
    
    // Calculate Employer PF based on type
    let pf = 0;
    if (editingEmployee.employerPFType === 'percentage') {
      const pfPercentage = Number(editingEmployee.employerPF) || 0;
      pf = basic * (pfPercentage / 100);
    } else {
      pf = Number(editingEmployee.employerPF) || 0;
    }
    
    // Calculate Gratuity based on type
    let gratuity = 0;
    if (editingEmployee.gratuityType === 'percentage') {
      const gratuityPercentage = Number(editingEmployee.gratuity) || 0;
      gratuity = basic * (gratuityPercentage / 100);
    } else {
      gratuity = Number(editingEmployee.gratuity) || 0;
    }
    
    // Calculate Special Allowance based on type
    let special = 0;
    if (editingEmployee.specialAllowanceType === 'percentage') {
      const specialPercentage = Number(editingEmployee.specialAllowance) || 0;
      special = basic * (specialPercentage / 100);
    } else {
      special = Number(editingEmployee.specialAllowance) || 0;
    }
    
    const totalSalary = basic + hra + conveyance + pf + gratuity + special;
    
    // Upload new documents if any
    const documentUrls = { ...editingEmployee.documents };
    
    try {
      const uploadPromises = [];
      
      if (editingEmployeeDocuments.aadhaarCard) {
        const aadhaarRef = ref(storage, `employees/${editingEmployee.employeeId}/aadhaar_${Date.now()}.pdf`);
        const url = await uploadBytes(aadhaarRef, editingEmployeeDocuments.aadhaarCard).then(() => getDownloadURL(aadhaarRef));
        documentUrls.aadhaarUrl = url;
      }
      
      if (editingEmployeeDocuments.panCard) {
        const panRef = ref(storage, `employees/${editingEmployee.employeeId}/pan_${Date.now()}.pdf`);
        const url = await uploadBytes(panRef, editingEmployeeDocuments.panCard).then(() => getDownloadURL(panRef));
        documentUrls.panUrl = url;
      }
      
      if (editingEmployeeDocuments.bankPassbook) {
        const bankRef = ref(storage, `employees/${editingEmployee.employeeId}/bank_${Date.now()}.pdf`);
        const url = await uploadBytes(bankRef, editingEmployeeDocuments.bankPassbook).then(() => getDownloadURL(bankRef));
        documentUrls.bankUrl = url;
      }
      
      if (editingEmployeeDocuments.photo) {
        const photoRef = ref(storage, `employees/${editingEmployee.employeeId}/photo_${Date.now()}.jpg`);
        const url = await uploadBytes(photoRef, editingEmployeeDocuments.photo).then(() => getDownloadURL(photoRef));
        documentUrls.photoUrl = url;
      }
      
      if (editingEmployeeDocuments.resume) {
        const resumeRef = ref(storage, `employees/${editingEmployee.employeeId}/resume_${Date.now()}.pdf`);
        const url = await uploadBytes(resumeRef, editingEmployeeDocuments.resume).then(() => getDownloadURL(resumeRef));
        documentUrls.resumeUrl = url;
      }
      
      // Upload multiple other documents
      for (let i = 0; i < editingEmployeeDocuments.otherDocuments.length; i++) {
        const doc = editingEmployeeDocuments.otherDocuments[i];
        const otherRef = ref(storage, `employees/${editingEmployee.employeeId}/other_${i}_${Date.now()}.pdf`);
        const url = await uploadBytes(otherRef, doc).then(() => getDownloadURL(otherRef));
        if (!documentUrls.otherUrls) documentUrls.otherUrls = [];
        documentUrls.otherUrls.push(url);
      }
      
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Error uploading documents. Please try again.');
      return;
    }
    
    // Filter out undefined values to prevent Firebase errors
    // Filter out undefined values to prevent Firebase errors
    const updateData = {
      name: editingEmployee.name,
      personType: editingEmployee.personType || 'Employee',
      designation: editingEmployee.designation,
      basicSalary: editingEmployee.basicSalary,
      hra: editingEmployee.hra,
      hraType: editingEmployee.hraType,
      conveyanceAllowance: editingEmployee.conveyanceAllowance,
      conveyanceAllowanceType: editingEmployee.conveyanceAllowanceType,
      employerPF: editingEmployee.employerPF,
      employerPFType: editingEmployee.employerPFType,
      gratuity: editingEmployee.gratuity,
      gratuityType: editingEmployee.gratuityType,
      specialAllowance: editingEmployee.specialAllowance,
      specialAllowanceType: editingEmployee.specialAllowanceType,
      salary: totalSalary,
      contact: editingEmployee.contact,
      aadhaar: editingEmployee.aadhaar,
      pan: editingEmployee.pan,
      bankName: editingEmployee.bankName,
      bankAccount: editingEmployee.bankAccount,
      ifsc: editingEmployee.ifsc,
      address: editingEmployee.address,
      documents: documentUrls,
      // Save calculated actual amounts for salary page usage
      basicSalaryAmount: basic,
      hraAmount: hra,
      conveyanceAmount: conveyance,
      employerPFAmount: pf,
      gratuityAmount: gratuity,
      specialAllowanceAmount: special,
      totalCTC: totalSalary,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

          await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/employees`, id), updateData);
    
    setEditingEmployeeId(null);
    setEditingEmployee({});
    setEditingEmployeeDocuments({
      aadhaarCard: null,
      panCard: null,
      bankPassbook: null,
      photo: null,
      resume: null,
      otherDocuments: []
    });
    setShowEditForm(false);
    alert('Employee updated successfully!');
  };
  const handleCancelEditEmployee = () => {
    setEditingEmployeeId(null);
    setEditingEmployee({});
    setEditingEmployeeDocuments({
      aadhaarCard: null,
      panCard: null,
      bankPassbook: null,
      photo: null,
      resume: null,
      otherDocuments: []
    });
    setShowEditForm(false);
  };

  // --- Salary payment handlers ---
  const handleSalaryFormChange = e => {
    const { name, value } = e.target;
    setSalaryForm(f => ({ ...f, [name]: value }));
  };
  const handleAddSalaryPayment = async e => {
    e.preventDefault();
    if (!salaryForm.employeeId || !salaryForm.month || !salaryForm.amount) return;
    const emp = employees.find(e => e.id === salaryForm.employeeId);
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), {
      group: 'salaries',
      employeeId: salaryForm.employeeId,
      employeeName: emp?.name || '',
      month: salaryForm.month,
      amount: Number(salaryForm.amount),
      remarks: salaryForm.remarks,
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
    });
    setSalaryForm({ employeeId: '', month: '', amount: '', remarks: '' });
  };

  // --- Expense form handlers (fixed/variable) ---
  const handleExpenseFormChange = e => {
    const { name, value, files } = e.target;
    setExpenseForm(f => ({ ...f, [name]: files ? files[0] : value }));
  };
  const handleAddExpense = async e => {
    e.preventDefault();
    if (!expenseForm.date || !expenseForm.head || !expenseForm.amount) return;
    let receiptUrl = '';
    if (expenseForm.receipt) {
      const file = expenseForm.receipt;
      const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      receiptUrl = await getDownloadURL(storageRef);
    }
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), {
      group: selectedGroup,
      date: expenseForm.date,
      head: expenseForm.head,
      amount: Number(expenseForm.amount),
      description: expenseForm.description,
      paymentMode: expenseForm.paymentMode,
      receiptUrl,
      createdAt: serverTimestamp(),
    });
    // force refresh in case onSnapshot lags
    await reloadExpenses();
    setExpenseForm({ 
      date: new Date().toISOString().split('T')[0], 
      head: '', 
      amount: '', 
      description: '', 
      receipt: null,
      paymentMode: 'Cash' 
    });
  };
  const handleEditExpense = exp => {
    setEditingExpenseId(exp.id);
    setEditingExpense({ ...exp });
    // Also update the expense form for the table edit functionality
    setExpenseForm({
      date: exp.date || '',
      head: exp.head || '',
      amount: exp.amount || '',
      description: exp.description || '',
      receipt: exp.receipt || null,
      paymentMode: exp.paymentMode || 'Cash'
    });
  };
  const handleEditingExpenseChange = e => {
    const { name, value } = e.target;
    setEditingExpense(f => ({ ...f, [name]: value }));
  };
  const handleSaveExpense = async id => {
    await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/expenses`, id), {
      date: editingExpense.date || '',
      head: editingExpense.head || '',
      amount: Number(editingExpense.amount) || 0,
      description: editingExpense.description || '',
      remarks: editingExpense.remarks || '',
      month: editingExpense.month || '',
      paymentMode: editingExpense.paymentMode || 'Cash',
    });
    await reloadExpenses();
    setEditingExpenseId(null);
    setEditingExpense({});
    setExpenseForm({ 
      date: new Date().toISOString().split('T')[0], 
      head: '', 
      amount: '', 
      description: '', 
      receipt: null,
      paymentMode: 'Cash' 
    });
  };
  const handleCancelEditExpense = () => {
    setEditingExpenseId(null);
    setEditingExpense({});
    setExpenseForm({ 
      date: new Date().toISOString().split('T')[0], 
      head: '', 
      amount: '', 
      description: '', 
      receipt: null,
      paymentMode: 'Cash'
    });
    // Focus first input to make it clear we are back in add mode
    try { document.querySelector('input[name="date"]').focus(); } catch {}
  };

  // Expense handlers
  const handleViewExpense = (expense) => {
    alert(`Expense Details:\nDate: ${expense.date}\nHead: ${expense.head}\nAmount: ₹${Number(expense.amount).toLocaleString('en-IN')}\nPayment Mode: ${expense.paymentMode || 'N/A'}\nDescription: ${expense.description || 'N/A'}`);
  };



  const handleDeleteExpense = async id => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/expenses`, id));
        alert('Expense deleted successfully!');
        await reloadExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense. Please try again.');
      }
    }
  };

  // --- Summary/Analytics ---
  const totalAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const totalCount = expenses.length;

  // Category-wise analytics (by head/employeeName)
  const categorySummary = useMemo(() => {
    const map = {};
    for (const exp of expenses) {
      const key = exp.head || exp.employeeName || 'Other';
      if (!map[key]) map[key] = 0;
      map[key] += Number(exp.amount) || 0;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Date-wise analytics (by date/month)
  const dateSummary = useMemo(() => {
    const map = {};
    for (const exp of expenses) {
      const key = exp.date || exp.month || 'Other';
      if (!map[key]) map[key] = 0;
      map[key] += Number(exp.amount) || 0;
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  // --- Filtered, sorted, paginated expenses for table ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (filters.date && exp.date !== filters.date) return false;
      if (filters.head && exp.head !== filters.head) return false;
      if (filters.amount && String(exp.amount) !== String(filters.amount)) return false;
      return true;
    });
  }, [expenses, filters]);

  const sortedExpenses = useMemo(() => {
    const arr = [...filteredExpenses];
    arr.sort((a, b) => {
      let aValue = a[sortKey] || '';
      let bValue = b[sortKey] || '';
      if (sortKey === 'amount') {
        aValue = Number(aValue);
        bValue = Number(bValue);
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (sortKey === 'date' || sortKey === 'month') {
        return sortDir === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
      }
      return sortDir === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
    });
    return arr;
  }, [filteredExpenses, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedExpenses.length / pageSize);
  const paginatedExpenses = sortedExpenses.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // --- Export to CSV ---
  const handleExportCSV = () => {
    const headers = ['Date/Month', 'Head/Employee', 'Amount', 'Description/Remarks', 'Receipt URL'];
    const rows = sortedExpenses.map(exp => [
      exp.date || exp.month || '',
      exp.head || exp.employeeName || '',
      exp.amount || '',
      exp.description || exp.remarks || '',
      exp.receiptUrl || ''
    ]);
    let csvContent = '';
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_export_${selectedGroup}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDropdownOpen(false);
  };

  // --- Export to Excel (XLSX) ---
  const handleExportExcel = () => {
    const headers = ['Date/Month', 'Head/Employee', 'Amount', 'Description/Remarks', 'Receipt URL'];
    const rows = sortedExpenses.map(exp => [
      exp.date || exp.month || '',
      exp.head || exp.employeeName || '',
      exp.amount || '',
      exp.description || exp.remarks || '',
      exp.receiptUrl || ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `expenses_export_${selectedGroup}_${new Date().toISOString().slice(0,10)}.xlsx`);
    setExportDropdownOpen(false);
  };

  // --- Export to PDF (table only) ---
  const handleExportPDF = () => {
    const docPDF = new jsPDF();
    const headers = [['Date/Month', 'Head/Employee', 'Amount', 'Description/Remarks', 'Receipt URL']];
    const rows = sortedExpenses.map(exp => [
      exp.date || exp.month || '',
      exp.head || exp.employeeName || '',
      exp.amount || '',
      exp.description || exp.remarks || '',
      exp.receiptUrl || ''
    ]);
    import('jspdf-autotable')
      .then(({ default: autoTable }) => {
        autoTable(docPDF, { head: headers, body: rows });
      })
      .catch((e) => {
        console.warn('jspdf-autotable not available in Expenses export:', e);
      });
    docPDF.save(`expenses_export_${selectedGroup}_${new Date().toISOString().slice(0,10)}.pdf`);
    setExportDropdownOpen(false);
  };

  // --- Close dropdown on outside click ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportDropdownOpen(false);
      }
      // Close employee dropdown when clicking outside
      if (showEmployeeDropdown) {
        setShowEmployeeDropdown(false);
        setSelectedEmployeeIndex(-1);
      }
    }
    if (exportDropdownOpen || showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportDropdownOpen, showEmployeeDropdown]);



  // --- Render group-specific form ---
  const renderGroupForm = () => {
    if (selectedGroup === 'employee') {
      // Employee/KYC UI (no salary form)
  return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Employee Database & KYC</h3>
          <form className="flex flex-col gap-3 mb-4" onSubmit={handleAddEmployee}>
            {/* Basic Information */}
            <div className="flex flex-wrap gap-2">
              <input name="name" value={employeeForm.name} onChange={handleEmployeeFormChange} placeholder="Name" className="border rounded p-1 text-sm" required />
              <select name="personType" value={employeeForm.personType || 'Employee'} onChange={handleEmployeeFormChange} className="border rounded p-1 text-sm">
                <option value="Employee">Employee</option>
                <option value="Labour">Labour</option>
                <option value="Freelancer">Freelancer</option>
              </select>
              <input name="designation" value={employeeForm.designation} onChange={handleEmployeeFormChange} placeholder="Designation" className="border rounded p-1 text-sm" />
              <input name="contact" value={employeeForm.contact} onChange={handleEmployeeFormChange} placeholder="Contact" className="border rounded p-1 text-sm" />
            </div>
            
            {/* Salary Structure */}
            <div className="bg-gray-50 p-3 rounded">
              <h5 className="text-sm font-semibold mb-2">Salary Structure</h5>
              
              {/* Salary Components */}
              <div className="space-y-3">
                {/* Basic Salary Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-24">Basic Salary</span>
                  <input
                    name="basicSalary"
                    value={employeeForm.basicSalary}
                    onChange={handleEmployeeFormChange}
                    placeholder="0"
                    type="number"
                    className="border rounded p-1 text-sm flex-1"
                    required
                  />
                  <span className="text-xs text-gray-500 w-20">Annual</span>
                  <input
                    value={employeeForm.basicSalary || "0.00"}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                  <span className="text-xs text-gray-500 w-20">Monthly</span>
                  <input
                    value={((Number(employeeForm.basicSalary) || 0) / 12).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                </div>
                
                {/* HRA Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-24">HRA</span>
                  <input
                    name="hra"
                    value={employeeForm.hra}
                    onChange={handleEmployeeFormChange}
                    placeholder="0"
                    type="number"
                    className="border rounded p-1 text-sm flex-1"
                  />
                  <select
                    name="hraType"
                    value={employeeForm.hraType || 'amount'}
                    onChange={handleEmployeeFormChange}
                    className="border rounded p-1 text-xs w-16"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                  <span className="text-xs text-gray-500 w-20">Annual</span>
                  <input
                    value={calculateComponentAmount('hra', employeeForm.hra, employeeForm.hraType || 'amount', employeeForm.basicSalary).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                  <span className="text-xs text-gray-500 w-20">Monthly</span>
                  <input
                    value={(calculateComponentAmount('hra', employeeForm.hra, employeeForm.hraType || 'amount', employeeForm.basicSalary) / 12).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                </div>
                
                {/* Conveyance Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-24">Conveyance</span>
                  <input
                    name="conveyanceAllowance"
                    value={employeeForm.conveyanceAllowance}
                    onChange={handleEmployeeFormChange}
                    placeholder="0"
                    type="number"
                    className="border rounded p-1 text-sm flex-1"
                  />
                  <select
                    name="conveyanceAllowanceType"
                    value={employeeForm.conveyanceAllowanceType || 'amount'}
                    onChange={handleEmployeeFormChange}
                    className="border rounded p-1 text-xs w-16"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                  <span className="text-xs text-gray-500 w-20">Annual</span>
                  <input
                    value={calculateComponentAmount('conveyanceAllowance', employeeForm.conveyanceAllowance, employeeForm.conveyanceAllowanceType || 'amount', employeeForm.basicSalary).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                  <span className="text-xs text-gray-500 w-20">Monthly</span>
                  <input
                    value={(calculateComponentAmount('conveyanceAllowance', employeeForm.conveyanceAllowance, employeeForm.conveyanceAllowanceType || 'amount', employeeForm.basicSalary) / 12).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                </div>
                
                {/* Employer PF Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-24">Employer PF</span>
                  <input
                    name="employerPF"
                    value={employeeForm.employerPF}
                    onChange={handleEmployeeFormChange}
                    placeholder="0"
                    type="number"
                    className="border rounded p-1 text-sm flex-1"
                  />
                  <select
                    name="employerPFType"
                    value={employeeForm.employerPFType || 'amount'}
                    onChange={handleEmployeeFormChange}
                    className="border rounded p-1 text-xs w-16"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                  <span className="text-xs text-gray-500 w-20">Annual</span>
                  <input
                    value={calculateComponentAmount('employerPF', employeeForm.employerPF, employeeForm.employerPFType || 'amount', employeeForm.basicSalary).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                  <span className="text-xs text-gray-500 w-20">Monthly</span>
                  <input
                    value={(calculateComponentAmount('employerPF', employeeForm.employerPF, employeeForm.employerPFType || 'amount', employeeForm.basicSalary) / 12).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                </div>
                
                {/* Gratuity Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-24">Gratuity</span>
                  <input
                    name="gratuity"
                    value={employeeForm.gratuity}
                    onChange={handleEmployeeFormChange}
                    placeholder="0"
                    type="number"
                    className="border rounded p-1 text-sm flex-1"
                  />
                  <select
                    name="gratuityType"
                    value={employeeForm.gratuityType || 'amount'}
                    onChange={handleEmployeeFormChange}
                    className="border rounded p-1 text-xs w-16"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                  <span className="text-xs text-gray-500 w-20">Annual</span>
                  <input
                    value={calculateComponentAmount('gratuity', employeeForm.gratuity, employeeForm.gratuityType || 'amount', employeeForm.basicSalary).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                  <span className="text-xs text-gray-500 w-20">Monthly</span>
                  <input
                    value={(calculateComponentAmount('gratuity', employeeForm.gratuity, employeeForm.gratuityType || 'amount', employeeForm.basicSalary) / 12).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                </div>
                
                {/* Special Allowance Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-24">Special Allowance</span>
                  <input
                    name="specialAllowance"
                    value={employeeForm.specialAllowance}
                    onChange={handleEmployeeFormChange}
                    placeholder="0"
                    type="number"
                    className="border rounded p-1 text-sm flex-1"
                  />
                  <select
                    name="specialAllowanceType"
                    value={employeeForm.specialAllowanceType || 'amount'}
                    onChange={handleEmployeeFormChange}
                    className="border rounded p-1 text-xs w-16"
                  >
                    <option value="amount">₹</option>
                    <option value="percentage">%</option>
                  </select>
                  <span className="text-xs text-gray-500 w-20">Annual</span>
                  <input
                    value={calculateComponentAmount('specialAllowance', employeeForm.specialAllowance, employeeForm.specialAllowanceType || 'amount', employeeForm.basicSalary).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                  <span className="text-xs text-gray-500 w-20">Monthly</span>
                  <input
                    value={(calculateComponentAmount('specialAllowance', employeeForm.specialAllowance, employeeForm.specialAllowanceType || 'amount', employeeForm.basicSalary) / 12).toFixed(2)}
                    readOnly
                    className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                    tabIndex={-1}
                  />
                </div>
                
                {/* Total CTC Display */}
                <div className="bg-blue-50 p-2 rounded text-center mt-3">
                  <div className="font-semibold text-blue-800">
                    Total CTC: ₹{calculateTotalCTC().toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-blue-600">
                    Monthly Salary: ₹{(calculateTotalCTC() / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}
                  </div>
                </div>
              </div>
            </div>
            
            {/* KYC Information */}
            <div className="bg-gray-50 p-3 rounded">
              <h5 className="text-sm font-semibold mb-2">KYC Details</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
                  <input 
                    name="contact" 
                    value={employeeForm.contact} 
                    onChange={handleEmployeeFormChange} 
                    placeholder="Contact Number (10 digits)" 
                    className={`border rounded p-2 text-sm w-full ${kycErrors.contact ? 'border-red-500' : ''}`} 
                  />
                  {kycErrors.contact && <div className="text-red-500 text-xs mt-1">{kycErrors.contact}</div>}
        </div>
                
        <div>
                  <input 
                    name="aadhaar" 
                    value={employeeForm.aadhaar} 
                    onChange={handleEmployeeFormChange} 
                    placeholder="Aadhaar (12 digits)" 
                    className={`border rounded p-2 text-sm w-full ${kycErrors.aadhaar ? 'border-red-500' : ''}`} 
                  />
                  {kycErrors.aadhaar && <div className="text-red-500 text-xs mt-1">{kycErrors.aadhaar}</div>}
                </div>
                
                <div>
                  <input 
                    name="pan" 
                    value={employeeForm.pan} 
                    onChange={handleEmployeeFormChange} 
                    placeholder="PAN (ABCDE1234F)" 
                    className={`border rounded p-2 text-sm w-full ${kycErrors.pan ? 'border-red-500' : ''}`} 
                  />
                  {kycErrors.pan && <div className="text-red-500 text-xs mt-1">{kycErrors.pan}</div>}
                </div>
                
                <div>
                  <input 
                    name="bankName" 
                    value={employeeForm.bankName} 
                    onChange={handleEmployeeFormChange} 
                    placeholder="Bank Name" 
                    className={`border rounded p-2 text-sm w-full ${kycErrors.bankName ? 'border-red-500' : ''}`} 
                  />
                  {kycErrors.bankName && <div className="text-red-500 text-xs mt-1">{kycErrors.bankName}</div>}
                </div>
                
                <div>
                  <input 
                    name="bankAccount" 
                    value={employeeForm.bankAccount} 
                    onChange={handleEmployeeFormChange} 
                    placeholder="Bank Account Number" 
                    className={`border rounded p-2 text-sm w-full ${kycErrors.bankAccount ? 'border-red-500' : ''}`} 
                  />
                  {kycErrors.bankAccount && <div className="text-red-500 text-xs mt-1">{kycErrors.bankAccount}</div>}
                </div>
                
                <div>
                  <input 
                    name="ifsc" 
                    value={employeeForm.ifsc} 
                    onChange={handleEmployeeFormChange} 
                    placeholder="IFSC Code (ABCD0123456)" 
                    className={`border rounded p-2 text-sm w-full ${kycErrors.ifsc ? 'border-red-500' : ''}`} 
                  />
                  {kycErrors.ifsc && <div className="text-red-500 text-xs mt-1">{kycErrors.ifsc}</div>}
                </div>
                
                                  <div className="md:col-span-2">
                    <textarea 
                      name="address" 
                      value={employeeForm.address} 
                      onChange={handleEmployeeFormChange} 
                      placeholder="Address" 
                      className="border rounded p-2 text-sm w-full h-20 resize-none" 
                    />
                  </div>
              </div>
            </div>
            
            {/* Document Upload */}
            <div className="bg-gray-50 p-3 rounded">
              <h5 className="text-sm font-semibold mb-2">Document Upload</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Aadhaar Card */}
                <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentUpload('aadhaarCard', e.target.files[0])}
                      className="hidden"
                    />
                    <div className="text-gray-600">
                      {employeeDocuments.aadhaarCard ? (
        <div>
                          <span className="text-green-600">✓ {employeeDocuments.aadhaarCard.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument('aadhaarCard')}
                            className="ml-2 text-red-600 text-xs"
                          >
                            ✕
                          </button>
        </div>
                      ) : (
        <div>
                          <div className="text-2xl mb-1">📄</div>
                          <div className="text-sm">Aadhaar Card</div>
                          <div className="text-xs text-gray-500">PDF, JPG, PNG</div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* PAN Card */}
                <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentUpload('panCard', e.target.files[0])}
                      className="hidden"
                    />
                    <div className="text-gray-600">
                      {employeeDocuments.panCard ? (
                        <div>
                          <span className="text-green-600">✓ {employeeDocuments.panCard.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument('panCard')}
                            className="ml-2 text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl mb-1">🆔</div>
                          <div className="text-sm">PAN Card</div>
                          <div className="text-xs text-gray-500">PDF, JPG, PNG</div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* Bank Passbook */}
                <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentUpload('bankPassbook', e.target.files[0])}
                      className="hidden"
                    />
                    <div className="text-gray-600">
                      {employeeDocuments.bankPassbook ? (
                        <div>
                          <span className="text-green-600">✓ {employeeDocuments.bankPassbook.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument('bankPassbook')}
                            className="ml-2 text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl mb-1">🏦</div>
                          <div className="text-sm">Bank Passbook</div>
                          <div className="text-xs text-gray-500">PDF, JPG, PNG</div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* Photo */}
                <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={(e) => handleDocumentUpload('photo', e.target.files[0])}
                      className="hidden"
                    />
                    <div className="text-gray-600">
                      {employeeDocuments.photo ? (
                        <div>
                          <span className="text-green-600">✓ {employeeDocuments.photo.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument('photo')}
                            className="ml-2 text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl mb-1">📷</div>
                          <div className="text-sm">Photo</div>
                          <div className="text-xs text-gray-500">JPG, PNG</div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* Resume */}
                <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleDocumentUpload('resume', e.target.files[0])}
                      className="hidden"
                    />
                    <div className="text-gray-600">
                      {employeeDocuments.resume ? (
                        <div>
                          <span className="text-green-600">✓ {employeeDocuments.resume.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument('resume')}
                            className="ml-2 text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl mb-1">📋</div>
                          <div className="text-sm">Resume</div>
                          <div className="text-xs text-gray-500">PDF, DOC, DOCX</div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
                
                {/* Other Documents */}
                <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      multiple
                      onChange={(e) => handleMultipleDocuments(e.target.files)}
                      className="hidden"
                    />
                    <div className="text-gray-600">
                      <div className="text-2xl mb-1">📁</div>
                      <div className="text-sm">Other Documents</div>
                      <div className="text-xs text-gray-500">Multiple files</div>
                      {employeeDocuments.otherDocuments.length > 0 && (
                        <div className="mt-2 text-xs">
                          {employeeDocuments.otherDocuments.map((doc, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-1 rounded mb-1">
                              <span className="text-green-600 truncate">{doc.name}</span>
                              <button
                                type="button"
                                onClick={() => removeDocument('otherDocuments', index)}
                                className="text-red-600 ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded self-start">Add Employee</button>
          </form>
          <div className="text-sm text-gray-600 mb-4">
            <p>• Employee database is protected with MPIN for security</p>
            <p>• All employee KYC details are stored securely</p>
            <p>• Employees can be selected in the Salaries tab for payment entries</p>
          </div>
          
          {/* Employee Table with Sorting and Pagination */}
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2">Employee List</h4>
            
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-50 rounded">
              <input
                type="text"
                placeholder="Search by name or ID"
                value={employeeFilters.search || ''}
                onChange={e => setEmployeeFilters(prev => ({ ...prev, search: e.target.value }))}
                className="border rounded p-1 text-sm min-w-[200px]"
              />
              <select
                value={employeeFilters.designation || ''}
                onChange={e => setEmployeeFilters(prev => ({ ...prev, designation: e.target.value }))}
                className="border rounded p-1 text-sm"
              >
                <option value="">All Posts</option>
                {[...new Set(employees.map(emp => emp.designation).filter(Boolean))].map(designation => (
                  <option key={designation} value={designation}>{designation}</option>
                ))}
              </select>
              <select
                value={employeePageSize}
                onChange={e => setEmployeePageSize(Number(e.target.value))}
                className="border rounded p-1 text-sm"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
          </select>
        </div>
            
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-2 py-2 text-left cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEmployeeSort('employeeId')}
                    >
                      Employee ID {renderSortIcon('employeeId')}
                    </th>
                    <th 
                      className="px-2 py-2 text-left cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEmployeeSort('name')}
                    >
                      Employee Name {renderSortIcon('name')}
                    </th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th 
                      className="px-2 py-2 text-left cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEmployeeSort('designation')}
                    >
                      Post {renderSortIcon('designation')}
                    </th>
                    <th 
                      className="px-2 py-2 text-left cursor-pointer hover:bg-gray-100"
                      onClick={() => handleEmployeeSort('salary')}
                    >
                      Basic Salary {renderSortIcon('salary')}
                    </th>
                    <th className="px-2 py-2 text-left">HRA</th>
                    <th className="px-2 py-2 text-left">Conveyance</th>
                    <th className="px-2 py-2 text-left">Employer PF</th>
                    <th className="px-2 py-2 text-left">Gratuity</th>
                    <th className="px-2 py-2 text-left">Special Allowance</th>
                    <th className="px-2 py-2 text-left">Total CTC</th>
                    <th className="px-2 py-2 text-left">Monthly Salary</th>
                    <th className="px-2 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.length === 0 ? (
                    <tr><td colSpan={11} className="text-center text-gray-400 py-4">No employees found</td></tr>
                  ) : paginatedEmployees.map(emp => (
                    <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium">{emp.employeeId || 'N/A'}</td>
                      <td className="px-2 py-2">{emp.name}</td>
                      <td className="px-2 py-2">{emp.personType || 'Employee'}</td>
                      <td className="px-2 py-2">{emp.designation || 'N/A'}</td>
                      <td className="px-2 py-2">₹{Number(emp.basicSalaryAmount || emp.basicSalary || emp.salary || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2">₹{Number(emp.hraAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2">₹{Number(emp.conveyanceAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2">₹{Number(emp.employerPFAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2">₹{Number(emp.gratuityAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2">₹{Number(emp.specialAllowanceAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 font-semibold">₹{Number(emp.totalCTC || emp.salary || 0).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 font-semibold text-blue-600">₹{Math.round(Number(emp.salary || 0) / 12).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleViewEmployee(emp)}
                            className="text-blue-600 hover:text-blue-800 text-xs px-1"
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button 
                            onClick={() => handleEditEmployee(emp)}
                            className="text-green-600 hover:text-green-800 text-xs px-1"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleExportEmployee(emp)}
                            className="text-purple-600 hover:text-purple-800 text-xs px-1"
                            title="Export"
                          >
                            📄
                          </button>
                          <button 
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="text-red-600 hover:text-red-800 text-xs px-1"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex justify-between items-center mt-3">
              <div className="text-sm text-gray-600">
                Page {employeeCurrentPage} of {employeeTotalPages} ({filteredEmployees.length} employees)
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEmployeeCurrentPage(1)}
                  disabled={employeeCurrentPage === 1}
                  className="px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  First
                </button>
                <button
                  onClick={() => setEmployeeCurrentPage(prev => prev - 1)}
                  disabled={employeeCurrentPage === 1}
                  className="px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setEmployeeCurrentPage(prev => prev + 1)}
                  disabled={employeeCurrentPage === employeeTotalPages}
                  className="px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setEmployeeCurrentPage(employeeTotalPages)}
                  disabled={employeeCurrentPage === employeeTotalPages}
                  className="px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
          
          {/* Temporary fix button - remove after fixing */}
          <button 
            onClick={fixExistingEmployees}
            className="bg-orange-600 text-white px-3 py-1 rounded text-sm mt-2"
          >
            Fix Existing Employees (Add Missing IDs)
          </button>
          
          {/* Edit Employee Modal */}
          {showEditForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Edit Employee: {editingEmployee.name}</h3>
                    <button
                      onClick={handleCancelEditEmployee}
                      className="text-gray-500 hover:text-gray-700 text-xl"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveEmployee(editingEmployeeId); }}>
                    {/* Basic Information */}
                    <div className="mb-4">
                      <h4 className="text-md font-semibold mb-2">Basic Information</h4>
                      <div className="flex flex-wrap gap-2">
                        <input
                          name="name"
                          value={editingEmployee.name}
                          onChange={handleEditingEmployeeChange}
                          placeholder="Name"
                          className="border rounded p-2 text-sm"
                          required
                        />
                        <select
                          name="personType"
                          value={editingEmployee.personType || 'Employee'}
                          onChange={handleEditingEmployeeChange}
                          className="border rounded p-2 text-sm"
                        >
                          <option value="Employee">Employee</option>
                          <option value="Labour">Labour</option>
                          <option value="Freelancer">Freelancer</option>
                        </select>
                        <input
                          name="designation"
                          value={editingEmployee.designation}
                          onChange={handleEditingEmployeeChange}
                          placeholder="Designation"
                          className="border rounded p-2 text-sm"
                        />
                        <input
                          name="contact"
                          value={editingEmployee.contact}
                          onChange={handleEditingEmployeeChange}
                          placeholder="Contact"
                          className="border rounded p-2 text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Salary Structure */}
                    <div className="mb-4">
                      <h4 className="text-md font-semibold mb-2">Salary Structure</h4>
                      
                      {/* Salary Components */}
                      <div className="space-y-3">
                        {/* Basic Salary Row */}
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-600 w-24">Basic Salary</span>
                          <input
                            name="basicSalary"
                            value={editingEmployee.basicSalary}
                            onChange={handleEditingEmployeeChange}
                            placeholder="0"
                            type="number"
                            className="border rounded p-1 text-sm flex-1"
                            required
                          />
                          <span className="text-xs text-gray-500 w-20">Annual</span>
                          <input
                            value={editingEmployee.basicSalary || "0.00"}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                          <span className="text-xs text-gray-500 w-20">Monthly</span>
                          <input
                            value={((Number(editingEmployee.basicSalary) || 0) / 12).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                        </div>
                        
                        {/* HRA Row */}
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-600 w-24">HRA</span>
                          <input
                            name="hra"
                            value={editingEmployee.hra}
                            onChange={handleEditingEmployeeChange}
                            placeholder="0"
                            type="number"
                            className="border rounded p-1 text-sm flex-1"
                          />
                          <select
                            name="hraType"
                            value={editingEmployee.hraType || 'amount'}
                            onChange={handleEditingEmployeeChange}
                            className="border rounded p-1 text-xs w-16"
                          >
                            <option value="amount">₹</option>
                            <option value="percentage">%</option>
                          </select>
                          <span className="text-xs text-gray-500 w-20">Annual</span>
                          <input
                            value={calculateComponentAmount('hra', editingEmployee.hra, editingEmployee.hraType || 'amount', editingEmployee.basicSalary).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                          <span className="text-xs text-gray-500 w-20">Monthly</span>
                          <input
                            value={(calculateComponentAmount('hra', editingEmployee.hra, editingEmployee.hraType || 'amount', editingEmployee.basicSalary) / 12).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                        </div>
                        
                        {/* Conveyance Row */}
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-600 w-24">Conveyance</span>
                          <input
                            name="conveyanceAllowance"
                            value={editingEmployee.conveyanceAllowance}
                            onChange={handleEditingEmployeeChange}
                            placeholder="0"
                            type="number"
                            className="border rounded p-1 text-sm flex-1"
                          />
                          <select
                            name="conveyanceAllowanceType"
                            value={editingEmployee.conveyanceAllowanceType || 'amount'}
                            onChange={handleEditingEmployeeChange}
                            className="border rounded p-1 text-xs w-16"
                          >
                            <option value="amount">₹</option>
                            <option value="percentage">%</option>
                          </select>
                          <span className="text-xs text-gray-500 w-20">Annual</span>
                          <input
                            value={calculateComponentAmount('conveyanceAllowance', editingEmployee.conveyanceAllowance, editingEmployee.conveyanceAllowanceType || 'amount', editingEmployee.basicSalary).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                          <span className="text-xs text-gray-500 w-20">Monthly</span>
                          <input
                            value={(calculateComponentAmount('conveyanceAllowance', editingEmployee.conveyanceAllowance, editingEmployee.conveyanceAllowanceType || 'amount', editingEmployee.basicSalary) / 12).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                        </div>
                        
                        {/* Employer PF Row */}
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-600 w-24">Employer PF</span>
                          <input
                            name="employerPF"
                            value={editingEmployee.employerPF}
                            onChange={handleEditingEmployeeChange}
                            placeholder="0"
                            type="number"
                            className="border rounded p-1 text-sm flex-1"
                          />
                          <select
                            name="employerPFType"
                            value={editingEmployee.employerPFType || 'amount'}
                            onChange={handleEditingEmployeeChange}
                            className="border rounded p-1 text-xs w-16"
                          >
                            <option value="amount">₹</option>
                            <option value="percentage">%</option>
                          </select>
                          <span className="text-xs text-gray-500 w-20">Annual</span>
                          <input
                            value={calculateComponentAmount('employerPF', editingEmployee.employerPF, editingEmployee.employerPFType || 'amount', editingEmployee.basicSalary).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                          <span className="text-xs text-gray-500 w-20">Monthly</span>
                          <input
                            value={(calculateComponentAmount('employerPF', editingEmployee.employerPF, editingEmployee.employerPFType || 'amount', editingEmployee.basicSalary) / 12).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                        </div>
                        
                        {/* Gratuity Row */}
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-600 w-24">Gratuity</span>
                          <input
                            name="gratuity"
                            value={editingEmployee.gratuity}
                            onChange={handleEditingEmployeeChange}
                            placeholder="0"
                            type="number"
                            className="border rounded p-1 text-sm flex-1"
                          />
                          <select
                            name="gratuityType"
                            value={editingEmployee.gratuityType || 'amount'}
                            onChange={handleEditingEmployeeChange}
                            className="border rounded p-1 text-xs w-16"
                          >
                            <option value="amount">₹</option>
                            <option value="percentage">%</option>
                          </select>
                          <span className="text-xs text-gray-500 w-20">Annual</span>
                          <input
                            value={calculateComponentAmount('gratuity', editingEmployee.gratuity, editingEmployee.gratuityType || 'amount', editingEmployee.basicSalary).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                          <span className="text-xs text-gray-500 w-20">Monthly</span>
                          <input
                            value={(calculateComponentAmount('gratuity', editingEmployee.gratuity, editingEmployee.gratuityType || 'amount', editingEmployee.basicSalary) / 12).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                        </div>
                        
                        {/* Special Allowance Row */}
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-600 w-24">Special Allowance</span>
                          <input
                            name="specialAllowance"
                            value={editingEmployee.specialAllowance}
                            onChange={handleEditingEmployeeChange}
                            placeholder="0"
                            type="number"
                            className="border rounded p-1 text-sm flex-1"
                          />
                          <select
                            name="specialAllowanceType"
                            value={editingEmployee.specialAllowanceType || 'amount'}
                            onChange={handleEditingEmployeeChange}
                            className="border rounded p-1 text-xs w-16"
                          >
                            <option value="amount">₹</option>
                            <option value="percentage">%</option>
                          </select>
                          <span className="text-xs text-gray-500 w-20">Annual</span>
                          <input
                            value={calculateComponentAmount('specialAllowance', editingEmployee.specialAllowance, editingEmployee.specialAllowanceType || 'amount', editingEmployee.basicSalary).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                          <span className="text-xs text-gray-500 w-20">Monthly</span>
                          <input
                            value={(calculateComponentAmount('specialAllowance', editingEmployee.specialAllowance, editingEmployee.specialAllowanceType || 'amount', editingEmployee.basicSalary) / 12).toFixed(2)}
                            readOnly
                            className="border rounded p-1 text-sm w-20 bg-gray-100 text-right"
                            tabIndex={-1}
                          />
                        </div>
                        
                        {/* Total CTC Display */}
                        <div className="bg-blue-50 p-2 rounded text-center mt-3">
                          <div className="font-semibold text-blue-800">
                            Total CTC: ₹{calculateEditTotalCTC().toLocaleString('en-IN')}
                          </div>
                          <div className="text-sm text-blue-600">
                            Monthly Salary: ₹{(calculateEditTotalCTC() / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* KYC Information */}
                    <div className="mb-4">
                      <h4 className="text-md font-semibold mb-2">KYC Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
                          <input
                            name="contact"
                            value={editingEmployee.contact}
                            onChange={handleEditingEmployeeChange}
                            placeholder="Contact Number (10 digits)"
                            className={`border rounded p-2 text-sm w-full ${kycErrors.contact ? 'border-red-500' : ''}`}
                          />
                          {kycErrors.contact && <div className="text-red-500 text-xs mt-1">{kycErrors.contact}</div>}
        </div>
                        
        <div>
                          <input
                            name="aadhaar"
                            value={editingEmployee.aadhaar}
                            onChange={handleEditingEmployeeChange}
                            placeholder="Aadhaar (12 digits)"
                            className={`border rounded p-2 text-sm w-full ${kycErrors.aadhaar ? 'border-red-500' : ''}`}
                          />
                          {kycErrors.aadhaar && <div className="text-red-500 text-xs mt-1">{kycErrors.aadhaar}</div>}
        </div>
                        
        <div>
                          <input
                            name="pan"
                            value={editingEmployee.pan}
                            onChange={handleEditingEmployeeChange}
                            placeholder="PAN (ABCDE1234F)"
                            className={`border rounded p-2 text-sm w-full ${kycErrors.pan ? 'border-red-500' : ''}`}
                          />
                          {kycErrors.pan && <div className="text-red-500 text-xs mt-1">{kycErrors.pan}</div>}
        </div>
                        
                        <div>
                          <input
                            name="bankName"
                            value={editingEmployee.bankName}
                            onChange={handleEditingEmployeeChange}
                            placeholder="Bank Name"
                            className={`border rounded p-2 text-sm w-full ${kycErrors.bankName ? 'border-red-500' : ''}`}
                          />
                          {kycErrors.bankName && <div className="text-red-500 text-xs mt-1">{kycErrors.bankName}</div>}
                        </div>
                        
                        <div>
                          <input
                            name="bankAccount"
                            value={editingEmployee.bankAccount}
                            onChange={handleEditingEmployeeChange}
                            placeholder="Bank Account Number"
                            className={`border rounded p-2 text-sm w-full ${kycErrors.bankAccount ? 'border-red-500' : ''}`}
                          />
                          {kycErrors.bankAccount && <div className="text-red-500 text-xs mt-1">{kycErrors.bankAccount}</div>}
                        </div>
                        
                        <div>
                          <input
                            name="ifsc"
                            value={editingEmployee.ifsc}
                            onChange={handleEditingEmployeeChange}
                            placeholder="IFSC Code (ABCD0123456)"
                            className={`border rounded p-2 text-sm w-full ${kycErrors.ifsc ? 'border-red-500' : ''}`}
                          />
                          {kycErrors.ifsc && <div className="text-red-500 text-xs mt-1">{kycErrors.ifsc}</div>}
                        </div>
                        
                        <div className="md:col-span-2">
                          <textarea
                            name="address"
                            value={editingEmployee.address}
                            onChange={handleEditingEmployeeChange}
                            placeholder="Address"
                            className="border rounded p-2 text-sm w-full h-20 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Document Upload */}
                    <div className="mb-4">
                      <h4 className="text-md font-semibold mb-2">Update Documents</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Aadhaar Card */}
                        <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => setEditingEmployeeDocuments(prev => ({ ...prev, aadhaarCard: e.target.files[0] }))}
                              className="hidden"
                            />
                            <div className="text-gray-600">
                              {editingEmployeeDocuments.aadhaarCard ? (
        <div>
                                  <span className="text-green-600">✓ {editingEmployeeDocuments.aadhaarCard.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEmployeeDocuments(prev => ({ ...prev, aadhaarCard: null }))}
                                    className="ml-2 text-red-600 text-xs"
                                  >
                                    ✕
        </button>
        </div>
                              ) : (
        <div>
                                  <div className="text-2xl mb-1">📄</div>
                                  <div className="text-sm">Update Aadhaar</div>
                                  <div className="text-xs text-gray-500">PDF, JPG, PNG</div>
        </div>
                              )}
                            </div>
                          </label>
                        </div>
                        
                        {/* PAN Card */}
                        <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => setEditingEmployeeDocuments(prev => ({ ...prev, panCard: e.target.files[0] }))}
                              className="hidden"
                            />
                            <div className="text-gray-600">
                              {editingEmployeeDocuments.panCard ? (
        <div>
                                  <span className="text-green-600">✓ {editingEmployeeDocuments.panCard.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEmployeeDocuments(prev => ({ ...prev, panCard: null }))}
                                    className="ml-2 text-red-600 text-xs"
                                  >
                                    ✕
                                  </button>
        </div>
                              ) : (
                                <div>
                                  <div className="text-2xl mb-1">🆔</div>
                                  <div className="text-sm">Update PAN</div>
                                  <div className="text-xs text-gray-500">PDF, JPG, PNG</div>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                        
                        {/* Photo */}
                        <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png"
                              onChange={(e) => setEditingEmployeeDocuments(prev => ({ ...prev, photo: e.target.files[0] }))}
                              className="hidden"
                            />
                            <div className="text-gray-600">
                              {editingEmployeeDocuments.photo ? (
                                <div>
                                  <span className="text-green-600">✓ {editingEmployeeDocuments.photo.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEmployeeDocuments(prev => ({ ...prev, photo: null }))}
                                    className="ml-2 text-red-600 text-xs"
                                  >
                                    ✕
        </button>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl mb-1">📷</div>
                                  <div className="text-sm">Update Photo</div>
                                  <div className="text-xs text-gray-500">JPG, PNG</div>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                        
                        {/* Resume */}
                        <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => setEditingEmployeeDocuments(prev => ({ ...prev, resume: e.target.files[0] }))}
                              className="hidden"
                            />
                            <div className="text-gray-600">
                              {editingEmployeeDocuments.resume ? (
                                <div>
                                  <span className="text-green-600">✓ {editingEmployeeDocuments.resume.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEmployeeDocuments(prev => ({ ...prev, resume: null }))}
                                    className="ml-2 text-red-600 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl mb-1">📋</div>
                                  <div className="text-sm">Update Resume</div>
                                  <div className="text-xs text-gray-500">PDF, DOC, DOCX</div>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <button
                        type="button"
                        onClick={handleCancelEditEmployee}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Update Employee
                      </button>
                    </div>
      </form>
                </div>
              </div>
            </div>
          )}
    </div>
  );
    }
    // Salaries tab: new salary entry form and table
    if (selectedGroup === 'salaries') {
      // --- Salary Entry State ---
      // Functions are now defined in main scope for edit modal access

      const selectedEmp = employees.find(e => e.employeeId === salaryEmployeeId);
      const pendingIrregular = irregularPayments.filter(p => !p.applied && p.personType === 'Employee' && p.employeeId === salaryEmployeeId);
      // Validation
      const validateSalaryForm = () => {
        if (!salaryEmployeeId) return 'Select employee';
        if (!salaryDate) return 'Select date';
        if (!salaryMonth) return 'Select month';
        for (const row of performanceSalaryRows) {
          if (!row.type) return 'Select type for all performance components';
          if (!row.amount || isNaN(row.amount) || Number(row.amount) <= 0) return 'Enter valid amount for all performance components';
        }
        for (const deduction of salaryDeductions) {
          if (!deduction.reason) return 'Enter reason for all deductions';
          if (!deduction.amount || isNaN(deduction.amount) || Number(deduction.amount) <= 0) return 'Enter valid amount for all deductions';
        }
        return '';
      };
      // Submit handler
      const handleSalarySubmit = async e => {
        e.preventDefault();
        const err = validateSalaryForm();
        if (err) { setSalaryError(err); return; }
        setSalaryError('');
        const emp = employees.find(e => e.employeeId === salaryEmployeeId);
        const fixedTotal = fixedSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        const performanceTotal = performanceSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        // Include selected irregular payments (advances/bonus etc.) in totals
        const pendingForEmp = irregularPayments.filter(p => !p.applied && p.personType === 'Employee' && p.employeeId === salaryEmployeeId);
        const irregularEarningsTotal = pendingForEmp.reduce((sum, p) => sum + (appliedIrregularSelections[p.id] === 'Earning' ? (Number(p.amount) || 0) : 0), 0);
        const irregularDeductionsTotal = pendingForEmp.reduce((sum, p) => sum + (appliedIrregularSelections[p.id] === 'Deduction' ? (Number(p.amount) || 0) : 0), 0);
        const totalEarnings = fixedTotal + performanceTotal + irregularEarningsTotal;
        const totalDeductions = salaryDeductions.reduce((sum, deduction) => sum + (Number(deduction.amount) || 0), 0) + irregularDeductionsTotal;
        const netAmount = totalEarnings - totalDeductions;
        const irregularApplied = pendingForEmp.filter(p => appliedIrregularSelections[p.id]).map(p => ({ id: p.id, paymentType: p.paymentType, amount: Number(p.amount) || 0, appliedAs: appliedIrregularSelections[p.id], date: p.date }));
        
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/salaryPayments`), {
          employeeId: salaryEmployeeId,
          employeeName: emp?.name || '',
          post: emp?.designation || '',
          date: salaryDate,
          month: salaryMonth,
          fixedRows: fixedSalaryRows,
          performanceRows: performanceSalaryRows,
          deductions: salaryDeductions,
          irregularApplied,
          irregularEarningsTotal,
          irregularDeductionsTotal,
          totalEarnings,
          totalDeductions,
          netAmount,
        paymentMode: salaryPaymentMode,
          createdAt: serverTimestamp(),
        });
        // Mark irregulars as applied
        try {
          for (const item of irregularApplied) {
            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/irregularPayments`, item.id), {
              applied: true,
              appliedAt: serverTimestamp(),
              appliedInMonth: salaryMonth,
              appliedInPaymentDate: salaryDate,
              appliedAs: item.appliedAs,
            });
          }
        } catch (e) {
          console.warn('Failed to mark irregular payments applied', e);
        }
        await reloadSalaryPayments();
        // Reset to empty arrays
        setFixedSalaryRows([]);
        setPerformanceSalaryRows([]);
        setSalaryDeductions([]);
        setSalaryEmployeeId('');
        setSelectedEmployeeDisplay('');
        setSalaryDate('');
        setSalaryMonth('');
        setSalaryPaymentMode('Cash');
      };
      // Total calculation
      const fixedTotal = fixedSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const performanceTotal = performanceSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const pendingForEmp = irregularPayments.filter(p => !p.applied && p.personType === 'Employee' && p.employeeId === salaryEmployeeId);
      const irregularEarningsTotal = pendingForEmp.reduce((sum, p) => sum + (appliedIrregularSelections[p.id] === 'Earning' ? (Number(p.amount) || 0) : 0), 0);
      const irregularDeductionsTotal = pendingForEmp.reduce((sum, p) => sum + (appliedIrregularSelections[p.id] === 'Deduction' ? (Number(p.amount) || 0) : 0), 0);
      const totalEarnings = fixedTotal + performanceTotal + irregularEarningsTotal;
      const totalDeductions = salaryDeductions.reduce((sum, deduction) => sum + (Number(deduction.amount) || 0), 0) + irregularDeductionsTotal;
      const netAmount = totalEarnings - totalDeductions;
      // Export salary payments table
      const handleExportSalaryCSV = () => {
        const headers = ['Date', 'Month', 'Employee', 'Post', 'Type', 'Amount', 'Remark'];
        let csvContent = headers.join(',') + '\n';
        salaryPayments.forEach(entry => {
          entry.rows.forEach(row => {
            csvContent += [entry.date, entry.month, entry.employeeName + ' (' + entry.employeeId + ')', entry.post, row.type, row.amount, row.remark].map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',') + '\n';
          });
        });
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_payments_export_${salaryMonth || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      const handleExportSalaryExcel = () => {
        const headers = ['Date', 'Month', 'Employee', 'Post', 'Type', 'Amount', 'Remark'];
        const rows = [];
        salaryPayments.forEach(entry => {
          entry.rows.forEach(row => {
            rows.push([entry.date, entry.month, entry.employeeName + ' (' + entry.employeeId + ')', entry.post, row.type, row.amount, row.remark]);
          });
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SalaryPayments');
        XLSX.writeFile(wb, `salary_payments_export_${salaryMonth || 'all'}.xlsx`);
      };
      const handleExportSalaryPDF = () => {
        const docPDF = new jsPDF();
        const headers = [['Date', 'Month', 'Employee', 'Post', 'Type', 'Amount', 'Remark']];
        const rows = [];
        salaryPayments.forEach(entry => {
          entry.rows.forEach(row => {
            rows.push([entry.date, entry.month, entry.employeeName + ' (' + entry.employeeId + ')', entry.post, row.type, row.amount, row.remark]);
          });
        });
        import('jspdf-autotable')
          .then(({ default: autoTable }) => {
            autoTable(docPDF, { head: headers, body: rows });
          })
          .catch((e) => {
            console.warn('jspdf-autotable not available in Expenses salary export:', e);
          });
        docPDF.save(`salary_payments_export_${salaryMonth || 'all'}.pdf`);
      };
      // Salary payments total
      const totalPaid = salaryPayments.reduce((sum, entry) => sum + (Number(entry.netAmount || entry.total) || 0), 0);

        // Functions are now defined in main scope for edit modal access
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Salary Payment Entry</h3>
          <form className="flex flex-col gap-2 mb-4" onSubmit={handleSalarySubmit}>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative employee-dropdown">
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleDropdownToggle}
                    className="border rounded p-1 text-sm min-w-[200px] text-left bg-white flex justify-between items-center"
                  >
                    <span className={selectedEmployeeDisplay ? 'text-black' : 'text-gray-500'}>
                      {selectedEmployeeDisplay || 'Select employee...'}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </button>

                  {showEmployeeDropdown && (
                    <div className="absolute bg-white border border-gray-200 rounded shadow z-10 w-full max-h-60 overflow-hidden">
                      <input
                        type="text"
                        value={salarySearch}
                        onChange={e => {
                          setSalarySearch(e.target.value);
                          setSelectedEmployeeIndex(-1);
                        }}
                        onKeyDown={handleEmployeeKeyDown}
                        placeholder="Search..."
                        className="w-full p-2 border-b border-gray-200 focus:outline-none"
                        autoFocus
                      />
                      <div className="max-h-40 overflow-y-auto">
                        {filteredEmployeeOptions.length > 0 ? (
                          filteredEmployeeOptions.map((opt, idx) => (
                            <div
                              key={opt.value}
                              className={`px-2 py-2 cursor-pointer hover:bg-blue-100 ${idx === selectedEmployeeIndex ? 'bg-blue-200' : ''} ${salaryEmployeeId === opt.value ? 'bg-blue-50' : ''}`}
                              onMouseDown={() => handleEmployeeSelect(opt)}
                            >{opt.label}</div>
                          ))
                        ) : (
                          <div className="px-2 py-2 text-gray-500 text-sm">No employees found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <input value={selectedEmp?.designation || ''} readOnly className="border rounded p-1 text-sm min-w-[120px] bg-gray-100" placeholder="Post" />
              <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)} className="border rounded p-1 text-sm" required />
              <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} className="border rounded p-1 text-sm" required />
              <select value={salaryPaymentMode || 'Cash'} onChange={e => setSalaryPaymentMode(e.target.value)} className="border rounded p-1 text-sm">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {/* Enhanced Salary Payment Form */}
            <div className="bg-blue-50 p-4 rounded">
              <h5 className="text-sm font-semibold mb-3 text-blue-800">Salary Payment Entry</h5>
              
              {/* Employee Info & Calculator */}
              {selectedEmp && (
                <div className="mb-4 p-3 bg-blue-100 rounded">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Employee Info */}
                    <div>
                      <div className="font-medium text-blue-800">Employee: {selectedEmp.name} ({selectedEmp.employeeId})</div>
                      <div className="text-blue-600">Designation: {selectedEmp.designation || 'N/A'}</div>
                      <div className="text-blue-600">Monthly CTC: ₹{((Number(selectedEmp.totalCTC) || 0) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                    </div>
                    
                    {/* Quick Calculator */}
                    <div className="bg-white p-2 rounded border">
                      <div className="text-xs font-medium text-gray-700 mb-2">Quick Calculator</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div>Basic: ₹{((Number(selectedEmp.basicSalaryAmount || selectedEmp.basicSalary || 0)) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                        <div>HRA: ₹{((Number(selectedEmp.hraAmount || selectedEmp.hra || 0)) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                        <div>Conveyance: ₹{((Number(selectedEmp.conveyanceAmount || selectedEmp.conveyanceAllowance || 0)) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                        <div>PF: ₹{((Number(selectedEmp.employerPFAmount || selectedEmp.employerPF || 0)) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                        <div>Gratuity: ₹{((Number(selectedEmp.gratuityAmount || selectedEmp.gratuity || 0)) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                        <div>Special: ₹{((Number(selectedEmp.specialAllowanceAmount || selectedEmp.specialAllowance || 0)) / 12).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixed Salary Components (Auto-populated) */}
              <div className="mb-4">
                <h6 className="text-xs font-semibold mb-2 text-gray-700">Fixed Salary Components</h6>
                <div className="space-y-2">
                  {fixedSalaryRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{row.type}</div>
                        <div className="text-xs text-gray-500">{row.remark}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-green-700">₹{Number(row.amount).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                        <div className="text-xs text-gray-500">Fixed</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance-Based Components */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h6 className="text-xs font-semibold text-gray-700">Performance-Based Components</h6>
                  <button
                    type="button"
                    onClick={addPerformanceRow}
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                  >
                    + Add Component
                  </button>
                </div>
                <div className="space-y-2">
                  {performanceSalaryRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                      <select
                        value={row.type}
                        onChange={e => handlePerformanceRowChange(idx, 'type', e.target.value)}
                        className="border rounded p-1 text-sm min-w-[120px]"
                        required
                      >
                        <option value="">Select Type</option>
                        <option value="Advance">Advance</option>
                        <option value="Incentive">Incentive</option>
                        <option value="Bonus">Bonus</option>
                        <option value="Other">Other</option>
                      </select>
                      {row.type === 'Other' && (
                        <input
                          type="text"
                          value={row.otherType || ''}
                          onChange={e => handlePerformanceRowChange(idx, 'otherType', e.target.value)}
                          placeholder="Specify type"
                          className="border rounded p-1 text-sm w-32"
                          required
                        />
                      )}
                      <input
                        type="number"
                        value={row.amount}
                        onChange={e => handlePerformanceRowChange(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="border rounded p-1 text-sm w-24"
                        required
                      />
                      <input
                        value={row.remark}
                        onChange={e => handlePerformanceRowChange(idx, 'remark', e.target.value)}
                        placeholder="Remark"
                        className="border rounded p-1 text-sm w-32"
                      />
                      <button
                        type="button"
                        onClick={() => removePerformanceRow(idx)}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deductions Section */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h6 className="text-xs font-semibold text-gray-700">Deductions</h6>
                  <button
                    type="button"
                    onClick={addDeduction}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                  >
                    + Add Deduction
                  </button>
                </div>
                <div className="space-y-2">
                  {salaryDeductions.map((deduction, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-red-50 p-2 rounded border border-red-200">
                      <select
                        value={deduction.reason}
                        onChange={e => handleDeductionChange(idx, 'reason', e.target.value)}
                        className="border rounded p-1 text-sm min-w-[120px]"
                        required
                      >
                        <option value="">Select Reason</option>
                        <option value="Advance Repayment">Advance Repayment</option>
                        <option value="Unpaid Leave">Unpaid Leave</option>
                        <option value="Late Coming">Late Coming</option>
                        <option value="Loan Repayment">Loan Repayment</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Other">Other</option>
                      </select>
                      {deduction.reason === 'Other' && (
                        <input
                          type="text"
                          value={deduction.otherReason || ''}
                          onChange={e => handleDeductionChange(idx, 'otherReason', e.target.value)}
                          placeholder="Specify reason"
                          className="border rounded p-1 text-sm w-32"
                          required
                        />
                      )}
                      <input
                        type="number"
                        value={deduction.amount}
                        onChange={e => handleDeductionChange(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="border rounded p-1 text-sm w-24"
                        required
                      />
                      <input
                        value={deduction.remark}
                        onChange={e => handleDeductionChange(idx, 'remark', e.target.value)}
                        placeholder="Remark"
                        className="border rounded p-1 text-sm w-32"
                      />
                      <button
                        type="button"
                        onClick={() => removeDeduction(idx)}
                        className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Irregular payments to apply */}
              {salaryEmployeeId && (
                <div className="mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-xs font-semibold text-yellow-800">Pending Labour/Advance items for this employee</h6>
                    <span className="text-xs text-yellow-700">Select how to apply in this salary</span>
                  </div>
                  {pendingIrregular.length === 0 ? (
                    <div className="text-xs text-gray-600">No pending items</div>
                  ) : (
                    <div className="space-y-2">
                      {pendingIrregular.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                          <div className="flex-1 text-xs">
                            <div className="font-semibold">
                              {item.paymentType} - ₹{Number(item.amount || 0).toLocaleString('en-IN')} <span className="text-gray-500">({item.date})</span>
                            </div>
                            {item.remark && <div className="text-gray-500">{item.remark}</div>}
                          </div>
                          <select
                            value={appliedIrregularSelections[item.id] || ''}
                            onChange={e => setAppliedIrregularSelections(s => ({ ...s, [item.id]: e.target.value }))}
                            className="border rounded p-1 text-xs"
                          >
                            <option value="">Ignore</option>
                            <option value="Earning">Add to Earnings</option>
                            <option value="Deduction">Deduct from Salary</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary & Calculator */}
              <div className="bg-white p-3 rounded border">
                <h6 className="text-xs font-semibold mb-2 text-gray-700">Payment Summary</h6>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Total Earnings:</div>
                    <div className="font-semibold text-green-700">₹{totalEarnings.toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Total Deductions:</div>
                    <div className="font-semibold text-red-700">₹{totalDeductions.toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Net Amount:</div>
                    <div className={`font-semibold ${netAmount >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      ₹{netAmount.toLocaleString('en-IN', {maximumFractionDigits: 2})}
                    </div>
                  </div>
                </div>
              </div>


              {/* Summary & Calculator */}
              <div className="bg-white p-3 rounded border">
                <h6 className="text-xs font-semibold mb-2 text-gray-700">Payment Summary</h6>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Total Earnings:</div>
                    <div className="font-semibold text-green-700">₹{totalEarnings.toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Total Deductions:</div>
                    <div className="font-semibold text-red-700">₹{totalDeductions.toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Net Amount:</div>
                    <div className={`font-semibold ${netAmount >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      ₹{netAmount.toLocaleString('en-IN', {maximumFractionDigits: 2})}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {salaryError && <div className="text-red-600 text-sm mt-1">{salaryError}</div>}
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded mt-2">Save Entry</button>
          </form>
          {/* Salary Payments Table */}
          <div className="mb-2 flex justify-end gap-2">
            <button onClick={handleExportSalaryCSV} className="bg-blue-600 text-white px-3 py-1 rounded shadow hover:bg-blue-700">Export CSV</button>
            <button onClick={handleExportSalaryExcel} className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700">Export Excel</button>
            <button onClick={handleExportSalaryPDF} className="bg-purple-600 text-white px-3 py-1 rounded shadow hover:bg-purple-700">Export PDF</button>
          </div>
          <div className="overflow-x-auto rounded border border-gray-200">
              <table id="salaries-table" className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Month</th>
                  <th className="px-2 py-1">Employee</th>
                  <th className="px-2 py-1">Post</th>
                  <th className="px-2 py-1">Payment Mode</th>
                  <th className="px-2 py-1">Earnings</th>
                  <th className="px-2 py-1">Deductions</th>
                  <th className="px-2 py-1">Net Amount</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaryPayments.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-400">No entries</td></tr>
                ) : salaryPayments.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-2 py-1">{entry.date}</td>
                    <td className="px-2 py-1">{entry.month}</td>
                    <td className="px-2 py-1">{entry.employeeName} ({entry.employeeId})</td>
                    <td className="px-2 py-1">{entry.post}</td>
                    <td className="px-2 py-1">{entry.paymentMode || '-'}</td>
                    <td className="px-2 py-1 text-green-600 font-medium">₹{Number(entry.totalEarnings || entry.total || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-red-600 font-medium">₹{Number(entry.totalDeductions || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-blue-600 font-bold">₹{Number(entry.netAmount || entry.total || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditSalaryPayment(entry)}
                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSalaryPayment(entry.id)}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right font-bold">Total Paid:</td>
                  <td className="text-green-600 font-bold">₹{totalPaid.toLocaleString('en-IN')}</td>
                  <td className="text-red-600 font-bold">₹{salaryPayments.reduce((sum, entry) => sum + (Number(entry.totalDeductions) || 0), 0).toLocaleString('en-IN')}</td>
                  <td className="text-blue-600 font-bold">₹{salaryPayments.reduce((sum, entry) => sum + (Number(entry.netAmount || entry.total) || 0), 0).toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
            
            {/* Debug tools removed for production */}
          </div>
        </div>
      );
    }
    if (selectedGroup === 'fixed') {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Add Fixed Expense</h3>
          <form className="flex flex-wrap gap-2 mb-4" onSubmit={handleAddExpense}>
            <input name="date" value={expenseForm.date} onChange={handleExpenseFormChange} type="date" className="border rounded p-1 text-sm" required />
            <select name="head" value={expenseForm.head} onChange={handleExpenseFormChange} className="border rounded p-1 text-sm" required>
              <option value="">Select Head</option>
              {FIXED_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <input name="amount" value={expenseForm.amount} onChange={handleExpenseFormChange} type="number" placeholder="Amount" className="border rounded p-1 text-sm" required />
            <select name="paymentMode" value={expenseForm.paymentMode} onChange={handleExpenseFormChange} className="border rounded p-1 text-sm">
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
            <input name="description" value={expenseForm.description} onChange={handleExpenseFormChange} placeholder="Description" className="border rounded p-1 text-sm" />
            <input name="receipt" type="file" accept="image/*,application/pdf" onChange={handleExpenseFormChange} className="border rounded p-1 text-sm" />
            {editingExpenseId ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSaveExpense(editingExpenseId)} className="bg-green-600 text-white px-3 py-1 rounded">Save Changes</button>
                <button type="button" onClick={handleCancelEditExpense} className="bg-gray-500 text-white px-3 py-1 rounded">Cancel</button>
              </div>
            ) : (
              <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Add Expense</button>
            )}
          </form>

          {/* Fixed Expenses Table */}
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-3">Fixed Expenses List</h4>
            <div className="overflow-x-auto">
              <table id="fixed-expenses-table" className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 border-b text-left">Date</th>
                    <th className="px-3 py-2 border-b text-left">Head</th>
                    <th className="px-3 py-2 border-b text-right">Amount</th>
                    <th className="px-3 py-2 border-b text-left">Payment Mode</th>
                    <th className="px-3 py-2 border-b text-left">Description</th>
                    <th className="px-3 py-2 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-gray-400">No fixed expenses found</td></tr>
                  ) : expenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border-b">{expense.date}</td>
                      <td className="px-3 py-2 border-b">{expense.head}</td>
                      <td className="px-3 py-2 border-b text-right">₹{Number(expense.amount).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 border-b">{expense.paymentMode || '-'}</td>
                      <td className="px-3 py-2 border-b">{expense.description || '-'}</td>
                      <td className="px-3 py-2 border-b text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleViewExpense(expense)}
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td colSpan={2} className="px-3 py-2 font-bold">Total:</td>
                    <td className="px-3 py-2 text-right font-bold">₹{expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0).toLocaleString('en-IN')}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      );
    }
    if (selectedGroup === 'advances') {
      const employeeOptions = employees.map(e => ({ value: e.employeeId, label: `${e.name} (${e.employeeId})` }));
      const handleIrregularEmployeeSelect = (e) => setIrregularForm(f => ({ ...f, employeeId: e.target.value }));
      const rows = irregularPayments;
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Labour/Advances</h3>
          <form className="flex flex-wrap gap-2 mb-4" onSubmit={handleSaveIrregular}>
            <input type="date" name="date" value={irregularForm.date} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm" required />
            <select name="personType" value={irregularForm.personType} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm">
              <option value="Employee">Employee</option>
              <option value="Labour">Labour</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Other">Other</option>
            </select>
            {irregularForm.personType === 'Employee' ? (
              <select value={irregularForm.employeeId} onChange={handleIrregularEmployeeSelect} className="border rounded p-1 text-sm min-w-[200px]">
                <option value="">Select employee...</option>
                {employeeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : (
              <input name="personName" placeholder="Person name" value={irregularForm.personName} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm min-w-[200px]" />
            )}
            <select name="paymentType" value={irregularForm.paymentType} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm">
              <option>Advance</option>
              <option>Festival Bonus</option>
              <option>Bonus</option>
              <option>Incentive</option>
              <option>Other</option>
            </select>
            <input name="amount" type="number" placeholder="Amount" value={irregularForm.amount} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm w-24" required />
            <input name="remark" placeholder="Remark" value={irregularForm.remark} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm w-48" />
            <select name="paymentMode" value={irregularForm.paymentMode} onChange={handleIrregularFormChange} className="border rounded p-1 text-sm">
              <option>Cash</option>
              <option>Bank Transfer</option>
              <option>UPI</option>
              <option>Cheque</option>
              <option>Card</option>
              <option>Other</option>
            </select>
            <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
          </form>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Person</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Amount</th>
                  <th className="px-2 py-1">Payment Mode</th>
                  <th className="px-2 py-1">Applied</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-4 text-gray-400">No entries</td></tr>
                ) : rows.map(item => (
                  <tr key={item.id}>
                    <td className="px-2 py-1">{item.date}</td>
                    <td className="px-2 py-1">
                      {item.personType === 'Employee' ? (
                        employees.find(e => e.employeeId === item.employeeId)?.name || item.employeeId
                      ) : (
                        item.personName || '-'
                      )}
                    </td>
                    <td className="px-2 py-1">{item.paymentType}</td>
                    <td className="px-2 py-1 text-blue-600 font-semibold">₹{Number(item.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1">{item.paymentMode || '-'}</td>
                    <td className="px-2 py-1">{item.applied ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => handleDeleteIrregular(item.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    if (selectedGroup === 'variable') {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Add Variable Expense</h3>
          <form className="flex flex-wrap gap-2 mb-4" onSubmit={handleAddExpense}>
            <input name="date" value={expenseForm.date} onChange={handleExpenseFormChange} type="date" className="border rounded p-1 text-sm" required />
            <select name="head" value={expenseForm.head} onChange={handleExpenseFormChange} className="border rounded p-1 text-sm" required>
              <option value="">Select Head</option>
              {VARIABLE_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <input name="amount" value={expenseForm.amount} onChange={handleExpenseFormChange} type="number" placeholder="Amount" className="border rounded p-1 text-sm" required />
            <select name="paymentMode" value={expenseForm.paymentMode} onChange={handleExpenseFormChange} className="border rounded p-1 text-sm">
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
            <input name="description" value={expenseForm.description} onChange={handleExpenseFormChange} placeholder="Description" className="border rounded p-1 text-sm" />
            <input name="receipt" type="file" accept="image/*,application/pdf" onChange={handleExpenseFormChange} className="border rounded p-1 text-sm" />
            {editingExpenseId ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSaveExpense(editingExpenseId)} className="bg-green-600 text-white px-3 py-1 rounded">Save Changes</button>
                <button type="button" onClick={handleCancelEditExpense} className="bg-gray-500 text-white px-3 py-1 rounded">Cancel</button>
              </div>
            ) : (
              <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded">Add Expense</button>
            )}
          </form>

          {/* Variable Expenses Table */}
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-3">Variable Expenses List</h4>
            <div className="overflow-x-auto">
              <table id="variable-expenses-table" className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 border-b text-left">Date</th>
                    <th className="px-3 py-2 border-b text-left">Head</th>
                    <th className="px-3 py-2 border-b text-right">Amount</th>
                    <th className="px-3 py-2 border-b text-left">Payment Mode</th>
                    <th className="px-3 py-2 border-b text-left">Description</th>
                    <th className="px-3 py-2 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-gray-400">No variable expenses found</td></tr>
                  ) : expenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border-b">{expense.date}</td>
                      <td className="px-3 py-2 border-b">{expense.head}</td>
                      <td className="px-3 py-2 border-b text-right">₹{Number(expense.amount).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 border-b">{expense.paymentMode || '-'}</td>
                      <td className="px-3 py-2 border-b">{expense.description || '-'}</td>
                      <td className="px-3 py-2 border-b text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleViewExpense(expense)}
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td colSpan={2} className="px-3 py-2 font-bold">Total:</td>
                    <td className="px-3 py-2 text-right font-bold">₹{expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0).toLocaleString('en-IN')}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Pagination controls ---
  const handlePageChange = newPage => {
    setPage(newPage);
  };
  const handlePageSizeChange = e => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  // --- Table header with sorting ---
  const renderSortableHeader = (label, key) => (
    <th
      className="px-4 py-2 text-center cursor-pointer select-none hover:text-blue-600"
      onClick={() => handleSort(key)}
    >
      {label} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕️'}
    </th>
  );

  // 1. Default present date for salaryDate
  useEffect(() => {
    if (!salaryDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setSalaryDate(`${yyyy}-${mm}-${dd}`);
    }
  }, []);

  // 2. useEffect for employee selection
  useEffect(() => {
    if (salaryEmployeeId) {
      const emp = employees.find(e => e.employeeId === salaryEmployeeId);
      if (emp) {
        setFixedSalaryRows(getMonthlySalaryRows(emp));
        // Only reset performance rows when NOT editing
        if (!isEditingSalary) {
          setPerformanceSalaryRows([]); // Reset performance rows when employee changes
        }
      }
    }
    // eslint-disable-next-line
  }, [salaryEmployeeId, isEditingSalary]);

  // 3. +Add Type only adds extra rows (removable)
  const addSalaryRow = () => setPerformanceSalaryRows(rows => [...rows, { type: '', amount: 0, remark: '', fixed: false }]);

  // Salary payment handlers (moved to main scope for edit modal access)
  const addPerformanceRow = () => setPerformanceSalaryRows(rows => [...rows, { type: '', amount: '', remark: '', fixed: false, removable: true }]);
  const removePerformanceRow = idx => setPerformanceSalaryRows(rows => rows.filter((_, i) => i !== idx));
  const handlePerformanceRowChange = (idx, field, value) => setPerformanceSalaryRows(rows => rows.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  
  const addDeduction = () => setSalaryDeductions(deductions => [...deductions, { reason: '', amount: '', remark: '', otherReason: '' }]);
  const removeDeduction = (idx) => setSalaryDeductions(deductions => deductions.filter((_, i) => i !== idx));
  const handleDeductionChange = (idx, field, value) => setSalaryDeductions(deductions => deductions.map((deduction, i) => i === idx ? { ...deduction, [field]: value } : deduction));

  // Edit and Delete handlers for salary payments
  const handleEditSalaryPayment = (payment) => {
    setIsEditingSalary(true); // Set editing flag
    setEditingSalaryPayment(payment);
    setSalaryEmployeeId(payment.employeeId);
    setSalaryDate(payment.date);
    setSalaryMonth(payment.month);
    setSalaryPaymentMode(payment.paymentMode || 'Cash');
    setSelectedEmployeeDisplay(payment.employeeName);
    
    // Load existing data - handle both old and new formats
    if (payment.fixedRows && payment.performanceRows) {
      // New format
      setFixedSalaryRows(payment.fixedRows || []);
      setPerformanceSalaryRows(payment.performanceRows || []);
    } else if (payment.rows) {
      // Old format - separate fixed and performance components
      const fixedRows = payment.rows.filter(row => row.fixed);
      const performanceRows = payment.rows.filter(row => !row.fixed);
      setFixedSalaryRows(fixedRows);
      setPerformanceSalaryRows(performanceRows);
    } else {
      setFixedSalaryRows([]);
      setPerformanceSalaryRows([]);
    }
    setSalaryDeductions(payment.deductions || []);
    
    setShowEditSalaryModal(true);
  };

  // --- Irregular payments helpers ---
  const handleIrregularFormChange = e => {
    const { name, value } = e.target;
    setIrregularForm(f => ({ ...f, [name]: value }));
  };
  const handleSaveIrregular = async (e) => {
    e.preventDefault();
    if (!irregularForm.amount || Number(irregularForm.amount) <= 0) return alert('Enter valid amount');
    if (irregularForm.personType === 'Employee' && !irregularForm.employeeId) return alert('Select employee');
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/irregularPayments`), {
        ...irregularForm,
        amount: Number(irregularForm.amount),
        applied: false,
        createdAt: serverTimestamp(),
      });
      setIrregularForm({
        date: new Date().toISOString().split('T')[0],
        personType: 'Employee',
        employeeId: '',
        personName: '',
        paymentType: 'Advance',
        amount: '',
        remark: '',
        paymentMode: 'Cash'
      });
    } catch (e) {
      console.error('Failed to save irregular payment', e);
      alert('Failed to save');
    }
  };
  const handleDeleteIrregular = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/irregularPayments`, id));
    } catch (e) {
      console.error('Delete irregular failed', e);
      alert('Failed to delete');
    }
  };

  const handleDeleteSalaryPayment = async (paymentId) => {
    // Check if the payment ID exists in the current data
    const paymentExists = salaryPayments.find(p => p.id === paymentId);
    if (!paymentExists) {
      console.error('Payment not found in current data:', paymentId);
      alert('Payment not found. Please refresh the page and try again.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this salary payment? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/salaryPayments`, paymentId));
        alert('Salary payment deleted successfully!');
      } catch (error) {
        console.error('Error deleting salary payment:', error);
        alert(`Error deleting salary payment: ${error.message}. Please try again.`);
      }
    }
  };



  const handleSaveEditSalaryPayment = async () => {
    try {
      const fixedTotal = fixedSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const performanceTotal = performanceSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const totalEarnings = fixedTotal + performanceTotal;
      const totalDeductions = salaryDeductions.reduce((sum, deduction) => sum + (Number(deduction.amount) || 0), 0);
      const netAmount = totalEarnings - totalDeductions;

      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/salaryPayments`, editingSalaryPayment.id), {
        fixedRows: fixedSalaryRows,
        performanceRows: performanceSalaryRows,
        deductions: salaryDeductions,
        totalEarnings,
        totalDeductions,
        netAmount,
        paymentMode: salaryPaymentMode,
        updatedAt: serverTimestamp(),
      });
      await reloadSalaryPayments();

      alert('Salary payment updated successfully!');
      setShowEditSalaryModal(false);
      setEditingSalaryPayment(null);
      setIsEditingSalary(false); // Reset editing flag
      setFixedSalaryRows([]);
      setPerformanceSalaryRows([]);
      setSalaryDeductions([]);
      // Clear any pre-filled selection in main form
      setSalaryEmployeeId('');
      setSelectedEmployeeDisplay('');
      setSalaryDate('');
      setSalaryMonth('');
    } catch (error) {
      console.error('Error updating salary payment:', error);
      alert('Error updating salary payment. Please try again.');
    }
  };

  const handleCancelEditSalaryPayment = () => {
    setShowEditSalaryModal(false);
    setEditingSalaryPayment(null);
    setIsEditingSalary(false); // Reset editing flag
    setFixedSalaryRows([]);
    setPerformanceSalaryRows([]);
    setSalaryDeductions([]);
    // Also reset main form fields so edited values don't linger
    setSalaryEmployeeId('');
    setSelectedEmployeeDisplay('');
    setSalaryDate('');
    setSalaryMonth('');
  };



  // Helper function to calculate component amount based on type
  const calculateComponentAmount = (componentName, value, type, basicSalary) => {
    const numValue = Number(value) || 0;
    const numBasic = Number(basicSalary) || 0;
    if (type === 'percentage') {
      return (numBasic * numValue) / 100;
    } else {
      return numValue;
    }
  };

  // Calculate total CTC
  const calculateTotalCTC = () => {
    const basic = Number(employeeForm.basicSalary) || 0;
    const hra = calculateComponentAmount('hra', employeeForm.hra, employeeForm.hraType || 'amount', basic);
    const conveyance = calculateComponentAmount('conveyanceAllowance', employeeForm.conveyanceAllowance, employeeForm.conveyanceAllowanceType || 'amount', basic);
    const pf = calculateComponentAmount('employerPF', employeeForm.employerPF, employeeForm.employerPFType || 'amount', basic);
    const gratuity = calculateComponentAmount('gratuity', employeeForm.gratuity, employeeForm.gratuityType || 'amount', basic);
    const special = calculateComponentAmount('specialAllowance', employeeForm.specialAllowance, employeeForm.specialAllowanceType || 'amount', basic);
    return basic + hra + conveyance + pf + gratuity + special;
  };

  // Calculate total CTC for edit form
  const calculateEditTotalCTC = () => {
    const basic = Number(editingEmployee.basicSalary) || 0;
    const hra = calculateComponentAmount('hra', editingEmployee.hra, editingEmployee.hraType || 'amount', basic);
    const conveyance = calculateComponentAmount('conveyanceAllowance', editingEmployee.conveyanceAllowance, editingEmployee.conveyanceAllowanceType || 'amount', basic);
    const pf = calculateComponentAmount('employerPF', editingEmployee.employerPF, editingEmployee.employerPFType || 'amount', basic);
    const gratuity = calculateComponentAmount('gratuity', editingEmployee.gratuity, editingEmployee.gratuityType || 'amount', basic);
    const special = calculateComponentAmount('specialAllowance', editingEmployee.specialAllowance, editingEmployee.specialAllowanceType || 'amount', basic);
    return basic + hra + conveyance + pf + gratuity + special;
  };

  // Test function for debugging employee data
  const testEmployeeData = () => {
    console.log('=== Employee Data Test ===');
    console.log('Total employees:', employees.length);
    if (employees.length > 0) {
      const firstEmployee = employees[0];
      console.log('First employee data:', firstEmployee);
      console.log('Basic Salary Amount:', firstEmployee.basicSalaryAmount);
      console.log('HRA Amount:', firstEmployee.hraAmount);
      console.log('Conveyance Amount:', firstEmployee.conveyanceAmount);
      console.log('Employer PF Amount:', firstEmployee.employerPFAmount);
      console.log('Gratuity Amount:', firstEmployee.gratuityAmount);
      console.log('Special Allowance Amount:', firstEmployee.specialAllowanceAmount);
      console.log('Total CTC:', firstEmployee.totalCTC);
    }
    console.log('========================');
  };

  // Test function for debugging salary delete functionality
  const testSalaryDelete = () => {
    console.log('=== Salary Delete Test ===');
    console.log('Salary Payments:', salaryPayments);
    console.log('=======================');
  };

  // Make test functions available globally
  useEffect(() => {
    window.testEmployeeData = testEmployeeData;
    window.testSalaryDelete = testSalaryDelete;
  }, [employees, salaryPayments]);

  // Migration functionality
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  // Check for migration on component mount
  useEffect(() => {
    if (isAuthReady && userId) {
      checkMigrationNeeded(db).then(status => {
        setMigrationStatus(status);
      });
    }
  }, [isAuthReady, userId]);

  const handleMigration = async () => {
    if (!userId || !appId) return;
    
    setIsMigrating(true);
    try {
      const result = await migrateExpenseData(db, appId, userId);
      if (result.success) {
        setMigrationSuccess(true);
        setMigrationStatus({ needed: false, counts: { employees: 0, expenses: 0, salaryPayments: 0 } });
        setTimeout(() => setMigrationSuccess(false), 5000); // Hide after 5 seconds
      } else {
        alert(`Migration failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Migration error: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // Authentication check after all hooks are declared
  if (!isAuthReady) {
    return <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h2 className="text-2xl font-bold mb-4">Expenses</h2>
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Authentication not ready. Please wait...</p>
      </div>
    </div>;
  }
  
  if (!userId) {
    return <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h2 className="text-2xl font-bold mb-4">Expenses</h2>
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">No user ID found. Please log in again.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    </div>;
  }
  
  if (!appId) {
    return <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h2 className="text-2xl font-bold mb-4">Expenses</h2>
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">No app ID found. Please check configuration.</p>
      </div>
    </div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h2 className="text-2xl font-bold mb-4">Expenses</h2>
      

      
      {/* Migration Notice */}
      {migrationStatus?.needed && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Data Migration Required</h3>
              <p className="text-yellow-700 mb-2">
                Your expense data needs to be migrated to the new user-specific structure. 
                This will ensure your data is properly organized and secure.
              </p>
              <div className="text-sm text-yellow-600">
                Found: {migrationStatus.counts.employees} employees, {migrationStatus.counts.expenses} expenses, {migrationStatus.counts.salaryPayments} salary payments
              </div>
            </div>
            <button
              onClick={handleMigration}
              disabled={isMigrating}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMigrating ? 'Migrating...' : 'Migrate Data'}
            </button>
          </div>
        </div>
      )}

      {/* Migration Success Message */}
      {migrationSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-green-800">Migration Completed Successfully!</h3>
              <p className="text-green-700">Your expense data has been migrated to the new user-specific structure.</p>
            </div>
          </div>
        </div>
      )}
      {/* Summary/Analytics */}
      <div className="flex gap-8 mb-4 flex-wrap">
        <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2 text-blue-800 font-semibold">Total: ₹{totalAmount.toLocaleString('en-IN')}</div>
        <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-green-800 font-semibold">Entries: {totalCount}</div>
        <div className="bg-yellow-50 border border-yellow-200 rounded px-4 py-2 text-yellow-800 font-semibold">
          <span className="font-bold">Category-wise:</span>
          {categorySummary.length === 0 ? ' N/A' : (
            <ul className="list-disc ml-4">
              {categorySummary.map(([cat, amt]) => (
                <li key={cat}>{cat}: ₹{amt.toLocaleString('en-IN')}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded px-4 py-2 text-purple-800 font-semibold">
          <span className="font-bold">Date-wise:</span>
          {dateSummary.length === 0 ? ' N/A' : (
            <ul className="list-disc ml-4">
              {dateSummary.map(([dt, amt]) => (
                <li key={dt}>{dt}: ₹{amt.toLocaleString('en-IN')}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* Export Dropdown */}
      <div className="mb-2 flex justify-end" ref={exportRef}>
        <div className="relative">
          <button onClick={() => setExportDropdownOpen(o => !o)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2">
            Export <span className="text-xs">▼</span>
          </button>
          {exportDropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow z-50">
              <button onClick={handleExportCSV} className="block w-full text-left px-4 py-2 hover:bg-blue-50">Export as CSV</button>
              <button onClick={handleExportExcel} className="block w-full text-left px-4 py-2 hover:bg-green-50">Export as Excel</button>
              <button onClick={handleExportPDF} className="block w-full text-left px-4 py-2 hover:bg-purple-50">Export as PDF</button>
            </div>
          )}
        </div>
      </div>
      {/* Tabs for groups */}
      <div className="flex gap-2 mb-4">
        {GROUPS.map(group => (
          <button
            key={group.key}
            onClick={() => { setSelectedGroup(group.key); setPage(1); }}
            className={`px-6 py-2 text-base font-bold focus:outline-none transition-all duration-150
              ${selectedGroup === group.key
                ? 'bg-blue-600 text-white rounded shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 rounded border border-gray-200'}
            `}
            style={{ minWidth: 120 }}
          >
            {group.label}
          </button>
        ))}
      </div>
      {/* Group-specific form */}
      {renderGroupForm()}



      {/* Salary Payment Edit Modal */}
      {showEditSalaryModal && editingSalaryPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Salary Payment</h3>
              <button
                onClick={handleCancelEditSalaryPayment}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Employee Info */}
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Employee:</span> {editingSalaryPayment.employeeName}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {editingSalaryPayment.date}
                </div>
                <div>
                  <span className="font-medium">Month:</span> {editingSalaryPayment.month}
                </div>
                <div>
                  <span className="font-medium">Post:</span> {editingSalaryPayment.post}
                </div>
              </div>
            </div>

            {/* Fixed Salary Components */}
            <div className="mb-4">
              <h6 className="text-sm font-semibold mb-2 text-gray-700">Fixed Salary Components</h6>
              <div className="space-y-2">
                {fixedSalaryRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{row.type}</div>
                      <div className="text-xs text-gray-500">{row.remark}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-700">₹{Number(row.amount).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
                      <div className="text-xs text-gray-500">Fixed</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance-Based Components */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h6 className="text-sm font-semibold text-gray-700">Performance-Based Components</h6>
                <button
                  type="button"
                  onClick={addPerformanceRow}
                  className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                >
                  + Add Component
                </button>
              </div>
              <div className="space-y-2">
                {performanceSalaryRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                    <select
                      value={row.type}
                      onChange={e => handlePerformanceRowChange(idx, 'type', e.target.value)}
                      className="border rounded p-1 text-sm min-w-[120px]"
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="Advance">Advance</option>
                      <option value="Incentive">Incentive</option>
                      <option value="Bonus">Bonus</option>
                      <option value="Other">Other</option>
                    </select>
                    {row.type === 'Other' && (
                      <input
                        type="text"
                        value={row.otherType || ''}
                        onChange={e => handlePerformanceRowChange(idx, 'otherType', e.target.value)}
                        placeholder="Specify type"
                        className="border rounded p-1 text-sm w-32"
                        required
                      />
                    )}
                    <input
                      type="number"
                      value={row.amount}
                      onChange={e => handlePerformanceRowChange(idx, 'amount', e.target.value)}
                      placeholder="Amount"
                      className="border rounded p-1 text-sm w-24"
                      required
                    />
                    <input
                      value={row.remark}
                      onChange={e => handlePerformanceRowChange(idx, 'remark', e.target.value)}
                      placeholder="Remark"
                      className="border rounded p-1 text-sm w-32"
                    />
                    <button
                      type="button"
                      onClick={() => removePerformanceRow(idx)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h6 className="text-sm font-semibold text-gray-700">Deductions</h6>
                <button
                  type="button"
                  onClick={addDeduction}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                >
                  + Add Deduction
                </button>
              </div>
              <div className="space-y-2">
                {salaryDeductions.map((deduction, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                    <select
                      value={deduction.reason}
                      onChange={e => handleDeductionChange(idx, 'reason', e.target.value)}
                      className="border rounded p-1 text-sm min-w-[120px]"
                      required
                    >
                      <option value="">Select Reason</option>
                      <option value="Advance Repayment">Advance Repayment</option>
                      <option value="Unpaid Leave">Unpaid Leave</option>
                      <option value="Tax Deduction">Tax Deduction</option>
                      <option value="Other">Other</option>
                    </select>
                    {deduction.reason === 'Other' && (
                      <input
                        type="text"
                        value={deduction.otherReason || ''}
                        onChange={e => handleDeductionChange(idx, 'otherReason', e.target.value)}
                        placeholder="Specify reason"
                        className="border rounded p-1 text-sm w-32"
                        required
                      />
                    )}
                    <input
                      type="number"
                      value={deduction.amount}
                      onChange={e => handleDeductionChange(idx, 'amount', e.target.value)}
                      placeholder="Amount"
                      className="border rounded p-1 text-sm w-24"
                      required
                    />
                    <input
                      value={deduction.remark}
                      onChange={e => handleDeductionChange(idx, 'remark', e.target.value)}
                      placeholder="Remark"
                      className="border rounded p-1 text-sm w-32"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeduction(idx)}
                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <h6 className="text-sm font-semibold mb-2 text-gray-700">Payment Summary</h6>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-green-600">Total Earnings:</span>
                  <div className="text-lg font-bold text-green-700">
                    ₹{(fixedSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) + 
                       performanceSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-red-600">Total Deductions:</span>
                  <div className="text-lg font-bold text-red-700">
                    ₹{salaryDeductions.reduce((sum, deduction) => sum + (Number(deduction.amount) || 0), 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-600">Net Amount:</span>
                  <div className="text-lg font-bold text-blue-700">
                    ₹{((fixedSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) + 
                        performanceSalaryRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)) - 
                       salaryDeductions.reduce((sum, deduction) => sum + (Number(deduction.amount) || 0), 0)).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelEditSalaryPayment}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditSalaryPayment}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses; 
