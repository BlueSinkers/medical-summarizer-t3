const API_URL = 'http://localhost:3001/api';

// Upload a document
export const uploadDocument = async (file) => {
  const formData = new FormData();
  // Use the same field name as expected by multer ('document')
  formData.append('document', file, file.name);

  try {
    const response = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      body: formData,
      // Let the browser set the Content-Type with the correct boundary
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include' // Include cookies if using sessions
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(data.message || 'Failed to upload document');
      error.response = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error uploading document:', error);
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    throw error;
  }
};

// Get all documents
export const getDocuments = async () => {
  try {
    const response = await fetch(`${API_URL}/documents`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch documents');
    }
    
    return data.documents || [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

// Delete a document
export const deleteDocument = async (documentId) => {
  try {
    const response = await fetch(`${API_URL}/documents/${documentId}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete document');
    }
    
    return data;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};
