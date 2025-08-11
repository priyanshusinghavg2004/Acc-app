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
      const available = payment.remainingAmount - used;
      totalAdvance += available;
    }
  });
  return totalAdvance;
};

/**
 * Check if a payment is an advance payment
 * @param {Object} payment - Payment object
 * @returns {boolean} True if it's an advance payment
 */
export const isAdvancePayment = (payment) => {
  // A payment is considered advance if:
  // 1. No specific bill reference
  // 2. Has remaining amount available for advance
  // 3. Payment type is 'khata' or 'advance' or undefined
  // 4. Not fully used or refunded
  const hasRemainingAdvance = (payment.remainingAmount - (payment.advanceUsed || 0)) > 0;
  const isNotFullyUsed = !payment.advanceFullyUsed && !payment.advanceRefunded;
  const validPaymentType = payment.paymentType === 'khata' || payment.paymentType === 'advance' || !payment.paymentType;
  
  return !payment.billReference && 
         hasRemainingAdvance &&
         isNotFullyUsed &&
         validPaymentType;
};

/**
 * Allocate available advance to a new bill (FIFO: oldest advances first)
 * @param {string} partyId - Party ID
 * @param {number} billAmount - Bill amount
 * @param {Array} payments - All payments array
 * @returns {Object} { allocatedAdvance, advanceAllocations: [{paymentId, amountUsed}], remainingBillAmount }
 */
export const allocateAdvanceToBill = (partyId, billAmount, payments) => {
  console.log(`allocateAdvanceToBill: partyId=${partyId}, billAmount=${billAmount}`);
  
  // Get all advances for this party, sorted by payment date (oldest first)
  const advances = payments
    .filter(payment => 
      payment.partyId === partyId && 
      payment.remainingAmount > 0 && 
      !payment.advanceRefunded && 
      !payment.advanceFullyUsed &&
      isAdvancePayment(payment)
    )
    .sort((a, b) => new Date(a.paymentDate || a.createdAt) - new Date(b.paymentDate || b.createdAt));

  console.log(`Found ${advances.length} advance payments for allocation`);

  let remaining = billAmount;
  let allocatedAdvance = 0;
  const advanceAllocations = [];

  for (const adv of advances) {
    if (remaining <= 0) break;
    
    const available = (adv.remainingAmount - (adv.advanceUsed || 0));
    if (available <= 0) {
      console.log(`Advance ${adv.id} has no available amount`);
      continue;
    }
    
    const use = Math.min(available, remaining);
    console.log(`Allocating ₹${use} from advance ${adv.id} (available: ₹${available}, remaining: ₹${remaining})`);
    
    advanceAllocations.push({ paymentId: adv.id, amountUsed: use });
    allocatedAdvance += use;
    remaining -= use;
  }

  console.log(`Total advance allocated: ₹${allocatedAdvance}, remaining bill amount: ₹${remaining}`);
  return { allocatedAdvance, advanceAllocations, remainingBillAmount: remaining };
};

/**
 * Mark advances as used (update payment records with advanceUsed field)
 * @param {Array} allocations - [{paymentId, amountUsed}]
 * @param {Object} db - Firestore database instance
 * @param {string} appId - App ID
 * @param {string} userId
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
    !p.advanceFullyUsed &&
    isAdvancePayment(p)
  );
};

/**
 * Apply advance payments to outstanding bills chronologically
 * @param {string} partyId - Party ID
 * @param {Array} bills - Outstanding bills array
 * @param {Array} payments - All payments array
 * @returns {Object} { totalApplied, remainingAdvance, allocations }
 */
export const applyAdvanceToBills = (partyId, bills, payments) => {
  console.log(`applyAdvanceToBills: partyId=${partyId}, bills=${bills.length}, payments=${payments.length}`);
  
  // Get all advance payments for this party
  const advancePayments = payments
    .filter(payment => 
      payment.partyId === partyId && 
      isAdvancePayment(payment) &&
      payment.remainingAmount > 0 && 
      !payment.advanceRefunded && 
      !payment.advanceFullyUsed
    )
    .sort((a, b) => new Date(a.paymentDate || a.createdAt) - new Date(b.paymentDate || b.createdAt));

  console.log(`Found ${advancePayments.length} advance payments for party ${partyId}`);

  // Sort bills by date (oldest first)
  const sortedBills = [...bills].sort((a, b) => 
    new Date(a.date || a.invoiceDate || a.challanDate || a.billDate) - 
    new Date(b.date || b.invoiceDate || b.challanDate || b.billDate)
  );

  let totalApplied = 0;
  let remainingAdvance = 0;
  const allocations = [];

  // Apply each advance payment to bills chronologically
  for (const advancePayment of advancePayments) {
    const availableAdvance = advancePayment.remainingAmount - (advancePayment.advanceUsed || 0);
    if (availableAdvance <= 0) {
      console.log(`Advance payment ${advancePayment.id} has no available amount`);
      continue;
    }

    console.log(`Processing advance payment ${advancePayment.id}: available=${availableAdvance}`);

    let advanceToApply = availableAdvance;

    for (const bill of sortedBills) {
      if (advanceToApply <= 0) break;

      const billOutstanding = bill.outstanding || 0;
      if (billOutstanding <= 0) {
        console.log(`Bill ${bill.id} has no outstanding amount`);
        continue;
      }

      const amountToApply = Math.min(advanceToApply, billOutstanding);
      
      if (amountToApply > 0) {
        console.log(`Applying ₹${amountToApply} from advance ${advancePayment.id} to bill ${bill.id}`);
        
        allocations.push({
          advancePaymentId: advancePayment.id,
          billId: bill.id,
          billNumber: bill.number || bill.invoiceNumber || bill.challanNumber || bill.billNumber,
          amountApplied: amountToApply,
          billOutstanding: billOutstanding
        });

        totalApplied += amountToApply;
        advanceToApply -= amountToApply;
        
        // Update bill outstanding for subsequent calculations
        bill.outstanding = Math.max(0, bill.outstanding - amountToApply);
      }
    }

    // Add remaining advance to total
    remainingAdvance += advanceToApply;
    console.log(`Advance payment ${advancePayment.id}: applied=${availableAdvance - advanceToApply}, remaining=${advanceToApply}`);
  }

  console.log(`Total advance applied: ₹${totalApplied}, remaining advance: ₹${remainingAdvance}`);
  return { totalApplied, remainingAdvance, allocations };
}; 