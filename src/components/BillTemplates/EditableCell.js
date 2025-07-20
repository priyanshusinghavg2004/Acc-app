import React, { useState, useEffect } from "react";

const EditableCell = ({ value, onChange, style }) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  useEffect(() => { setInputValue(value); }, [value]);
  return editing ? (
    <input
      style={{ ...style, minWidth: 0, width: '100%' }}
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      onBlur={() => { setEditing(false); onChange(inputValue); }}
      onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(inputValue); } }}
      autoFocus
    />
  ) : (
    <div
      style={{ ...style, cursor: 'pointer', minHeight: 24, minWidth: 0, width: '100%' }}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || <span style={{ color: '#bbb' }}>Sample</span>}
    </div>
  );
};

export default EditableCell; 