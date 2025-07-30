import { doc, updateDoc } from 'firebase/firestore';

/**
 * Get total advance available for a party
 * @param {string} partyId - Party ID
 * @param {Array} payments - All payments array
 * @returns {number} Total advance amount
 */
export const getPartyAdvance = (partyId, payments) => {
  let totalAdvance = 0;
  payments.forEach(payment => {
    if (
      payment.partyId === partyId &&
      payment.remainingAmount > 0 &&
      !payment.advanceRefunded &&
      !payment.advanceFullyUsed
    ) {
      // If advanceUsed is tracked, subtract it
      const used = payment.advanceUsed || 0;
      totalAdvance += (payment.remainingAmount - used);
    }
  });
  return totalAdvance;
};

/**
 * Allocate available advance to a new bill (FIFO: oldest advances first)
 * @param {string} partyId - Party ID
 * @param {number} billAmount - Bill amount
 * @param {Array} payments - All payments array
 * @returns {Object} { allocatedAdvance, advanceAllocations: [{paymentId, amountUsed}], remainingBillAmount }
 */
export const allocateAdvanceToBill = (partyId, billAmount, payments) => {
  // Get all advances for this party, sorted by payment date (oldest first)
  const advances = payments
    .filter(payment => 
      payment.partyId === partyId && 
      payment.remainingAmount > 0 && 
      !payment.advanceRefunded && 
      !payment.advanceFullyUsed
    )
    .sort((a, b) => new Date(a.paymentDate || a.createdAt) - new Date(b.paymentDate || b.createdAt));

  let remaining = billAmount;
  let allocatedAdvance = 0;
  const advanceAllocations = [];

  for (const adv of advances) {
    if (remaining <= 0) break;
    const available = (adv.remainingAmount - (adv.advanceUsed || 0));
    if (available <= 0) continue;
    const use = Math.min(available, remaining);
    advanceAllocations.push({ paymentId: adv.id, amountUsed: use });
    allocatedAdvance += use;
    remaining -= use;
  }

  return { allocatedAdvance, advanceAllocations, remainingBillAmount: remaining };
};

/**
 * Mark advances as used (update payment records with advanceUsed field)
 * @param {Array} allocations - [{paymentId, amountUsed}]
 * @param {Object} db - Firestore database instance
 * @param {string} appId - App ID
 * @param {string} userId - User ID
 */
export const markAdvanceUsed = async (allocations, db, appId, userId, payments) => {
  if (!Array.isArray(allocations)) {
    console.error('allocations is not an array:', allocations);
    return;
  }
  
  for (const alloc of allocations) {
    const payment = payments.find(p => p.id === alloc.paymentId);
    if (!payment) continue;
    const prevUsed = payment.advanceUsed || 0;
    const newUsed = prevUsed + alloc.amountUsed;
    const fullyUsed = (newUsed >= payment.remainingAmount);
    // Update Firestore
    const paymentRef = doc(db, `artifacts/${appId}/users/${userId}/payments`, alloc.paymentId);
    await updateDoc(paymentRef, {
      advanceUsed: newUsed,
      advanceFullyUsed: fullyUsed
    });
  }
};

/**
 * Refund an advance (set advanceRefunded flag)
 * @param {string} paymentId - Payment ID
 * @param {Object} db - Firestore database instance
 * @param {string} appId - App ID
 * @param {string} userId - User ID
 */
export const refundAdvance = async (paymentId, db, appId, userId) => {
  const paymentRef = doc(db, `artifacts/${appId}/users/${userId}/payments`, paymentId);
  await updateDoc(paymentRef, { advanceRefunded: true });
};

/**
 * Get advance details for a party
 * @param {string} partyId - Party ID
 * @param {Array} payments - All payments array
 * @returns {Array} Array of advance payments
 */
export const getAdvanceDetails = (partyId, payments) => {
  return payments.filter(p => 
    p.partyId === partyId && 
    p.remainingAmount > 0 && 
    !p.advanceRefunded && 
    !p.advanceFullyUsed
  );
}; 