import { doc, collection } from 'firebase/firestore';
import { db } from '../firebase.config';

export const APP_ID = 'acc-app-e5316';

export function getUserRoot(userId) {
  return doc(db, 'artifacts', APP_ID, 'users', userId);
}

// Main Settings document (fixed id 'default') under the user's Settings collection
export function getSettingsDoc(userId) {
  return doc(db, 'artifacts', APP_ID, 'users', userId, 'Settings', 'default');
}

export function getDevicesCollection(userId) {
  // Devices subcollection under the main Settings doc
  return collection(db, 'artifacts', APP_ID, 'users', userId, 'Settings', 'default', 'Devices');
}

export function getSettingsCollection(userId, collectionName) {
  return collection(db, 'artifacts', APP_ID, 'users', userId, 'Settings', 'default', collectionName);
}

export function getSettingsSubDoc(userId, subCollectionName, docId) {
  return doc(db, 'artifacts', APP_ID, 'users', userId, 'Settings', 'default', subCollectionName, docId);
}

// Backoffice namespace
// Backoffice namespace (standardized)
export function getBackofficeAdminDoc(adminUserId) {
  return doc(db, 'artifacts', APP_ID, 'backoffice_admins', adminUserId);
}

export function getBackofficeLogsCollection() {
  return collection(db, 'artifacts', APP_ID, 'backoffice_logs');
}

export function getBackofficeSubscriptionControlDoc(userId) {
  return doc(db, 'artifacts', APP_ID, 'backoffice_subscriptions', userId);
}


