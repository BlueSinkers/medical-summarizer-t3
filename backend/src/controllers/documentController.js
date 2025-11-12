import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// In-memory storage for documents (replace with database in production)
let documents = [];

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to get time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
  
  return 'just now';
}

// Format document for response
function formatDocumentForResponse(doc) {
  return {
    id: doc.id,
    filename: doc.filename,
    originalname: doc.originalname,
    path: doc.path,
    size: formatFileSize(doc.size),
    mimetype: doc.mimetype,
    uploadedAt: doc.uploadedAt,
    timeAgo: getTimeAgo(doc.uploadedAt)
  };
}

// Helper function to check for duplicate files
function isDuplicateFile(existingDocs, newFile) {
  return existingDocs.some(doc => 
    doc.originalname === newFile.originalname && 
    doc.size === newFile.size
  );
}

// Upload a document
export const uploadDocument = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    // Check for duplicate file
    if (isDuplicateFile(documents, req.file)) {
      // Delete the uploaded file since it's a duplicate
      fs.unlinkSync(path.join(process.cwd(), 'uploads', req.file.filename));
      
      return res.status(409).json({
        success: false,
        message: 'File already exists',
        code: 'DUPLICATE_FILE'
      });
    }

    const newDoc = {
      id: uuidv4(),
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    documents.push(newDoc);
    
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      document: formatDocumentForResponse(newDoc)
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
};

// Get all documents
export const getDocuments = (req, res) => {
  try {
    // Sort by upload date, newest first
    const sortedDocs = [...documents].sort((a, b) => 
      new Date(b.uploadedAt) - new Date(a.uploadedAt)
    );
    
    const formattedDocs = sortedDocs.map(doc => formatDocumentForResponse(doc));
    
    res.status(200).json({
      success: true,
      count: formattedDocs.length,
      documents: formattedDocs
    });
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving documents',
      error: error.message
    });
  }
};

// Download a document
export const downloadDocument = (req, res) => {
  try {
    const document = documents.find(doc => doc.id === req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    const filePath = path.join(process.cwd(), document.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
    
    res.download(filePath, document.originalname);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file',
      error: error.message
    });
  }
};

// Delete a document
export const deleteDocument = (req, res) => {
  try {
    const documentIndex = documents.findIndex(doc => doc.id === req.params.id);
    
    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    const document = documents[documentIndex];
    const filePath = path.join(process.cwd(), document.path);
    
    // Remove file from filesystem
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove from in-memory array
    documents.splice(documentIndex, 1);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      documentId: req.params.id
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting document',
      error: error.message
    });
  }
};
