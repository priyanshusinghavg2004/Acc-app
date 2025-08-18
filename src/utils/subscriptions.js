import { 
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export async function getUserSubscription(db, userId) {
  if (!db || !userId) return null;
  const ref = doc(db, 'subscriptions', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate)
  };
}

export function isSubscriptionValid(subscription) {
  if (!subscription) return false;
  if ((subscription.status || '').toLowerCase() === 'canceled') return false;
  const now = Date.now();
  const end = subscription.endDate ? subscription.endDate.getTime() : 0;
  return end > now;
}

export function daysUntilExpiry(subscription) {
  if (!subscription || !subscription.endDate) return null;
  const ms = subscription.endDate.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function startOrRenewSubscription(db, userId, planType = 'basic', durationDays = 30, metadata = {}) {
  const now = new Date();
  const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const ref = doc(db, 'subscriptions', userId);
  let existing = null;
  try {
    const snap = await getDoc(ref);
    existing = snap.exists() ? snap.data() : null;
  } catch {}
  const paymentHistory = Array.isArray(existing?.paymentHistory) ? existing.paymentHistory.slice() : [];
  paymentHistory.push({
    ts: serverTimestamp(),
    planType,
    durationDays,
    meta: metadata || {}
  });
  await setDoc(ref, {
    planType,
    startDate: now,
    endDate: end,
    status: 'active',
    updatedAt: serverTimestamp(),
    paymentHistory
  }, { merge: true });
}


