// IndexedDB utility for offline storage
class OfflineStorage {
  constructor() {
    this.dbName = 'ACCTOODB';
    this.version = 1;
    this.db = null;
  }

  // Initialize the database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('parties')) {
          const partiesStore = db.createObjectStore('parties', { keyPath: 'id' });
          partiesStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
          salesStore.createIndex('date', 'invoiceDate', { unique: false });
          salesStore.createIndex('partyId', 'partyId', { unique: false });
        }

        if (!db.objectStoreNames.contains('purchases')) {
          const purchasesStore = db.createObjectStore('purchases', { keyPath: 'id' });
          purchasesStore.createIndex('date', 'billDate', { unique: false });
          purchasesStore.createIndex('partyId', 'partyId', { unique: false });
        }

        if (!db.objectStoreNames.contains('payments')) {
          const paymentsStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentsStore.createIndex('date', 'paymentDate', { unique: false });
          paymentsStore.createIndex('partyId', 'partyId', { unique: false });
        }

        if (!db.objectStoreNames.contains('items')) {
          const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
          itemsStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('pendingActions')) {
          const pendingStore = db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
          pendingStore.createIndex('type', 'type', { unique: false });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Generic CRUD operations
  async add(storeName, data) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async update(storeName, data) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Pending actions management
  async addPendingAction(action) {
    const pendingAction = {
      ...action,
      timestamp: Date.now(),
      status: 'pending'
    };
    return this.add('pendingActions', pendingAction);
  }

  async getPendingActions() {
    return this.getAll('pendingActions');
  }

  async removePendingAction(id) {
    return this.delete('pendingActions', id);
  }

  async clearPendingActions() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue management
  async addToSyncQueue(item) {
    const syncItem = {
      ...item,
      timestamp: Date.now(),
      status: 'pending'
    };
    return this.add('syncQueue', syncItem);
  }

  async getSyncQueue() {
    return this.getAll('syncQueue');
  }

  async updateSyncStatus(id, status) {
    const item = await this.get('syncQueue', id);
    if (item) {
      item.status = status;
      item.lastAttempt = Date.now();
      return this.update('syncQueue', item);
    }
  }

  async removeFromSyncQueue(id) {
    return this.delete('syncQueue', id);
  }

  // Data synchronization helpers
  async syncData(storeName, firebaseData) {
    const localData = await this.getAll(storeName);
    
    // Update local data with Firebase data
    for (const item of firebaseData) {
      await this.update(storeName, item);
    }

    // Add local-only items to sync queue
    for (const item of localData) {
      if (!firebaseData.find(fbItem => fbItem.id === item.id)) {
        await this.addToSyncQueue({
          type: 'add',
          storeName,
          data: item
        });
      }
    }
  }

  // Clear all data (useful for logout)
  async clearAll() {
    if (!this.db) await this.init();
    const storeNames = ['parties', 'sales', 'purchases', 'payments', 'items', 'pendingActions', 'syncQueue'];
    
    return Promise.all(
      storeNames.map(storeName => {
        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      })
    );
  }

  // Get storage usage
  async getStorageUsage() {
    if (!this.db) await this.init();
    const storeNames = ['parties', 'sales', 'purchases', 'payments', 'items', 'pendingActions', 'syncQueue'];
    let totalItems = 0;

    for (const storeName of storeNames) {
      const items = await this.getAll(storeName);
      totalItems += items.length;
    }

    return {
      totalItems,
      stores: storeNames.length
    };
  }
}

// Create singleton instance
const offlineStorage = new OfflineStorage();

export default offlineStorage; 