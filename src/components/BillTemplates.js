import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import QRCode from 'react-qr-code';

// --- Bill blocks ---
const BLOCKS = [
  { id: 'company', label: 'Company Info' },
  { id: 'buyer', label: 'Buyer Info' },
  { id: 'items', label: 'Items Table' },
  { id: 'bank', label: 'Bank Details' },
  { id: 'qr', label: 'QR Code' },
  { id: 'payment', label: 'Payment Link' },
  { id: 'signature', label: 'Signature' },
  { id: 'notes', label: 'Notes' },
];

// --- Block renderers ---
function BlockPreview({ block }) {
  switch (block.id) {
    case 'company':
      return <div><b>Company Name</b><br />Address, GSTIN, Contact, etc.</div>;
    case 'buyer':
      return <div><b>Buyer Name</b><br />Address, GSTIN, State, etc.</div>;
    case 'items':
      return <div><b>Items Table</b><br />[Item rows with area/combined logic]</div>;
    case 'bank':
      return <div><b>Bank Details</b><br />Bank Name, Account, IFSC, UPI</div>;
    case 'qr':
      return <div><b>QR Code</b><br /><QRCode value="upi://pay?pa=yourid@upi" size={48} /></div>;
    case 'payment':
      return <div><b>Payment Link</b><br /><a href="#">https://pay.example.com/xyz</a></div>;
    case 'signature':
      return <div><b>Signature</b><br />[Authorised Signatory]</div>;
    case 'notes':
      return <div><b>Notes</b><br />Terms, declaration, etc.</div>;
    default:
      return null;
  }
}

// --- Drag-and-drop designer ---
const initialLayout = ['company', 'buyer', 'items', 'bank', 'qr', 'payment', 'signature', 'notes'];

const BillTemplates = () => {
  const [layout, setLayout] = useState(initialLayout);

  function onDragEnd(result) {
    if (!result.destination) return;
    const newLayout = Array.from(layout);
    const [removed] = newLayout.splice(result.source.index, 1);
    newLayout.splice(result.destination.index, 0, removed);
    setLayout(newLayout);
  }

  return (
    <div className="flex gap-8 p-6 bg-white rounded-lg shadow-md min-h-[600px]">
      {/* Block Library */}
      <div className="w-48">
        <h3 className="font-bold mb-2">Blocks</h3>
        <div className="flex flex-col gap-2">
          {BLOCKS.map(block => (
            <div key={block.id} className="border rounded p-2 bg-gray-50 text-sm text-gray-700">
              {block.label}
            </div>
          ))}
        </div>
      </div>
      {/* Drag-and-drop A4 Preview */}
      <div className="flex-1 flex flex-col items-center">
        <h3 className="font-bold mb-2">A4 Bill Preview (Drag to Reorder)</h3>
        <div style={{ width: '186mm', minHeight: '273mm', maxHeight: '273mm', background: '#f9fafb', border: '1px solid #bbb', margin: '0 auto', boxSizing: 'border-box', padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="bill-layout">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {layout.map((blockId, idx) => {
                    const block = BLOCKS.find(b => b.id === blockId);
                    return (
                      <Draggable key={blockId} draggableId={blockId} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`border rounded bg-white p-4 mb-2 shadow-sm ${snapshot.isDragging ? 'ring-2 ring-blue-400' : ''}`}
                            style={{ marginBottom: 8, ...provided.draggableProps.style }}
                          >
                            <div className="font-semibold text-blue-700 mb-1">{block.label}</div>
                            <BlockPreview block={block} />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
};

export default BillTemplates; 