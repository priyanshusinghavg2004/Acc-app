# Image Management System Guide

## Overview
The Image Management System allows users to store and manage their custom images (logos, seals, signatures, QR codes, etc.) locally in their browser using IndexedDB. This ensures that images are available even when offline or with slow internet connections.

## Features

### 🖼️ **Image Storage**
- **Local Storage**: All images are stored locally in the browser using IndexedDB
- **Offline Access**: Images work without internet connection
- **Fast Loading**: No server requests needed for image display
- **Automatic Compression**: Images are automatically compressed to save space

### 📁 **Image Categories**
- **Company Logo**: For business branding on documents
- **Company Seal**: Official company seal/stamp
- **Signature**: Digital signature for documents
- **QR Code**: QR codes for payments or information
- **Employee Photos**: Staff photographs
- **Product Images**: Product photos
- **General**: Miscellaneous images

### 🔧 **Management Features**
- **Upload Multiple Images**: Drag and drop or select multiple files
- **Search & Filter**: Find images by name, description, or tags
- **Category Management**: Organize images by type
- **Edit Metadata**: Rename and update image information
- **Download Images**: Export images back to your device
- **Storage Monitoring**: Track storage usage

## How to Use

### 1. **Accessing Image Manager**
- Click the "Manage Images" button in the Sales page header
- The Image Manager modal will open

### 2. **Uploading Images**
- Click "Upload Images" button
- Select one or multiple image files
- Supported formats: JPEG, PNG, GIF, WebP
- Maximum file size: 5MB per image
- Images are automatically compressed for storage

### 3. **Organizing Images**
- **Categorize**: Use the dropdown on each image to assign categories
- **Search**: Use the search bar to find specific images
- **Filter**: Use the category filter to view specific types

### 4. **Managing Images**
- **Select**: Click on an image to select it for use
- **Edit**: Click "Edit" to rename the image
- **Download**: Click "Download" to save the image to your device
- **Delete**: Click "Delete" to remove the image

### 5. **Using Images in Documents**
- **Automatic Loading**: Images are automatically loaded when you open the app
- **Document Integration**: Selected images appear in receipts and other documents
- **Print Support**: Images are included in printed documents and PDFs

## Technical Details

### Storage System
```javascript
// IndexedDB Structure
Database: LekhaJokhaImages
Store: userImages
Indexes: category, name, userId

// Image Record Structure
{
  id: 'unique_id',
  name: 'Image Name',
  category: 'logo|seal|signature|qr|employee|product|general',
  userId: 'user_id',
  description: 'Image description',
  tags: ['tag1', 'tag2'],
  data: 'base64_image_data',
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  size: 12345 // bytes
}
```

### Image Processing
- **Validation**: File type and size validation
- **Compression**: Automatic resizing to max 800px width/height
- **Format Conversion**: All images converted to JPEG for consistency
- **Quality**: 80% quality setting for optimal size/quality balance

### Security Features
- **User Isolation**: Each user's images are stored separately
- **Local Storage**: No server transmission of images
- **Browser Security**: Uses standard browser security mechanisms

## Integration Points

### Receipt Templates
Images are automatically integrated into:
- **Company Logo**: Displayed at the top of receipts
- **Company Seal**: Overlaid on receipt footer
- **Signature**: Replaces the signature line

### PDF Generation
- **Logo**: Added to PDF header
- **Seal**: Included in PDF footer
- **Signature**: Embedded in signature area

### Print Support
- **High Quality**: Images maintain quality in print
- **Proper Sizing**: Automatic scaling for print layout
- **Positioning**: Correct placement in printed documents

## Benefits

### 🚀 **Performance**
- **Fast Loading**: No network requests for images
- **Reduced Bandwidth**: Images stored locally
- **Instant Display**: Immediate image availability

### 💾 **Storage Efficiency**
- **Automatic Compression**: Optimized file sizes
- **Smart Caching**: Efficient browser storage usage
- **Storage Monitoring**: Track usage and manage space

### 🔒 **Privacy & Security**
- **Local Storage**: Images never leave your device
- **User Isolation**: Separate storage per user
- **No Server Dependency**: Works completely offline

### 🖨️ **Print Quality**
- **High Resolution**: Maintains quality in print
- **Consistent Sizing**: Proper scaling for documents
- **Professional Appearance**: Enhanced document presentation

## Troubleshooting

### Common Issues

**1. Images not loading**
- Check if IndexedDB is supported in your browser
- Clear browser cache and reload
- Check browser storage permissions

**2. Upload fails**
- Verify file type (JPEG, PNG, GIF, WebP)
- Check file size (max 5MB)
- Ensure browser supports File API

**3. Images not appearing in documents**
- Verify images are properly categorized
- Check if images are selected for use
- Refresh the page to reload images

**4. Storage full**
- Delete unused images
- Use "Clear All" to reset storage
- Check browser storage limits

### Browser Compatibility
- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile Browsers**: Limited support (storage restrictions)

## Best Practices

### Image Preparation
- **Logo**: Use PNG with transparent background
- **Seal**: Use high contrast for visibility
- **Signature**: Use black signature on white background
- **QR Code**: Ensure good contrast and size

### Storage Management
- **Regular Cleanup**: Remove unused images
- **Category Organization**: Use proper categories
- **Descriptive Names**: Use clear, searchable names
- **Monitor Usage**: Check storage regularly

### Performance Optimization
- **Reasonable Sizes**: Don't upload unnecessarily large images
- **Appropriate Formats**: Use JPEG for photos, PNG for graphics
- **Regular Maintenance**: Clean up old images

## Future Enhancements

### Planned Features
- **Image Editing**: Basic editing tools
- **Bulk Operations**: Mass upload/delete
- **Cloud Sync**: Optional cloud backup
- **Advanced Search**: Tag-based search
- **Image Templates**: Pre-configured layouts

### Integration Expansion
- **Invoice Templates**: Logo integration
- **Business Cards**: Custom designs
- **Marketing Materials**: Branded templates
- **Reports**: Enhanced visual presentation

---

## Support

For technical support or feature requests, please contact the development team.

**Version**: 1.0.0  
**Last Updated**: January 2025 