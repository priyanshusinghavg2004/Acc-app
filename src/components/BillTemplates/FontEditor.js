import React from "react";

const FontEditor = ({ open, block, pos, fontSettings, setFontSettings, headerMainHead, setHeaderMainHead, headerMainHeadOther, setHeaderMainHeadOther, onClose }) => {
  if (!open || !block) return null;
  // TODO: Move the full font editor UI and logic here from BillTemplates.js
  return (
    <div style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: 1000, background: "#fff", border: "1px solid #ccc", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", padding: 16, minWidth: 260, maxWidth: 420 }}>
      <div className="font-semibold mb-2 capitalize">Edit Font: {block.replace(/([A-Z])/g, ' $1')}</div>
      {/* TODO: Add the rest of the font editor UI here */}
      <button className="mt-3 px-3 py-1 bg-blue-600 text-white rounded text-xs" onClick={onClose}>Close</button>
    </div>
  );
};

export default FontEditor; 