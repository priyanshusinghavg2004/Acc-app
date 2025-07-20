// Utility functions for BillTemplates

export const mmToPx = (mm) => mm * 3.78;

export const patchLayoutRowWidths = (layout, paperW, margin) => {
  const defaultWidth = paperW - (margin.left || 10) - (margin.right || 10);
  return layout.map(row => ({ ...row, width: row.width === undefined ? defaultWidth : row.width }));
}; 