import React from 'react';
import InvoiceTemplate from './BillTemplates/InvoiceTemplate';
import PurchaseBillTemplate from './BillTemplates/PurchaseBillTemplate';
import ChallanTemplate from './BillTemplates/ChallanTemplate';
import QuotationTemplate from './BillTemplates/QuotationTemplate';
import PurchaseOrderTemplate from './BillTemplates/PurchaseOrderTemplate';
import ReceiptTemplate from './BillTemplates/ReceiptTemplate';

const templateMap = {
  invoice: InvoiceTemplate,
  sales: InvoiceTemplate,
  'sales-invoice': InvoiceTemplate,
  'purchase-bill': PurchaseBillTemplate,
  purchase: PurchaseBillTemplate,
  challan: ChallanTemplate,
  quotation: QuotationTemplate,
  'purchase-order': PurchaseOrderTemplate,
  order: PurchaseOrderTemplate,
};

function getTemplate(type) {
  return templateMap[type] || InvoiceTemplate;
}

function getDocId(doc, type) {
  // Try to get the best id for matching payments
  if (type === 'invoice' || type === 'sales' || type === 'sales-invoice') return doc.id || doc.invoiceNumber || doc.number;
  if (type === 'purchase-bill' || type === 'purchase') return doc.id || doc.purchaseBillNumber || doc.number;
  if (type === 'challan') return doc.id || doc.challanNumber || doc.number;
  if (type === 'quotation') return doc.id || doc.quotationNumber || doc.number;
  if (type === 'purchase-order' || type === 'order') return doc.id || doc.purchaseOrderNumber || doc.number;
  return doc.id || doc.number;
}

const DocumentPreviewWithReceipts = ({
  document,
  type,
  company,
  party,
  bank,
  payments = [],
  onClose,
  show,
}) => {
  if (!show || !document) return null;
  const Template = getTemplate(type);
  const docId = getDocId(document, type);
  // Find payments for this document
  const docPayments = payments.filter(p => p.billId === docId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-full relative overflow-y-auto max-h-[95vh]">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl">&times;</button>
        <h3 className="text-xl font-bold mb-4 text-center">{type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Preview</h3>
        {/* Render main document */}
        <Template
          billData={document}
          companyDetails={company}
          partyDetails={party}
          bankDetails={bank}
        />
        {/* Render Receipts if any */}
        {docPayments.length > 0 && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-2 text-center">Payment Receipt{docPayments.length > 1 ? 's' : ''}</h4>
            {docPayments.map((payment, idx) => (
              <div key={payment.id || idx} className="mb-8 border-t pt-4">
                <ReceiptTemplate
                  receipt={payment}
                  bill={document}
                  company={company}
                  party={party}
                  receiptNumber={payment.receiptNumber || payment.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreviewWithReceipts; 