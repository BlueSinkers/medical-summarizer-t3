import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import UserMenu from './components/UserMenu';
import { 
  FiUpload, 
  FiFileText, 
  FiClock, 
  FiGithub, 
  FiActivity, 
  FiMenu, 
  FiX, 
  FiFile, 
  FiChevronRight, 
  FiTrash2,
  FiMessageSquare,
  FiSearch,
  FiArrowLeft,
  FiSend,
  FiUser, 
  FiLogOut,
  FiChevronDown,
  FiDownload,
  FiLoader,
  FiAlertCircle,
  FiSearch as FiSearchIcon
} from 'react-icons/fi';
import { uploadDocument, getDocuments, deleteDocument } from './services/documentService';
import DocumentSearch from './pages/DocumentSearch';
import './App.css';
import './index.css';

function MedicalSummarizer() {
  const { user, logout } = useAuth();
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
        const docs = await getDocuments();
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
      const response = await uploadDocument(fileToUpload);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('success');
      
      // Update recent documents
      const updatedDocs = await getDocuments();
      setRecentDocuments(updatedDocs);
      
      // Show success message
      setSummary('File uploaded successfully!');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
        setSummary('');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
      
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

  // Handle document deletion
  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation(); // Prevent triggering the document select
    
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        setIsDeleting(docId);
        await deleteDocument(docId);
        
        // Update the UI by removing the deleted document
        setRecentDocuments(prev => prev.filter(doc => doc.id !== docId));
        
        // Clear the summary if the deleted document was being viewed
        if (summary && summary.includes(docId)) {
          setSummary('');
        }
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document. Please try again.');
      } finally {
        setIsDeleting(false);
      }
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
            <div className="logo">
              <FiFileText className="logo-icon" />
              <h1>MediSum</h1>
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
            recentDocuments.map((doc) => (
              <div
                key={doc.id}
                className="document-item"
                onClick={() => handleDocumentSelect(doc)}
              >
                <div className="document-icon-container">
                  <FiFile className="document-icon" />
                  <span className="document-format">
                    {doc.originalname?.split('.').pop().toUpperCase() || 'FILE'}
                  </span>
                </div>
                <div className="document-info">
                  <div className="document-name" title={doc.originalname || doc.name}>
                    {doc.originalname || doc.name}
                  </div>
                  <div className="document-meta">
                    <span className="document-size">{doc.size || ''}</span>
                    <span className="document-separator">•</span>
                    <span className="document-date">{doc.timeAgo || 'Just now'}</span>
                  </div>
                </div>
                <button
                  className="delete-document"
                  onClick={(e) => handleDeleteDocument(doc.id, e)}
                  disabled={isDeleting === doc.id}
                  aria-label={`Delete ${doc.originalname || doc.name}`}
                >
                  <FiTrash2 size={16} />
                </button>
                <FiChevronRight className="document-arrow" />
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
