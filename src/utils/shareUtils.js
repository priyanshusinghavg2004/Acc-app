// Central helpers for share message and software footer

export const SOFTWARE_FOOTER = 'Acctoo.com Lets accounting togeather';

export function buildShareMessage({
  docType,
  docNumber,
  partyName,
  amount,
  companyName,
  phone,
  extra,
}) {
  const parts = [];
  if (docType && docNumber) {
    parts.push(`${docType} ${docNumber}`);
  }
  if (partyName) {
    parts.push(`for ${partyName}`);
  }
  if (amount != null) {
    const amtText = typeof amount === 'number' ? amount.toLocaleString('en-IN') : String(amount);
    parts.push(`of ₹${amtText}`);
  }
  let line1 = parts.join(' ');
  if (line1) line1 += ' has been generated.';
  const line2 = 'Please check the details.';
  const line3 = (companyName || phone)
    ? `For any query, contact ${companyName ? companyName + (phone ? ' - ' : '') : ''}${phone || ''}.`
    : '';
  const extraLine = extra ? String(extra) : '';
  return [line1, line2, line3, extraLine].filter(Boolean).join(' ');
}





