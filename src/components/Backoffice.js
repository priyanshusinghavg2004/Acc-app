import React, { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, orderBy, limit as fsLimit, query } from 'firebase/firestore';
import { functionsClient, db } from '../firebase.config';
import { APP_ID } from '../utils/appArtifacts';
import { SystemAdminOnly } from '../utils/usePermissions';

const Sidebar = ({ active, onChange }) => {
  const items = [
    { id: 'admins', label: 'Admins' },
    { id: 'users', label: 'Users' },
    { id: 'plans', label: 'Plans' },
    { id: 'coupons', label: 'Coupons' },
    { id: 'allocations', label: 'Allocations' },
    { id: 'website', label: 'Website' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'logs', label: 'Logs' },
  ];
  return (
    <div className="w-full md:w-64 md:min-h-screen border-r bg-white">
      <div className="p-4 text-xl font-semibold">Backoffice</div>
      <nav className="space-y-1 px-2 pb-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`w-full text-left px-3 py-2 rounded ${active === item.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

const UsersSection = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_listUsers');
      const res = await callable({});
      setUsers(res.data.users || []);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => [u.name, u.email, u.phone, u.companyName].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)));
  }, [users, q]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Users</h3>
        <div className="flex items-center gap-2">
          <input className="border rounded px-3 py-2" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="px-3 py-2 border rounded" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border">Name</th>
              <th className="text-left p-2 border">Email</th>
              <th className="text-left p-2 border">Phone</th>
              <th className="text-left p-2 border">Company</th>
              <th className="text-left p-2 border">Plan</th>
              <th className="text-left p-2 border">Expiry</th>
              <th className="text-left p-2 border">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{u.name || '-'}</td>
                <td className="p-2 border">{u.email || '-'}</td>
                <td className="p-2 border">{u.phone || '-'}</td>
                <td className="p-2 border">{u.companyName || '-'}</td>
                <td className="p-2 border">{u.planType || '-'}</td>
                <td className="p-2 border">{u.subscriptionExpiry || '-'}</td>
                <td className="p-2 border">{u.lastLogin || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PlansSection = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', price: 0, features: [], trial_days: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_listPlans');
      const res = await callable({});
      setPlans(res.data.plans || []);
    } catch (e) {
      alert(e.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_upsertPlan');
      await callable({ id: editing, plan: form });
      setEditing(null);
      setForm({ name: '', price: 0, features: [], trial_days: 0 });
      load();
    } catch (e) {
      alert(e.message || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete plan?')) return;
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_deletePlan');
      await callable({ id });
      load();
    } catch (e) {
      alert(e.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Plans</h3>
        <button className="px-3 py-2 border rounded" onClick={() => { setEditing(null); setForm({ name: '', price: 0, features: [], trial_days: 0 }); }}>New</button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-2 border">Name</th>
            <th className="text-left p-2 border">Price</th>
            <th className="text-left p-2 border">Trial Days</th>
            <th className="text-left p-2 border">Actions</th>
          </tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{p.name}</td>
                <td className="p-2 border">{p.price}</td>
                <td className="p-2 border">{p.trial_days || 0}</td>
                <td className="p-2 border space-x-2">
                  <button className="px-2 py-1 border rounded" onClick={() => { setEditing(p.id); setForm({ name: p.name || '', price: p.price || 0, features: p.features || [], trial_days: p.trial_days || 0 }); }}>Edit</button>
                  <button className="px-2 py-1 border rounded" onClick={() => del(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-white rounded border">
        <div className="font-semibold mb-2">{editing ? 'Edit Plan' : 'New Plan'}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col">Name<input className="border rounded px-2 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="flex flex-col">Price<input className="border rounded px-2 py-2" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
          <label className="flex flex-col">Trial Days<input className="border rounded px-2 py-2" type="number" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })} /></label>
        </div>
        <div className="mt-3"><button className="px-3 py-2 border rounded" onClick={save} disabled={loading}>Save</button></div>
      </div>
    </div>
  );
};

const CouponsSection = () => {
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', discount: 0, valid_until: '', usage_limit: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_listCoupons');
      const res = await callable({});
      setCoupons(res.data.coupons || []);
    } catch (e) {
      alert(e.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_upsertCoupon');
      await callable({ id: editing, coupon: form });
      setEditing(null);
      setForm({ code: '', discount: 0, valid_until: '', usage_limit: 0 });
      load();
    } catch (e) {
      alert(e.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete coupon?')) return;
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_deleteCoupon');
      await callable({ id });
      load();
    } catch (e) {
      alert(e.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Coupons</h3>
        <button className="px-3 py-2 border rounded" onClick={() => { setEditing(null); setForm({ code: '', discount: 0, valid_until: '', usage_limit: 0 }); }}>New</button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-2 border">Code</th>
            <th className="text-left p-2 border">Discount</th>
            <th className="text-left p-2 border">Valid Until</th>
            <th className="text-left p-2 border">Usage Limit</th>
            <th className="text-left p-2 border">Actions</th>
          </tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{c.code}</td>
                <td className="p-2 border">{c.discount}</td>
                <td className="p-2 border">{c.valid_until || '-'}</td>
                <td className="p-2 border">{c.usage_limit || 0}</td>
                <td className="p-2 border space-x-2">
                  <button className="px-2 py-1 border rounded" onClick={() => { setEditing(c.id); setForm({ code: c.code || '', discount: c.discount || 0, valid_until: c.valid_until || '', usage_limit: c.usage_limit || 0 }); }}>Edit</button>
                  <button className="px-2 py-1 border rounded" onClick={() => del(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-white rounded border">
        <div className="font-semibold mb-2">{editing ? 'Edit Coupon' : 'New Coupon'}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col">Code<input className="border rounded px-2 py-2" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="flex flex-col">Discount<input className="border rounded px-2 py-2" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} /></label>
          <label className="flex flex-col">Valid Until<input className="border rounded px-2 py-2" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></label>
          <label className="flex flex-col">Usage Limit<input className="border rounded px-2 py-2" type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: Number(e.target.value) })} /></label>
        </div>
        <div className="mt-3"><button className="px-3 py-2 border rounded" onClick={save} disabled={loading}>Save</button></div>
      </div>
    </div>
  );
};

const AllocationsSection = () => {
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [userId, setUserId] = useState('');
  const [allocation, setAllocation] = useState({ sms_provider: '', payment_gateway: '', branding: '' });

  const load = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_listAllocations');
      const res = await callable({});
      setAllocations(res.data.allocations || []);
    } catch (e) {
      alert(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!userId) { alert('User ID required'); return; }
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_setAllocation');
      await callable({ userId, allocation });
      setUserId('');
      setAllocation({ sms_provider: '', payment_gateway: '', branding: '' });
      load();
    } catch (e) {
      alert(e.message || 'Failed to set allocation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xl font-semibold">Service Allocations</h3>
      <div className="p-4 bg-white rounded border grid gap-2 sm:grid-cols-3">
        <input className="border rounded px-2 py-2" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="SMS Provider" value={allocation.sms_provider} onChange={(e) => setAllocation({ ...allocation, sms_provider: e.target.value })} />
        <input className="border rounded px-2 py-2" placeholder="Payment Gateway" value={allocation.payment_gateway} onChange={(e) => setAllocation({ ...allocation, payment_gateway: e.target.value })} />
        <input className="border rounded px-2 py-2 sm:col-span-2" placeholder="Branding" value={allocation.branding} onChange={(e) => setAllocation({ ...allocation, branding: e.target.value })} />
        <div><button className="px-3 py-2 border rounded" onClick={save} disabled={loading}>Save</button></div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-2 border">User</th>
            <th className="text-left p-2 border">SMS</th>
            <th className="text-left p-2 border">Gateway</th>
            <th className="text-left p-2 border">Branding</th>
          </tr></thead>
          <tbody>
            {allocations.map((a) => (
              <tr key={a.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{a.id}</td>
                <td className="p-2 border">{a.sms_provider || '-'}</td>
                <td className="p-2 border">{a.payment_gateway || '-'}</td>
                <td className="p-2 border">{a.branding || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const WebsiteSection = () => {
  const [loading, setLoading] = useState(false);
  const defaultContent = {
    hero: {
      title: 'Smart Accounting for',
      highlight: ' Modern Business',
      subtitle: "Streamline your business finances with India's most comprehensive accounting software.",
      primaryCtaText: 'Start Free Trial',
      secondaryCtaText: 'Watch Demo'
    },
    pricing: {
      basicPrice: 999,
      trialText: 'After 3 months free trial'
    },
    cta: {
      heading: 'Ready to Transform Your Business?',
      subheading: 'Join thousands of businesses that trust Acctoo.',
      primaryCtaText: 'Start Free Trial',
      secondaryCtaText: 'Schedule Demo'
    },
    featuresGrid: [
      { 
        title: "Smart Dashboard", 
        text: "Real-time overview of sales, receivables, payables and tasks.",
        icon: "chart-bar",
        color: "blue",
        keywords: ["dashboard", "analytics", "real-time", "business overview"],
        metrics: [
          { label: "Sales This Month", value: "₹2,45,000", color: "blue" },
          { label: "Outstanding Receivables", value: "₹1,20,000", color: "green" },
          { label: "Pending Tasks", value: "5", color: "orange" }
        ]
      },
      { 
        title: "Sales & Invoicing", 
        text: "Professional invoices, quotations and challans with auto GST.",
        icon: "document-text",
        color: "green",
        keywords: ["invoicing", "GST", "quotations", "professional"],
        metrics: [
          { label: "Invoice Templates", value: "Professional", color: "green" },
          { label: "GST Calculation", value: "Auto", color: "blue" },
          { label: "Payment Modes", value: "Multiple", color: "purple" }
        ]
      },
      { 
        title: "Purchase Management", 
        text: "POs, bills and vendor tracking with full history.",
        icon: "shopping-bag",
        color: "purple",
        keywords: ["purchase", "vendors", "POs", "bills"],
        metrics: [
          { label: "Purchase Orders", value: "Create & Track", color: "purple" },
          { label: "Vendor Management", value: "Complete", color: "blue" },
          { label: "Bill Tracking", value: "Real-time", color: "green" }
        ]
      },
      { 
        title: "Payment Tracking", 
        text: "Multiple payment modes, receipts and outstanding monitoring.",
        icon: "credit-card",
        color: "orange",
        keywords: ["payments", "receipts", "tracking", "outstanding"],
        metrics: [
          { label: "Payment Modes", value: "Cash, UPI, Bank", color: "orange" },
          { label: "Receipt Generation", value: "Auto", color: "green" },
          { label: "Outstanding Tracking", value: "Real-time", color: "blue" }
        ]
      },
      { 
        title: "Advanced Reports", 
        text: "GST, P&L, Balance Sheet and custom analytics.",
        icon: "chart-pie",
        color: "indigo",
        keywords: ["reports", "GST", "analytics", "financial"],
        metrics: [
          { label: "GST Reports", value: "GSTR-1, GSTR-3B", color: "indigo" },
          { label: "Financial Reports", value: "P&L, Balance Sheet", color: "blue" },
          { label: "Custom Analytics", value: "Advanced", color: "green" }
        ]
      },
      { 
        title: "Party Management", 
        text: "Customers and suppliers with contacts and transactions.",
        icon: "users",
        color: "red",
        keywords: ["customers", "suppliers", "contacts", "relationships"],
        metrics: [
          { label: "Customer Management", value: "Complete", color: "red" },
          { label: "Supplier Tracking", value: "Real-time", color: "blue" },
          { label: "Transaction History", value: "Detailed", color: "green" }
        ]
      }
    ],
    testimonials: [
      { 
        initials: "RK", 
        name: "Rajesh Kumar", 
        company: "Kumar Traders", 
        text: "Acctoo has transformed our accounting process.",
        keywords: ["accounting", "transformation", "small business", "traders"],
        rating: 5,
        color: "blue"
      },
      { 
        initials: "PS", 
        name: "Priya Sharma", 
        company: "Sharma Enterprises", 
        text: "The mobile app is fantastic!",
        keywords: ["mobile app", "fantastic", "enterprises", "on-the-go"],
        rating: 5,
        color: "green"
      },
      { 
        initials: "AP", 
        name: "Amit Patel", 
        company: "Patel Manufacturing", 
        text: "Best accounting software for Indian businesses.",
        keywords: ["best", "Indian businesses", "manufacturing", "accounting software"],
        rating: 5,
        color: "purple"
      }
    ],
    faq: [
      { 
        q: "How does the free trial work?", 
        a: "3‑month free trial with full access, no credit card.",
        keywords: ["free trial", "no credit card", "full access", "3 months"]
      },
      { 
        q: "What happens after the trial ends?", 
        a: "₹999/year for Basic; upgrade anytime.",
        keywords: ["pricing", "upgrade", "subscription", "basic plan"]
      },
      { 
        q: "Is my data secure?", 
        a: "Bank‑level encryption, secure cloud, regular backups.",
        keywords: ["security", "encryption", "backups", "data protection"]
      }
    ],
    footer: {
      about: "Smart accounting software designed for Indian businesses.",
      keywords: ["accounting software", "Indian businesses", "smart", "designed"]
    }
  };
  const [content, setContent] = useState(defaultContent);
  const [mode, setMode] = useState('form'); // 'form' | 'json'
  const [activeTab, setActiveTab] = useState('hero');

  const load = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_getWebsiteContent');
      const res = await callable({});
      const loaded = res.data.content || {};
      setContent({ ...defaultContent, ...loaded, 
        hero: { ...defaultContent.hero, ...(loaded.hero || {}) }, 
        pricing: { ...defaultContent.pricing, ...(loaded.pricing || {}) }, 
        cta: { ...defaultContent.cta, ...(loaded.cta || {}) },
        featuresGrid: loaded.featuresGrid || defaultContent.featuresGrid,
        testimonials: loaded.testimonials || defaultContent.testimonials,
        faq: loaded.faq || defaultContent.faq
      });
    } catch (e) {
      alert(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_updateWebsiteContent');
      await callable({ content });
      alert('Saved');
    } catch (e) {
      alert(e.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const updateFeature = (index, field, value) => {
    const newFeatures = [...content.featuresGrid];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setContent({ ...content, featuresGrid: newFeatures });
  };

  const updateTestimonial = (index, field, value) => {
    const newTestimonials = [...content.testimonials];
    newTestimonials[index] = { ...newTestimonials[index], [field]: value };
    setContent({ ...content, testimonials: newTestimonials });
  };

  const updateFAQ = (index, field, value) => {
    const newFAQ = [...content.faq];
    newFAQ[index] = { ...newFAQ[index], [field]: value };
    setContent({ ...content, faq: newFAQ });
  };

  const addFeature = () => {
    const newFeature = {
      title: "New Feature",
      text: "Feature description",
      icon: "star",
      color: "blue",
      keywords: ["new", "feature"],
      metrics: []
    };
    setContent({ ...content, featuresGrid: [...content.featuresGrid, newFeature] });
  };

  const addTestimonial = () => {
    const newTestimonial = {
      initials: "NT",
      name: "New Customer",
      company: "New Company",
      text: "Great testimonial text",
      keywords: ["new", "customer", "testimonial"],
      rating: 5,
      color: "blue"
    };
    setContent({ ...content, testimonials: [...content.testimonials, newTestimonial] });
  };

  const addFAQ = () => {
    const newFAQ = {
      q: "New Question?",
      a: "New Answer",
      keywords: ["new", "question", "answer"]
    };
    setContent({ ...content, faq: [...content.faq, newFAQ] });
  };

  const removeFeature = (index) => {
    const newFeatures = content.featuresGrid.filter((_, i) => i !== index);
    setContent({ ...content, featuresGrid: newFeatures });
  };

  const removeTestimonial = (index) => {
    const newTestimonials = content.testimonials.filter((_, i) => i !== index);
    setContent({ ...content, testimonials: newTestimonials });
  };

  const removeFAQ = (index) => {
    const newFAQ = content.faq.filter((_, i) => i !== index);
    setContent({ ...content, faq: newFAQ });
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xl font-semibold">Website Content Editor</h3>
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-2 border rounded ${mode === 'form' ? 'bg-gray-100' : ''}`} onClick={() => setMode('form')}>Simple Forms</button>
        <button className={`px-3 py-2 border rounded ${mode === 'json' ? 'bg-gray-100' : ''}`} onClick={() => setMode('json')}>Advanced JSON</button>
      </div>

      {mode === 'form' ? (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 border-b">
            {['hero', 'pricing', 'cta', 'features', 'testimonials', 'faq', 'footer'].map(tab => (
              <button
                key={tab}
                className={`px-4 py-2 border rounded-t ${activeTab === tab ? 'bg-blue-100 border-blue-300' : 'bg-white'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Hero Section */}
          {activeTab === 'hero' && (
            <div className="p-4 bg-white rounded border">
              <div className="font-semibold mb-4 text-lg">Hero Section</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Title</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.hero.title} 
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, title: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Highlight Text</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.hero.highlight} 
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, highlight: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col sm:col-span-2">
                  <span className="text-sm font-medium mb-1">Subtitle</span>
                  <textarea 
                    className="border rounded px-3 py-2" 
                    rows={2}
                    value={content.hero.subtitle} 
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, subtitle: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Primary Button Text</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.hero.primaryCtaText} 
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, primaryCtaText: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Secondary Button Text</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.hero.secondaryCtaText} 
                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, secondaryCtaText: e.target.value } })} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Pricing Section */}
          {activeTab === 'pricing' && (
            <div className="p-4 bg-white rounded border">
              <div className="font-semibold mb-4 text-lg">Pricing (Basic Plan)</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Price (₹/year)</span>
                  <input 
                    type="number" 
                    className="border rounded px-3 py-2" 
                    value={content.pricing.basicPrice} 
                    onChange={(e) => setContent({ ...content, pricing: { ...content.pricing, basicPrice: Number(e.target.value) } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Trial Text</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.pricing.trialText} 
                    onChange={(e) => setContent({ ...content, pricing: { ...content.pricing, trialText: e.target.value } })} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* CTA Section */}
          {activeTab === 'cta' && (
            <div className="p-4 bg-white rounded border">
              <div className="font-semibold mb-4 text-lg">Call to Action Section</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Heading</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.cta.heading} 
                    onChange={(e) => setContent({ ...content, cta: { ...content.cta, heading: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Subheading</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.cta.subheading} 
                    onChange={(e) => setContent({ ...content, cta: { ...content.cta, subheading: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Primary Button Text</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.cta.primaryCtaText} 
                    onChange={(e) => setContent({ ...content, cta: { ...content.cta, primaryCtaText: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Secondary Button Text</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.cta.secondaryCtaText} 
                    onChange={(e) => setContent({ ...content, cta: { ...content.cta, secondaryCtaText: e.target.value } })} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Features Section */}
          {activeTab === 'features' && (
            <div className="p-4 bg-white rounded border">
              <div className="flex justify-between items-center mb-4">
                <div className="font-semibold text-lg">Feature Cards</div>
                <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={addFeature}>
                  + Add Feature
                </button>
              </div>
              <div className="space-y-4">
                {content.featuresGrid.map((feature, index) => (
                  <div key={index} className="border rounded p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">Feature {index + 1}</h4>
                      <button 
                        className="text-red-600 hover:text-red-800" 
                        onClick={() => removeFeature(index)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Title</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={feature.title} 
                          onChange={(e) => updateFeature(index, 'title', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Icon</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={feature.icon} 
                          onChange={(e) => updateFeature(index, 'icon', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Color</span>
                        <select 
                          className="border rounded px-3 py-2" 
                          value={feature.color} 
                          onChange={(e) => updateFeature(index, 'color', e.target.value)}
                        >
                          {['blue', 'green', 'purple', 'orange', 'indigo', 'red', 'pink', 'yellow'].map(color => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Keywords (comma separated)</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={feature.keywords.join(', ')} 
                          onChange={(e) => updateFeature(index, 'keywords', e.target.value.split(',').map(k => k.trim()))} 
                        />
                      </label>
                      <label className="flex flex-col sm:col-span-2">
                        <span className="text-sm font-medium mb-1">Description</span>
                        <textarea 
                          className="border rounded px-3 py-2" 
                          rows={2}
                          value={feature.text} 
                          onChange={(e) => updateFeature(index, 'text', e.target.value)} 
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Testimonials Section */}
          {activeTab === 'testimonials' && (
            <div className="p-4 bg-white rounded border">
              <div className="flex justify-between items-center mb-4">
                <div className="font-semibold text-lg">Customer Testimonials</div>
                <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={addTestimonial}>
                  + Add Testimonial
                </button>
              </div>
              <div className="space-y-4">
                {content.testimonials.map((testimonial, index) => (
                  <div key={index} className="border rounded p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">Testimonial {index + 1}</h4>
                      <button 
                        className="text-red-600 hover:text-red-800" 
                        onClick={() => removeTestimonial(index)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Initials</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={testimonial.initials} 
                          onChange={(e) => updateTestimonial(index, 'initials', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Name</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={testimonial.name} 
                          onChange={(e) => updateTestimonial(index, 'name', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Company</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={testimonial.company} 
                          onChange={(e) => updateTestimonial(index, 'company', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Color</span>
                        <select 
                          className="border rounded px-3 py-2" 
                          value={testimonial.color} 
                          onChange={(e) => updateTestimonial(index, 'color', e.target.value)}
                        >
                          {['blue', 'green', 'purple', 'orange', 'indigo', 'red', 'pink', 'yellow'].map(color => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Rating</span>
                        <select 
                          className="border rounded px-3 py-2" 
                          value={testimonial.rating} 
                          onChange={(e) => updateTestimonial(index, 'rating', Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map(rating => (
                            <option key={rating} value={rating}>{rating} stars</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Keywords (comma separated)</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={testimonial.keywords.join(', ')} 
                          onChange={(e) => updateTestimonial(index, 'keywords', e.target.value.split(',').map(k => k.trim()))} 
                        />
                      </label>
                      <label className="flex flex-col sm:col-span-2">
                        <span className="text-sm font-medium mb-1">Testimonial Text</span>
                        <textarea 
                          className="border rounded px-3 py-2" 
                          rows={2}
                          value={testimonial.text} 
                          onChange={(e) => updateTestimonial(index, 'text', e.target.value)} 
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ Section */}
          {activeTab === 'faq' && (
            <div className="p-4 bg-white rounded border">
              <div className="flex justify-between items-center mb-4">
                <div className="font-semibold text-lg">Frequently Asked Questions</div>
                <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={addFAQ}>
                  + Add FAQ
                </button>
              </div>
              <div className="space-y-4">
                {content.faq.map((item, index) => (
                  <div key={index} className="border rounded p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">FAQ {index + 1}</h4>
                      <button 
                        className="text-red-600 hover:text-red-800" 
                        onClick={() => removeFAQ(index)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3">
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Question</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={item.q} 
                          onChange={(e) => updateFAQ(index, 'q', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Answer</span>
                        <textarea 
                          className="border rounded px-3 py-2" 
                          rows={2}
                          value={item.a} 
                          onChange={(e) => updateFAQ(index, 'a', e.target.value)} 
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-sm font-medium mb-1">Keywords (comma separated)</span>
                        <input 
                          className="border rounded px-3 py-2" 
                          value={item.keywords.join(', ')} 
                          onChange={(e) => updateFAQ(index, 'keywords', e.target.value.split(',').map(k => k.trim()))} 
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Section */}
          {activeTab === 'footer' && (
            <div className="p-4 bg-white rounded border">
              <div className="font-semibold mb-4 text-lg">Footer</div>
              <div className="space-y-4">
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">About Text</span>
                  <textarea 
                    className="border rounded px-3 py-2" 
                    rows={2}
                    value={content.footer.about} 
                    onChange={(e) => setContent({ ...content, footer: { ...content.footer, about: e.target.value } })} 
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-medium mb-1">Keywords (comma separated)</span>
                  <input 
                    className="border rounded px-3 py-2" 
                    value={content.footer.keywords.join(', ')} 
                    onChange={(e) => setContent({ ...content, footer: { ...content.footer, keywords: e.target.value.split(',').map(k => k.trim()) } })} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700" onClick={save} disabled={loading}>
              {loading ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-white rounded border">
          <label className="block text-sm text-gray-600 mb-2">Advanced JSON Editor</label>
          <textarea 
            className="w-full border rounded px-3 py-2" 
            rows={20} 
            value={JSON.stringify(content, null, 2)} 
            onChange={(e) => {
              try { setContent(JSON.parse(e.target.value)); } catch (_) { /* ignore */ }
            }} 
          />
          <div className="mt-3">
            <button className="px-3 py-2 border rounded" onClick={save} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LogsSection = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const ref = collection(db, 'artifacts', APP_ID, 'backoffice_logs');
    const q = query(ref, orderBy('timestamp', 'desc'), fsLimit(100));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xl font-semibold">Admin Logs</h3>
      {loading && <div>Loading...</div>}
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-2 border">Time</th>
            <th className="text-left p-2 border">Module</th>
            <th className="text-left p-2 border">Action</th>
            <th className="text-left p-2 border">User</th>
            <th className="text-left p-2 border">Admin</th>
            <th className="text-left p-2 border">Details</th>
          </tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{e.timestamp}</td>
                <td className="p-2 border">{e.module}</td>
                <td className="p-2 border">{e.action}</td>
                <td className="p-2 border">{e.userId || '-'}</td>
                <td className="p-2 border">{e.adminUid || '-'}</td>
                <td className="p-2 border text-xs whitespace-pre-wrap">{e.details ? JSON.stringify(e.details) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SubscriptionsSection = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [extendDays, setExtendDays] = useState(30);
  const [newPlan, setNewPlan] = useState('Basic');

  useEffect(() => {
    const ref = collection(db, 'artifacts', APP_ID, 'backoffice_subscriptions');
    const q = query(ref, orderBy('endDate', 'desc'), fsLimit(200));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const extend = async (uid) => {
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_extendSubscription');
      await callable({ uid, days: Number(extendDays) });
      alert('Extended');
    } catch (e) {
      alert(e.message || 'Failed');
    }
  };
  const updatePlan = async (uid) => {
    try {
      const callable = httpsCallable(functionsClient, 'backoffice_updateSubscription');
      await callable({ uid, planType: newPlan });
      alert('Updated');
    } catch (e) {
      alert(e.message || 'Failed');
    }
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xl font-semibold">Subscriptions</h3>
      <div className="flex items-center gap-2">
        <label>Extend Days<input className="border rounded px-2 py-1 ml-2 w-24" type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} /></label>
        <label>Plan<select className="border rounded px-2 py-1 ml-2" value={newPlan} onChange={(e) => setNewPlan(e.target.value)}><option>Trial</option><option>Basic</option><option>Premium</option></select></label>
      </div>
      {loading && <div>Loading...</div>}
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-2 border">User</th>
            <th className="text-left p-2 border">Plan</th>
            <th className="text-left p-2 border">End</th>
            <th className="text-left p-2 border">Actions</th>
          </tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{s.id}</td>
                <td className="p-2 border">{s.planType || '-'}</td>
                <td className="p-2 border">{s.endDate || '-'}</td>
                <td className="p-2 border space-x-2">
                  <button className="px-2 py-1 border rounded" onClick={() => extend(s.id)}>Extend</button>
                  <button className="px-2 py-1 border rounded" onClick={() => updatePlan(s.id)}>Update Plan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminsSection = () => {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('superAdmin');

  useEffect(() => {
    const ref = collection(db, 'artifacts', APP_ID, 'backoffice_admins');
    const unsub = onSnapshot(ref, (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const add = async () => {
    if (!uid) { alert('UID required'); return; }
    try {
      setLoading(true);
      const callable = httpsCallable(functionsClient, 'backoffice_addAdmin');
      await callable({ uid, role, name: name || null, email: email || null });
      setUid(''); setName(''); setEmail(''); setRole('superAdmin');
    } catch (e) {
      alert(e.message || 'Failed to add');
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove admin?')) return;
    try {
      setLoading(true);
      const callable = httpsCallable(functionsClient, 'backoffice_removeAdmin');
      await callable({ uid: id });
    } catch (e) {
      alert(e.message || 'Failed to remove');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xl font-semibold">Admins</h3>
      <div className="p-4 bg-white rounded border grid gap-2 sm:grid-cols-4">
        <input className="border rounded px-2 py-2" placeholder="Auth UID" value={uid} onChange={(e) => setUid(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded px-2 py-2" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="border rounded px-2 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="superAdmin">superAdmin</option>
          <option value="supportAdmin">supportAdmin</option>
          <option value="readOnlyAdmin">readOnlyAdmin</option>
        </select>
        <div className="sm:col-span-4"><button className="px-3 py-2 border rounded" onClick={add} disabled={loading}>Add Admin</button></div>
      </div>
      {loading && <div>Loading...</div>}
      <div className="overflow-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-2 border">UID</th>
            <th className="text-left p-2 border">Name</th>
            <th className="text-left p-2 border">Email</th>
            <th className="text-left p-2 border">Role</th>
            <th className="text-left p-2 border">Actions</th>
          </tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{a.id}</td>
                <td className="p-2 border">{a.name || '-'}</td>
                <td className="p-2 border">{a.email || '-'}</td>
                <td className="p-2 border">{a.role || '-'}</td>
                <td className="p-2 border">
                  <button className="px-2 py-1 border rounded" onClick={() => remove(a.id)} disabled={loading}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BackofficeContent = () => {
  const [active, setActive] = useState('users');
  return (
    <div className="flex flex-col md:flex-row">
      <Sidebar active={active} onChange={setActive} />
      <div className="flex-1 min-h-screen bg-gray-50">
        {active === 'admins' && <AdminsSection />}
        {active === 'users' && <UsersSection />}
        {active === 'plans' && <PlansSection />}
        {active === 'coupons' && <CouponsSection />}
        {active === 'allocations' && <AllocationsSection />}
        {active === 'website' && <WebsiteSection />}
        {active === 'subscriptions' && <SubscriptionsSection />}
        {active === 'logs' && <LogsSection />}
      </div>
    </div>
  );
};

const Backoffice = () => {
  return (
    <SystemAdminOnly>
      <BackofficeContent />
    </SystemAdminOnly>
  );
};

export default Backoffice;


