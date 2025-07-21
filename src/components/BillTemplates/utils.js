// Utility functions for BillTemplates

export const mmToPx = (mm) => mm * 3.78;

export const patchLayoutRowWidths = (layout, paperW, margin) => {
  const defaultWidth = paperW - (margin.left || 10) - (margin.right || 10);
  return layout.map(row => ({ ...row, width: row.width === undefined ? defaultWidth : row.width }));
};

/**
 * Clean mapping: Maps sales rows and item master data to bill template format.
 * QTY = Nos x (Length || 1) x (Height || 1)
 */
export function mapSalesRowsToBillTemplate(rows, items) {
  return rows.map(row => {
    const itemObj = items.find(it => it.id === row.item) || {};
    const qty = (parseFloat(row.nos) || 0) * (parseFloat(row.length) || 1) * (parseFloat(row.height) || 1);
    return {
      itemDescription: itemObj.itemName || '',
      hsn: itemObj.hsnCode || '',
      qty,
      rate: row.rate,
      amount: row.amount,
      gstPercent: itemObj.gstPercentage || 0,
      sgst: row.sgst || 0,
      cgst: row.cgst || 0,
      igst: row.igst || 0,
      total: row.total,
    };
  });
} 