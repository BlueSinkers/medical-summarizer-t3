import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import UserMenu from './components/UserMenu';
import { 
  FiUpload, 
  FiFile, 
  FiChevronRight, 
  FiMenu, 
  FiX, 
  FiActivity, 
  FiMessageSquare, 
  FiUser, 
  FiLoader, 
  FiCheckCircle, 
  FiAlertCircle,
  FiTrash2,
  FiDownload,
  FiGithub
} from 'react-icons/fi';
import * as documentService from './services/documentService';
import DocumentSearch from './pages/DocumentSearch';
import './App.css';
import './index.css';

function MedicalSummarizer() {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isInitialMount = useRef(true);
  
  // Handle smooth scrolling and transitions
  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: isInitialMount.current ? 'auto' : 'smooth'
      });
      
      document.body.classList.add('page-loading');
      
      const timer = setTimeout(() => {
        document.body.classList.remove('page-loading');
      }, 500);
      
      return () => clearTimeout(timer);
    };

  // Download document as a blob and save with the correct filename
  const handleDownloadDocument = async (doc, e) => {
    try {
      e?.stopPropagation();
      const id = doc._id || doc.id;
      if (!id) return;
      // Backend route: GET /api/documents/download/:id
      const response = await api.get(`/documents/download/${id}`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = doc.originalName || doc.filename || `document-${id}`;
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download document:', err);
    }
  };
    
    if (isInitialMount.current) {
      window.scrollTo(0, 0);
      isInitialMount.current = false;
    }
    
    const timer = setTimeout(scrollToTop, 0);
    window.addEventListener('popstate', scrollToTop);
    
    const handleBeforeUnload = () => window.scrollTo(0, 0);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', scrollToTop);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname]);
  
  // Handle chat button click - navigate to document search/chat page
  const handleChatClick = useCallback(() => {
    navigate('/documents');
  }, [navigate]);
  // State management
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [summary, setSummary] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Refs
  const sidebarRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch recent documents on component mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const docs = await documentService.getDocuments(api);
        setRecentDocuments(docs);
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };
    
    fetchDocuments();
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && 
          !sidebarRef.current.contains(event.target) && 
          !event.target.closest('.sidebar-toggle')) {
        setIsSidebarOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format time since upload
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
      }
    }
    
    return 'Just now';
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      handleFileUpload(selectedFile);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      handleFileUpload(droppedFile);
    }
  };

  // Check if file already exists in recent documents
  const isDuplicateFile = (fileName) => {
    return recentDocuments.some(doc => 
      doc.originalName === fileName || doc.filename === fileName || doc.name === fileName
    );
  };

  // Handle file upload
  const handleFileUpload = async (fileToUpload) => {
    if (!fileToUpload) return;

    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const fileType = fileToUpload.type;
    
    if (!allowedTypes.includes(fileType)) {
      setUploadStatus('error');
      setSummary('Invalid file type. Please upload a PDF, DOC, DOCX, or TXT file.');
      return;
    }

    // Check file size (10MB limit)
    if (fileToUpload.size > 10 * 1024 * 1024) {
      setUploadStatus('error');
      setSummary('File size too large. Maximum size is 10MB.');
      return;
    }

    // Check for duplicate file
    if (isDuplicateFile(fileToUpload.name)) {
      setUploadStatus('error');
      setSummary(`A file named "${fileToUpload.name}" already exists.`);
      return;
    }

    setIsLoading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setSummary('');

    try {
      // Simulate progress (optional)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Upload the file
      const response = await documentService.uploadDocument(api, fileToUpload);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('success');
      
      // Update recent documents by adding the new document
      setRecentDocuments(prevDocs => [response.document, ...prevDocs]);
      
      // Show success message with the filename
      setSummary(`Successfully uploaded: ${response.document.originalName}`);
      
      // Reset after 3 seconds
      const resetTimer = setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
        setSummary('');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
      
      // Clear the timeout when component unmounts
      return () => clearTimeout(resetTimer);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      
      // Handle duplicate file error specifically
      if (error.response?.code === 'DUPLICATE_FILE' || error.message.includes('already exists')) {
        setSummary('This file has already been uploaded.');
      } else {
        setSummary(error.message || 'Failed to upload file. Please try again.');
      }
      
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle document selection
  const handleDocumentSelect = useCallback(async (doc) => {
    try {
      setIsLoading(true);
      // Here you would typically fetch the document content
      // For now, we'll just set a placeholder summary
      setSummary(`Summary for ${doc.name} would be displayed here.`);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Error loading document:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteDocument = async (docId, e) => {
    e?.stopPropagation(); // Prevent triggering the document select
    
    // Get the document first to ensure we have the correct ID
    const docToDelete = recentDocuments.find(doc => doc.id === docId || doc._id === docId);
    
    if (!docToDelete) {
      console.error('Document not found in the current list');
      setUploadStatus('error');
      setSummary('Error: Document not found');
      return;
    }

    // Use the document's _id if available, otherwise use the provided ID
    const documentId = docToDelete._id || docToDelete.id || docId;
    
    if (!documentId) {
      console.error('No valid document ID found');
      setUploadStatus('error');
      setSummary('Error: Invalid document ID');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(documentId);
      const docName = docToDelete.originalName || docToDelete.originalname || 'document';
      
      // Call the delete API with the correct document ID
      await documentService.deleteDocument(api, documentId);
      
      // Update the UI by removing the deleted document
      setRecentDocuments(prev => 
        prev.filter(doc => doc._id !== documentId && doc.id !== documentId)
      );
      
      // Show success message
      setUploadStatus('success');
      setSummary(`Document "${docName}" has been deleted.`);
      
      // Clear the summary if the deleted document was being viewed
      if (summary && (summary.includes(documentId) || 
          (docToDelete.id && summary.includes(docToDelete.id)) || 
          (docToDelete._id && summary.includes(docToDelete._id)))) {
        setSummary('');
      }
      
    } catch (error) {
      console.error('Error deleting document:', error);
      
      let errorMessage = 'Failed to delete document. ';
      if (error.response) {
        // Server responded with an error
        errorMessage += error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response received
        errorMessage += 'No response from server. Please check your connection.';
      } else {
        // Something else happened
        errorMessage += error.message || 'An unknown error occurred.';
      }
      
      setUploadStatus('error');
      setSummary(errorMessage);
    } finally {
      // Clear any status messages after 5 seconds
      const timer = setTimeout(() => {
        setUploadStatus('');
        setSummary('');
      }, 5000);
      
      setIsDeleting(false);
      
      // Clean up the timeout if the component unmounts
      return () => clearTimeout(timer);
    }
  };

  // Toggle sidebar with overlay
  const toggleSidebar = useCallback(() => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    
    // Toggle body scroll when sidebar is open
    if (newState) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Close sidebar when clicking outside or pressing Escape
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target) && !e.target.closest('.sidebar-toggle')) {
        setIsSidebarOpen(false);
        document.body.style.overflow = '';
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
        document.body.style.overflow = '';
      }
    };

    if (newState) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSidebarOpen]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <button 
                className="sidebar-toggle" 
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
              >
                <FiMenu className="menu-icon" />
              </button>
              <Link to="/" className="logo">
                <FiActivity className="logo-icon" />
                <h1>MediSum</h1>
              </Link>
            </div>
            <nav className="nav-links">
              {user ? (
                <>
                  <button className="nav-link" onClick={handleChatClick}>
                    <FiMessageSquare />
                    <span>Chat with AI</span>
                  </button>
                  <UserMenu user={user} onLogout={logout} />
                </>
              ) : (
                <button 
                  className="nav-link" 
                  onClick={() => navigate('/login')}
                >
                  <FiUser />
                  <span>Login</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Upload Status */}
        {uploadStatus && (
          <div className={`upload-status ${uploadStatus}`}>
            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <div className="status-content">
              <div className="status-message">
                {uploadStatus === 'uploading' ? (
                  <div className="loading-spinner">
                    <FiLoader className="spin" /> Uploading...
                  </div>
                ) : (
                  <>
                    <span className="status-icon">
                      {uploadStatus === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
                    </span>
                    <span className="status-text">{summary}</span>
                    {uploadStatus === 'success' && (
                      <button 
                        className="close-status"
                        onClick={() => setUploadStatus('')}
                        aria-label="Close message"
                      >
                        <FiX />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="hero-section">
          <h1 className="hero-title">Medical Document Summarizer</h1>
          <p className="hero-subtitle">
            Upload your medical documents and get concise, accurate summaries in seconds.
            Save time and focus on what matters most - patient care.
          </p>
        </div>

        <div className="upload-section">
          <div 
            className={`upload-content ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FiUpload className="upload-icon" />
            <div className="upload-text">
              <h3>Drag & drop your files here</h3>
              <p>or</p>
              <input
                type="file"
                id="file-upload"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
              />
              <button 
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Select Files
              </button>
              <p className="file-types">Supported formats: PDF, DOC, DOCX, TXT (max 10MB)</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="loading-container">
            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <div className="summary-content">
                {isLoading ? (
                  <div className="loading-spinner">Loading...</div>
                ) : (
                  <p>{summary}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={toggleSidebar}
        role="button"
        tabIndex={-1}
        aria-label="Close sidebar"
      />
      
      {/* Sidebar */}
      <div 
        className={`sidebar ${isSidebarOpen ? 'open' : ''}`} 
        ref={sidebarRef}
        role="dialog"
        aria-modal="true"
        aria-label="Recent documents"
      >
        <div className="sidebar-header">
          <h3>Recent Documents</h3>
          <button
            className="close-sidebar"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          >
            <FiX size={20} />
          </button>
        </div>
        
        <div className="document-list">
          {recentDocuments.length > 0 ? (
            recentDocuments.map((doc, index) => (
              <div
                key={`doc-${doc.id || doc._id || `${doc.originalName || doc.filename || 'doc'}-${index}`}`}
                className={`document-item ${isDeleting === (doc.id || doc._id) ? 'deleting' : ''}`}
                role="listitem"
              >
                <div className="document-content" onClick={() => handleDocumentSelect(doc)}>
                  <div className="document-icon-container">
                    <FiFile className="document-icon" />
                    <span className="document-format" title="File format">
                      {doc.originalname?.split('.').pop().toUpperCase() || 'FILE'}
                    </span>
                  </div>
                  <div className="document-info">
                    <div className="document-name" title={doc.originalName || doc.originalname || doc.name || 'Untitled Document'}>
                      {doc.originalName || doc.originalname || doc.name || 'Untitled Document'}
                    </div>
                    <div className="document-meta">
                      <span className="document-size" title="File size">
                        {doc.size != null ? formatFileSize(doc.size) : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="document-actions">
                  <button
                    className="download-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadDocument(doc, e);
                    }}
                    title="Download document"
                    aria-label={`Download ${doc.originalName || doc.originalname || doc.filename || 'document'}`}
                  >
                    <FiDownload size={14} />
                  </button>
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id || doc._id, e);
                    }}
                    disabled={isDeleting === (doc.id || doc._id)}
                    aria-label="Delete document"
                    title="Delete document"
                  >
                    {isDeleting === (doc.id || doc._id) ? (
                      <div className="spinner" style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid #e5e7eb',
                        borderTopColor: '#3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto'
                      }} />
                    ) : (
                      <FiTrash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-documents">
              <p>No recent documents</p>
              <p className="hint">Upload a document to get started</p>
            </div>
          )}
        </div>
      </div>

      <footer className="app-footer">
          <div className="container">
            <div className="footer-content">
              <div className="footer-about">
                <div className="social-links">
                  <a 
                    href="https://github.com/BlueSinkers/medical-summarizer-t3" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                  >
                    <FiGithub size={24} />
                  </a>
                </div>
                <p>&copy; {new Date().getFullYear()} MediSum. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentSearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MedicalSummarizer />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
