// Simple per-user device manager utilities
// Stores a stable deviceId in localStorage and maintains up to 3 devices per user

import { collection, doc, getDocs, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getDevicesCollection } from './appArtifacts';

const LOCAL_DEVICE_KEY = 'acctoo_device_id';

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(LOCAL_DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(LOCAL_DEVICE_KEY, id);
  }
  return id;
}

export async function listUserDevices(userId) {
  const colRef = getDevicesCollection(userId);
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function registerCurrentDevice(userId, extra = {}) {
  const deviceId = getOrCreateDeviceId();
  const devices = await listUserDevices(userId);
  const exists = devices.find(d => d.id === deviceId);
  if (!exists && devices.length >= 3) {
    return { ok: false, reason: 'limit', devices };
  }
  const deviceDoc = doc(getDevicesCollection(userId), deviceId);
  await setDoc(deviceDoc, {
    platform: extra.platform || 'web',
    token: extra.token || null,
    userAgent: navigator.userAgent,
    createdAt: exists?.createdAt || serverTimestamp(),
    lastSeen: serverTimestamp(),
  }, { merge: true });
  return { ok: true, deviceId };
}

export async function removeDevice(userId, deviceId) {
  const deviceDoc = doc(getDevicesCollection(userId), deviceId);
  await deleteDoc(deviceDoc);
}


