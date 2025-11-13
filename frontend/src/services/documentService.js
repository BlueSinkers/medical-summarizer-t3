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

// Get all documents
export const getDocuments = async (api) => {
  try {
    const response = await api.get('/documents');
    return response.data.documents || [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    if (error.response?.status === 401) {
      console.log('Authentication required');
      // The AuthContext will handle redirecting to login if needed
    }
    throw error;
  }
};

// Delete a document
export const deleteDocument = async (api, documentId) => {
  try {
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting document:', error);
    if (error.response?.status === 401) {
      console.log('Authentication required');
      // The AuthContext will handle redirecting to login if needed
    }
    throw error;
  }
};
