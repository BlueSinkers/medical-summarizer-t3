// Document service functions that work with an authenticated API instance

// Upload a document
export const uploadDocument = async (api, file) => {
  const formData = new FormData();
  formData.append('document', file);

  try {
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error uploading document:', error);
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    throw error;
  }
};

// Get all documents with caching
export const getDocuments = async (api) => {
  try {
    // Try to get fresh data from the server
    const response = await api.get('/documents');
    const freshDocs = response.data;
    
    // Cache the fresh data in localStorage
    if (freshDocs && Array.isArray(freshDocs)) {
      localStorage.setItem('cachedDocuments', JSON.stringify(freshDocs));
      localStorage.setItem('lastUpdated', Date.now().toString());
    }
    
    return freshDocs;
  } catch (error) {
    console.error('Error fetching documents:', error);
    
    // If there's an error, try to return cached data if available
    if (error.response?.status !== 401) {
      try {
        const cachedDocs = JSON.parse(localStorage.getItem('cachedDocuments') || '[]');
        if (cachedDocs.length > 0) {
          console.log('Using cached documents due to network error');
          return cachedDocs;
        }
      } catch (e) {
        console.error('Error reading cached documents:', e);
      }
    } else {
      // Clear cache on authentication error
      localStorage.removeItem('cachedDocuments');
      localStorage.removeItem('lastUpdated');
      console.log('Authentication required');
      // The AuthContext will handle redirecting to login if needed
    }
    
    throw error;
  }
};

// Delete a document
export const deleteDocument = async (api, documentId) => {
  if (!documentId) {
    throw new Error('No document ID provided for deletion');
  }
  
  try {
    const response = await api.delete(`/documents/${documentId}`);
    
    // Update localStorage to remove the deleted document
    const cachedDocs = JSON.parse(localStorage.getItem('cachedDocuments') || '[]');
    const updatedDocs = cachedDocs.filter(doc => doc._id !== documentId && doc.id !== documentId);
    localStorage.setItem('cachedDocuments', JSON.stringify(updatedDocs));
    
    return response.data;
  } catch (error) {
    console.error('Error deleting document:', {
      error,
      documentId,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.log('Authentication required');
      // Clear cached documents on authentication error
      localStorage.removeItem('cachedDocuments');
      // The AuthContext will handle redirecting to login
    } else if (error.response?.status === 404) {
      // Remove from cache if not found on server
      const cachedDocs = JSON.parse(localStorage.getItem('cachedDocuments') || '[]');
      const updatedDocs = cachedDocs.filter(doc => doc._id !== documentId && doc.id !== documentId);
      localStorage.setItem('cachedDocuments', JSON.stringify(updatedDocs));
      
      throw new Error('Document not found or already deleted');
    } else if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    } else {
      throw new Error(error.response.data?.error || 'Failed to delete document');
    }
  }
};