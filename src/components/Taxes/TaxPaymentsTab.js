import React, { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, orderBy, query } from 'firebase/firestore';

const months = [
  { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' }
];

const quarters = [
  { value: 'Q1', label: 'Q1 (Apr-Jun)' },
  { value: 'Q2', label: 'Q2 (Jul-Sep)' },
  { value: 'Q3', label: 'Q3 (Oct-Dec)' },
  { value: 'Q4', label: 'Q4 (Jan-Mar)' }
];

export default function TaxPaymentsTab({ db, userId, appId, financialYear, companyDetails }) {
  const [entries, setEntries] = useState([]);
  const [taxType, setTaxType] = useState('GST');
  const [periodType, setPeriodType] = useState('month');
  const [periodValue, setPeriodValue] = useState('04');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const collPath = `artifacts/${appId}/users/${userId}/taxPayments`;

  const fySuffix = useMemo(() => {
    const yr = financialYear % 100; return `${financialYear}-${(financialYear + 1).toString().slice(-2)}`;
  }, [financialYear]);

  const fetchEntries = async () => {
    const snap = await getDocs(query(collection(db, collPath), orderBy('paymentDate', 'desc')));
    setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchEntries(); }, [db, userId, appId, financialYear]);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, collPath), {
      taxType,
      fy: fySuffix,
      periodType,
      periodValue,
      paymentDate,
      amount: Number(amount||0),
      paymentMode,
      reference,
      notes,
      createdAt: new Date().toISOString()
    });
    setAmount(''); setReference(''); setNotes('');
    fetchEntries();
  };

  const handleDelete = async (id) => { await deleteDoc(doc(db, collPath, id)); fetchEntries(); };

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Tax Payments</h2>
        <div className="text-sm text-gray-600">Financial Year: {fySuffix}</div>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border mb-6">
        <div>
          <label className="block text-sm mb-1">Tax Type</label>
          <select value={taxType} onChange={e=>setTaxType(e.target.value)} className="w-full border rounded px-3 py-2">
            <option>GST</option>
            <option>TDS</option>
            <option>ITR</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Period Type</label>
          <select value={periodType} onChange={e=>setPeriodType(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">{periodType === 'month' ? 'Month' : 'Quarter'}</label>
          {periodType === 'month' ? (
            <select value={periodValue} onChange={e=>setPeriodValue(e.target.value)} className="w-full border rounded px-3 py-2">
              {months.map(m=> (<option key={m.value} value={`${m.value}-${String(financialYear).slice(-2)}`}>{m.label}</option>))}
            </select>
          ) : (
            <select value={periodValue} onChange={e=>setPeriodValue(e.target.value)} className="w-full border rounded px-3 py-2">
              {quarters.map(q=> (<option key={q.value} value={`${q.value}-${String(financialYear).slice(-2)}`}>{q.label}</option>))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Payment Date</label>
          <input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Amount</label>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Payment Mode</label>
          <select value={paymentMode} onChange={e=>setPaymentMode(e.target.value)} className="w-full border rounded px-3 py-2">
            <option>Cash</option>
            <option>UPI</option>
            <option>Cheque/DD</option>
            <option>Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Challan/Reference No</label>
          <input value={reference} onChange={e=>setReference(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Notes</label>
          <input value={notes} onChange={e=>setNotes(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
        </div>
      </form>

      <div className="bg-white rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Tax</th><th className="px-4 py-2 text-left">Period</th><th className="px-4 py-2 text-left">Mode</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Action</th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2">{e.paymentDate}</td>
                <td className="px-4 py-2">{e.taxType}</td>
                <td className="px-4 py-2">{e.periodType === 'month' ? e.periodValue : e.periodValue}</td>
                <td className="px-4 py-2">{e.paymentMode}</td>
                <td className="px-4 py-2 text-right">{Number(e.amount||0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-right"><button onClick={()=>handleDelete(e.id)} className="text-red-600">Delete</button></td>
              </tr>
            ))}
            {entries.length === 0 && (<tr><td className="px-4 py-6 text-gray-500" colSpan={6}>No entries</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}


