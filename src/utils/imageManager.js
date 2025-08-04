// Image Manager for Local Storage
class ImageManager {
  constructor() {
    this.dbName = 'ACCTOOImages';
    this.dbVersion = 1;
    this.storeName = 'userImages';
    this.db = null;
    this.init();
  }

  // Initialize IndexedDB
  async init() {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
      console.warn('IndexedDB is not supported in this browser');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = (event) => {
          console.error('Failed to open IndexedDB:', request.error);
          // Don't reject, just log the error and continue
          console.warn('IndexedDB error, continuing without image storage');
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('IndexedDB initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          try {
            const db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(this.storeName)) {
              const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
              store.createIndex('category', 'category', { unique: false });
              store.createIndex('name', 'name', { unique: false });
              store.createIndex('userId', 'userId', { unique: false });
            }
          } catch (error) {
            console.error('Error in onupgradeneeded:', error);
            resolve(); // Continue without failing
          }
        };
      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
        resolve(); // Continue without failing
      }
    });
  }

  // Save image to local storage
  async saveImage(imageData, options = {}) {
    await this.init();
    
    // If IndexedDB is not available, just return success
    if (!this.db) {
      console.warn('IndexedDB not available, skipping image save');
      return Promise.resolve({
        id: this.generateId(),
        name: options.name || 'Untitled',
        category: options.category || 'general',
        userId: options.userId || 'default',
        description: options.description || '',
        tags: options.tags || [],
        data: imageData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size: imageData.length || 0
      });
    }
    
    const {
      id = this.generateId(),
      name = 'Untitled',
      category = 'general',
      userId = 'default',
      description = '',
      tags = []
    } = options;

    const imageRecord = {
      id,
      name,
      category,
      userId,
      description,
      tags,
      data: imageData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      size: imageData.length || 0
    };

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(imageRecord);

        request.onsuccess = () => {
          console.log('Image saved successfully:', id);
          resolve(imageRecord);
        };

        request.onerror = () => {
          console.error('Failed to save image:', request.error);
          // Don't reject, just log and continue
          console.warn('Image save failed, continuing without storage');
          resolve(imageRecord);
        };
      } catch (error) {
        console.error('Error in saveImage:', error);
        resolve(imageRecord); // Continue without failing
      }
    });
  }

  // Get image by ID
  async getImage(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to get image:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all images by category
  async getImagesByCategory(category, userId = 'default') {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('category');
      const request = index.getAll(IDBKeyRange.only(category));

      request.onsuccess = () => {
        const images = request.result.filter(img => img.userId === userId);
        resolve(images);
      };

      request.onerror = () => {
        console.error('Failed to get images by category:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all images for user
  async getAllImages(userId = 'default') {
    await this.init();
    
    // If IndexedDB is not available, return empty array
    if (!this.db) {
      console.warn('IndexedDB not available, returning empty image list');
      return Promise.resolve([]);
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const images = request.result.filter(img => img.userId === userId);
          resolve(images);
        };

        request.onerror = () => {
          console.error('Failed to get all images:', request.error);
          // Don't reject, just return empty array
          console.warn('Failed to get images, returning empty array');
          resolve([]);
        };
      } catch (error) {
        console.error('Error in getAllImages:', error);
        resolve([]); // Return empty array on error
      }
    });
  }

  // Delete image by ID
  async deleteImage(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Image deleted successfully:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete image:', request.error);
        reject(request.error);
      };
    });
  }

  // Update image metadata
  async updateImageMetadata(id, updates) {
    await this.init();
    
    const image = await this.getImage(id);
    if (!image) {
      throw new Error('Image not found');
    }

    const updatedImage = {
      ...image,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return this.saveImage(updatedImage.data, updatedImage);
  }

  // Search images by name or tags
  async searchImages(query, userId = 'default') {
    const allImages = await this.getAllImages(userId);
    const searchTerm = query.toLowerCase();
    
    return allImages.filter(img => 
      img.name.toLowerCase().includes(searchTerm) ||
      img.description.toLowerCase().includes(searchTerm) ||
      img.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // Get storage usage
  async getStorageUsage(userId = 'default') {
    const images = await this.getAllImages(userId);
    const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
    
    return {
      totalImages: images.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  }

  // Clear all images for user
  async clearAllImages(userId = 'default') {
    const images = await this.getAllImages(userId);
    const deletePromises = images.map(img => this.deleteImage(img.id));
    await Promise.all(deletePromises);
  }

  // Generate unique ID
  generateId() {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Convert file to base64
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Convert base64 to blob
  base64ToBlob(base64) {
    const parts = base64.split(',');
    const contentType = parts[0].split(':')[1].split(';')[0];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  }

  // Validate image file
  validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload JPEG, PNG, GIF, or WebP images.');
    }

    if (file.size > maxSize) {
      throw new Error('File size too large. Please upload images smaller than 5MB.');
    }

    return true;
  }

  // Compress image for storage
  async compressImage(file, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (max 800px width/height)
        const maxSize = 800;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

// Create singleton instance
const imageManager = new ImageManager();

export default imageManager; 