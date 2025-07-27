import React, { useState, useEffect } from 'react';
import InvoiceTemplate from './BillTemplates/InvoiceTemplate';
import ChallanTemplate from './BillTemplates/ChallanTemplate';
import QuotationTemplate from './BillTemplates/QuotationTemplate';
import PurchaseBillTemplate from './BillTemplates/PurchaseBillTemplate';
import PurchaseOrderTemplate from './BillTemplates/PurchaseOrderTemplate';
import ReceiptTemplate from './BillTemplates/ReceiptTemplate';
import PurchaseReceiptTemplate from './BillTemplates/PurchaseReceiptTemplate';
import { doc, onSnapshot } from 'firebase/firestore';

const PAGE_SIZES = [
  { key: 'a4', label: 'A4 (210×297mm)', width: 210, height: 297 },
  { key: 'a5', label: 'A5 (148×210mm)', width: 148, height: 210 },
  { key: 'letter', label: 'Letter (8.5×11in)', width: 216, height: 279 },
];
const ORIENTATIONS = [
  { key: 'portrait', label: 'Portrait' },
  { key: 'landscape', label: 'Landscape' },
];
const TEMPLATES = [
  { key: 'InvoiceTemplate', label: 'Standard Invoice', component: InvoiceTemplate },
  { key: 'ChallanTemplate', label: 'Challan', component: ChallanTemplate },
  { key: 'QuotationTemplate', label: 'Quotation', component: QuotationTemplate },
  { key: 'PurchaseOrderTemplate', label: 'Purchase Order', component: PurchaseOrderTemplate },
  { key: 'PurchaseBillTemplate', label: 'Purchase Bill', component: PurchaseBillTemplate },
  { key: 'ReceiptTemplate', label: 'Payment Receipt', component: ReceiptTemplate },
  { key: 'PurchaseReceiptTemplate', label: 'Purchase Receipt', component: PurchaseReceiptTemplate },
];

const BILL_TYPES = [
  { key: 'invoice', label: 'Invoice', templateKey: 'InvoiceTemplate' },
  { key: 'challan', label: 'Challan', templateKey: 'ChallanTemplate' },
  { key: 'quotation', label: 'Quotation', templateKey: 'QuotationTemplate' },
  { key: 'purchaseOrder', label: 'Purchase Order', templateKey: 'PurchaseOrderTemplate' },
  { key: 'purchaseBill', label: 'Purchase Bill', templateKey: 'PurchaseBillTemplate' },
  { key: 'receipt', label: 'Payment Receipt', templateKey: 'ReceiptTemplate' },
  { key: 'purchaseReceipt', label: 'Purchase Receipt', templateKey: 'PurchaseReceiptTemplate' },
];

// Sample/blurred data for preview
const sampleBill = {
  invoiceNumber: 'XXX-XXX/XXXX',
  date: 'YYYY-MM-DD',
  items: [
    {
      description: 'Sample Item Description',
      hsn: 'XXXX',
      qty: 'XX',
      rate: 'XXX',
      amount: 'XXXX',
      gst: 'XX',
      total: 'XXXX',
    },
    {
      description: 'Sample Item 2',
      hsn: 'XXXX',
      qty: 'XX',
      rate: 'XXX',
      amount: 'XXXX',
      gst: 'XX',
      total: 'XXXX',
    },
  ],
  discountType: 'percent',
  discountValue: 10,
  paymentLink: '',
  totals: {
    taxable: 'XXXX',
    sgst: 'XX',
    cgst: 'XX',
    igst: 'XX',
    grandTotal: 'XXXX',
  },
  gstTable: [
    { percent: 'XX', taxable: 'XXXX', sgst: 'XX', cgst: 'XX', igst: 'XX', total: 'XX' },
  ],
  terms: 'Sample terms and conditions...',
  paymentStatus: 'Unpaid',
  totalPaid: 0,
  remainingDue: 'XXXX',
};
const sampleParty = {
  name: 'XXX Party Name',
  address: 'XXX Address',
  gstin: 'XXGSTINXXXX',
  contact: 'XXXXXXXXXX',
};
const samplePayments = [
  { amount: 'XXXX', date: 'YYYY-MM-DD', mode: 'XXX', notes: 'XXX' },
];
const sampleReceipt = {
  amount: '5000',
  date: '2024-04-10',
  mode: 'UPI',
  reference: 'TXN123456',
  notes: 'Sample payment for invoice',
};

function BillTemplates({ db, userId, isAuthReady, appId }) {
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [selectedTemplates, setSelectedTemplates] = useState({
    invoice: 'InvoiceTemplate',
    challan: 'ChallanTemplate',
    quotation: 'QuotationTemplate',
    purchaseOrder: 'PurchaseOrderTemplate',
    purchaseBill: 'PurchaseBillTemplate',
  });
  const [activeTab, setActiveTab] = useState('invoice');
  const [companyDetails, setCompanyDetails] = useState(null);

  useEffect(() => {
    if (!db || !userId || !isAuthReady || !appId) return;
    const companyDocRef = doc(db, `artifacts/${appId}/users/${userId}/companyDetails`, 'myCompany');
    const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [db, userId, isAuthReady, appId]);

  const renderTemplateSection = (billType) => {
    const TemplateComponent = TEMPLATES.find(t => t.key === selectedTemplates[billType.key])?.component || InvoiceTemplate;
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-center">{billType.label} Template</h2>
        <div className="mb-4 flex flex-wrap gap-4 items-center justify-center">
          <div className="flex gap-2 items-center">
            <label className="font-medium">Template:</label>
            <select
              className="border rounded px-2 py-1"
              value={selectedTemplates[billType.key]}
              onChange={e => setSelectedTemplates(st => ({ ...st, [billType.key]: e.target.value }))}
            >
              {TEMPLATES.filter(t => t.key === billType.templateKey || t.key === 'InvoiceTemplate').map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="font-medium">Page Size:</label>
            <select
              className="border rounded px-2 py-1"
              value={pageSize}
              onChange={e => setPageSize(e.target.value)}
            >
              {PAGE_SIZES.map(size => (
                <option key={size.key} value={size.key}>{size.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="font-medium">Orientation:</label>
            <select
              className="border rounded px-2 py-1"
              value={orientation}
              onChange={e => setOrientation(e.target.value)}
            >
              {ORIENTATIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-center text-xs text-gray-500 mb-2">
          This preview is shown at actual print size (1:1 scale). Set your browser zoom to 100% for best accuracy.
        </div>
        <div className="flex items-start justify-center pb-12">
          <div className="p-4">
            {companyDetails ? (
              <TemplateComponent
                billData={sampleBill}
                companyDetails={{ ...companyDetails, gstinType: companyDetails.gstinType || '' }}
                partyDetails={sampleParty}
                bankDetails={{
                  name: companyDetails.bankName,
                  account: companyDetails.bankAccount,
                  ifsc: companyDetails.bankIfsc,
                  upi: companyDetails.upiId,
                  upiQrUrl: companyDetails.upiQrUrl,
                  paymentGatewayLink: companyDetails.paymentGatewayLink,
                  sealUrl: companyDetails.sealUrl,
                  signUrl: companyDetails.signUrl,
                }}
                payments={samplePayments}
                pageSize={pageSize}
                orientation={orientation}
                previewMode={true}
              />
            ) : (
              <div className="text-gray-400 text-center text-lg mt-12">Loading company details...</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 overflow-auto flex flex-col">
      <h1 className="text-3xl font-bold mb-6 mt-8 text-center">Bill Templates</h1>
      <div className="flex space-x-2 mb-4">
        {BILL_TYPES.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-2 rounded-t font-semibold focus:outline-none ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="max-w-4xl mx-auto w-full">
        {activeTab === 'receipt' ? (
          <div className="p-4 bg-white rounded shadow">
            <ReceiptTemplate
              receipt={sampleReceipt}
              bill={sampleBill}
              company={companyDetails || { firmName: 'Sample Company', address: 'Sample Address', gstin: 'XXGSTINXXXX' }}
              party={sampleParty}
              receiptNumber={'PYR25-26/1'}
            />
          </div>
        ) : activeTab === 'purchaseReceipt' ? (
          <div className="p-4 bg-white rounded shadow">
            <PurchaseReceiptTemplate
              receipt={sampleReceipt}
              bill={sampleBill}
              company={companyDetails || { firmName: 'Sample Company', address: 'Sample Address', gstin: 'XXGSTINXXXX' }}
              party={sampleParty}
              receiptNumber={'PYR25-26/1'}
            />
          </div>
        ) : (
          renderTemplateSection(BILL_TYPES.find(b => b.key === activeTab))
        )}
      </div>
    </div>
  );
}

export default BillTemplates;
