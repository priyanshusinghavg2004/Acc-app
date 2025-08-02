import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  query,
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase.config';
import offlineStorage from './offlineStorage';

class OfflineSync {
  constructor() {
    this.isSyncing = false;
    this.syncQueue = [];
  }

  // Add item to sync queue
  async addToSyncQueue(action) {
    try {
      await offlineStorage.addToSyncQueue({
        ...action,
        timestamp: Date.now(),
        retryCount: 0
      });
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  // Process sync queue
  async processSyncQueue() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      const queue = await offlineStorage.getSyncQueue();
      const pendingItems = queue.filter(item => item.status === 'pending');
      
      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item);
          await offlineStorage.removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Error processing sync item:', error);
          await this.handleSyncError(item, error);
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Process individual sync item
  async processSyncItem(item) {
    const { type, storeName, data, userId, appId } = item;
    
    switch (type) {
      case 'add':
        await this.syncAdd(storeName, data, userId, appId);
        break;
      case 'update':
        await this.syncUpdate(storeName, data, userId, appId);
        break;
      case 'delete':
        await this.syncDelete(storeName, data, userId, appId);
        break;
      default:
        throw new Error(`Unknown sync type: ${type}`);
    }
  }

  // Sync add operation
  async syncAdd(storeName, data, userId, appId) {
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${storeName}`);
    
    // Remove local-only fields
    const { localId, ...firebaseData } = data;
    
    await setDoc(doc(collectionRef, data.id), {
      ...firebaseData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Sync update operation
  async syncUpdate(storeName, data, userId, appId) {
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/${storeName}/${data.id}`);
    
    const { localId, id, ...updateData } = data;
    
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  }

  // Sync delete operation
  async syncDelete(storeName, data, userId, appId) {
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/${storeName}/${data.id}`);
    await deleteDoc(docRef);
  }

  // Handle sync errors
  async handleSyncError(item, error) {
    const maxRetries = 3;
    
    if (item.retryCount < maxRetries) {
      // Increment retry count and update status
      item.retryCount += 1;
      item.status = 'retry';
      item.lastError = error.message;
      item.lastAttempt = Date.now();
      
      await offlineStorage.update('syncQueue', item);
    } else {
      // Mark as failed after max retries
      item.status = 'failed';
      item.lastError = error.message;
      item.lastAttempt = Date.now();
      
      await offlineStorage.update('syncQueue', item);
    }
  }

  // Sync all local data with Firebase
  async syncAllData(userId, appId) {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      // Sync parties
      await this.syncCollection('parties', userId, appId);
      
      // Sync sales
      await this.syncCollection('sales', userId, appId);
      
      // Sync purchases
      await this.syncCollection('purchases', userId, appId);
      
      // Sync payments
      await this.syncCollection('payments', userId, appId);
      
      // Sync items
      await this.syncCollection('items', userId, appId);
      
      // Process any pending sync queue items
      await this.processSyncQueue();
      
    } catch (error) {
      console.error('Error syncing all data:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync a specific collection
  async syncCollection(collectionName, userId, appId) {
    try {
      // Get Firebase data
      const firebaseData = await this.getFirebaseData(collectionName, userId, appId);
      
      // Get local data
      const localData = await offlineStorage.getAll(collectionName);
      
      // Update local storage with Firebase data
      for (const item of firebaseData) {
        await offlineStorage.update(collectionName, item);
      }
      
      // Add local-only items to sync queue
      for (const item of localData) {
        const firebaseItem = firebaseData.find(fbItem => fbItem.id === item.id);
        if (!firebaseItem) {
          await this.addToSyncQueue({
            type: 'add',
            storeName: collectionName,
            data: item,
            userId,
            appId
          });
        }
      }
      
    } catch (error) {
      console.error(`Error syncing ${collectionName}:`, error);
      throw error;
    }
  }

  // Get data from Firebase
  async getFirebaseData(collectionName, userId, appId) {
    try {
      const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
      const snapshot = await getDocs(collectionRef);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error getting Firebase data for ${collectionName}:`, error);
      return [];
    }
  }

  // Check if there are pending sync items
  async hasPendingSync() {
    try {
      const queue = await offlineStorage.getSyncQueue();
      return queue.some(item => item.status === 'pending' || item.status === 'retry');
    } catch (error) {
      console.error('Error checking pending sync:', error);
      return false;
    }
  }

  // Get sync status
  async getSyncStatus() {
    try {
      const queue = await offlineStorage.getSyncQueue();
      const pending = queue.filter(item => item.status === 'pending').length;
      const retry = queue.filter(item => item.status === 'retry').length;
      const failed = queue.filter(item => item.status === 'failed').length;
      
      return {
        pending,
        retry,
        failed,
        total: queue.length
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return { pending: 0, retry: 0, failed: 0, total: 0 };
    }
  }

  // Clear failed sync items
  async clearFailedSync() {
    try {
      const queue = await offlineStorage.getSyncQueue();
      const failedItems = queue.filter(item => item.status === 'failed');
      
      for (const item of failedItems) {
        await offlineStorage.removeFromSyncQueue(item.id);
      }
      
      return failedItems.length;
    } catch (error) {
      console.error('Error clearing failed sync:', error);
      return 0;
    }
  }
}

// Create singleton instance
const offlineSync = new OfflineSync();

export default offlineSync; 