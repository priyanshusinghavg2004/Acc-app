import React, { useState, useEffect } from 'react';
import imageManager from '../utils/imageManager';
import { StandardModal, StandardButton, ActionBar, ConfirmationModal } from './Modal';

const ImageManager = ({ userId, onImageSelect, selectedImageId, showModal, onClose }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [storageUsage, setStorageUsage] = useState({ totalImages: 0, totalSizeMB: '0' });
  
  // Confirmation modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);

  const categories = [
    { value: 'all', label: 'All Images' },
    { value: 'logo', label: 'Company Logo' },
    { value: 'seal', label: 'Company Seal' },
    { value: 'signature', label: 'Signature' },
    { value: 'qr', label: 'QR Code' },
    { value: 'employee', label: 'Employee Photos' },
    { value: 'product', label: 'Product Images' },
    { value: 'general', label: 'General' }
  ];

  // Load images on component mount
  useEffect(() => {
    loadImages();
    loadStorageUsage();
  }, [userId]);

  // Load images by category and search
  useEffect(() => {
    loadImages();
  }, [selectedCategory, searchQuery]);

  const loadImages = async () => {
    setLoading(true);
    try {
      let allImages = await imageManager.getAllImages(userId);
      
      // Filter by category
      if (selectedCategory !== 'all') {
        allImages = allImages.filter(img => img.category === selectedCategory);
      }
      
      // Filter by search query
      if (searchQuery.trim()) {
        allImages = allImages.filter(img => 
          img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          img.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          img.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      
      setImages(allImages);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageUsage = async () => {
    try {
      const usage = await imageManager.getStorageUsage(userId);
      setStorageUsage(usage);
    } catch (error) {
      console.error('Error loading storage usage:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        // Validate file
        imageManager.validateImageFile(file);
        
        // Compress image
        const compressedBlob = await imageManager.compressImage(file);
        
        // Convert to base64
        const base64Data = await imageManager.fileToBase64(compressedBlob);
        
        // Save to local storage
        await imageManager.saveImage(base64Data, {
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          category: 'general',
          userId,
          description: `Uploaded on ${new Date().toLocaleDateString()}`,
          tags: []
        });
      }
      
      // Reload images and storage usage
      await loadImages();
      await loadStorageUsage();
      
      alert('Images uploaded successfully!');
    } catch (error) {
      console.error('Error uploading images:', error);
      alert(`Error uploading images: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    setImageToDelete(imageId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteImage = async () => {
    if (!imageToDelete) return;
    
    try {
      await imageManager.deleteImage(imageToDelete);
      await loadImages();
      await loadStorageUsage();
      alert('Image deleted successfully!');
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image');
    } finally {
      setShowDeleteConfirm(false);
      setImageToDelete(null);
    }
  };

  const handleImageSelect = (image) => {
    if (onImageSelect) {
      onImageSelect(image);
    }
  };

  const handleEditImage = async (image) => {
    const newName = prompt('Enter new name for image:', image.name);
    if (!newName || newName.trim() === '') return;
    
    try {
      await imageManager.updateImageMetadata(image.id, { name: newName.trim() });
      await loadImages();
      alert('Image name updated successfully!');
    } catch (error) {
      console.error('Error updating image:', error);
      alert('Error updating image');
    }
  };

  const handleCategoryChange = (imageId, newCategory) => {
    imageManager.updateImageMetadata(imageId, { category: newCategory })
      .then(() => loadImages())
      .catch(error => {
        console.error('Error updating category:', error);
        alert('Error updating category');
      });
  };

  const downloadImage = (image) => {
    const link = document.createElement('a');
    link.href = image.data;
    link.download = `${image.name}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <StandardModal
        isOpen={showModal}
        onClose={onClose}
        title="Image Manager"
        size="lg"
      >
        <div className="p-6">
          {/* Storage Usage */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">
                Storage: {storageUsage.totalImages} images ({storageUsage.totalSizeMB} MB)
              </span>
              <StandardButton
                variant="info"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear All
              </StandardButton>
            </div>
          </div>

          {/* Upload Section */}
          <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
                disabled={uploading}
              />
              <label
                htmlFor="image-upload"
                className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                  uploading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {uploading ? 'Uploading...' : 'Upload Images'}
              </label>
              <p className="mt-2 text-sm text-gray-500">
                Supported formats: JPEG, PNG, GIF, WebP (max 5MB each)
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Images Grid */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading images...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No images found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`border rounded-lg p-2 cursor-pointer transition-all ${
                    selectedImageId === image.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleImageSelect(image)}
                >
                  <div className="relative">
                    <img
                      src={image.data}
                      alt={image.name}
                      className="w-full h-24 object-cover rounded"
                    />
                    <div className="absolute top-1 right-1">
                      <select
                        value={image.category}
                        onChange={(e) => handleCategoryChange(image.id, e.target.value)}
                        className="text-xs bg-white border rounded px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {categories.slice(1).map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium truncate" title={image.name}>
                      {image.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(image.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <StandardButton
                      variant="info"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(image);
                      }}
                    >
                      Download
                    </StandardButton>
                    <StandardButton
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditImage(image);
                      }}
                    >
                      Edit
                    </StandardButton>
                    <StandardButton
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(image.id);
                      }}
                    >
                      Delete
                    </StandardButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ActionBar>
          <StandardButton variant="secondary" onClick={onClose}>
            Close
          </StandardButton>
        </ActionBar>
      </StandardModal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        onConfirm={confirmDeleteImage}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Clear All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Images"
        message="Are you sure you want to clear all images? This action cannot be undone."
        onConfirm={async () => {
          try {
            await imageManager.clearAllImages(userId);
            await loadImages();
            await loadStorageUsage();
            alert('All images cleared successfully!');
          } catch (error) {
            console.error('Error clearing images:', error);
            alert('Error clearing images');
          } finally {
            setShowClearConfirm(false);
          }
        }}
        confirmText="Clear All"
        cancelText="Cancel"
      />
    </>
  );
};

export default ImageManager; 