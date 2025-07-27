import React, { useState } from 'react';

const EXPENSE_HEADS = [
  'Rent',
  'Utilities',
  'Salaries & Wages',
  'Employee Benefits',
  'Office Supplies',
  'Telephone & Internet',
  'Travel & Conveyance',
  'Repairs & Maintenance',
  'Professional Fees',
  'Advertising & Marketing',
  'Insurance',
  'Depreciation',
  'Bank Charges',
  'Interest Paid',
  'Printing & Stationery',
  'Postage & Courier',
  'Vehicle Expenses',
  'Licenses & Subscriptions',
  'Training & Development',
  'Miscellaneous Expenses',
];

const Expenses = ({ onSave }) => {
  const [date, setDate] = useState('');
  const [head, setHead] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setReceipt(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!date || !head || !amount) {
      setError('Date, Expense Head, and Amount are required.');
      return;
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    setLoading(true);
    // Simulate save (replace with actual DB logic)
    setTimeout(() => {
      setLoading(false);
      setSuccess('Expense saved successfully!');
      setDate('');
      setHead('');
      setAmount('');
      setDescription('');
      setReceipt(null);
      if (onSave) onSave();
    }, 1000);
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h2 className="text-2xl font-bold mb-4">Expense Entry</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date<span className="text-red-500">*</span></label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded p-2 w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Expense Head<span className="text-red-500">*</span></label>
          <select value={head} onChange={e => setHead(e.target.value)} className="border rounded p-2 w-full" required>
            <option value="">Select Head</option>
            {EXPENSE_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount (₹)<span className="text-red-500">*</span></label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="border rounded p-2 w-full" min="0" step="0.01" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description/Notes</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="border rounded p-2 w-full" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Attach Receipt (optional)</label>
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="border rounded p-2 w-full" />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow" disabled={loading}>
          {loading ? 'Saving...' : 'Save Expense'}
        </button>
      </form>
    </div>
  );
};

export default Expenses; 