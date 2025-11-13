import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowLeft, FiFileText, FiMessageSquare, FiFile, FiChevronRight, FiLoader, FiX } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import * as documentService from '../services/documentService';
import { debounce } from 'lodash';
import '../App.css';

const DocumentSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { api } = useAuth();

  // Debounced search function
  const performSearch = useCallback(
    debounce((query, docs) => {
      if (!query.trim()) {
        setFilteredDocs(docs);
        setIsSearching(false);
        return;
      }

      const queryLower = query.toLowerCase();
      const results = docs.filter(doc => 
        doc.originalname?.toLowerCase().includes(queryLower) ||
        doc.filename?.toLowerCase().includes(queryLower) ||
        doc.mimetype?.toLowerCase().includes(queryLower)
      );
      
      setFilteredDocs(results);
      setIsSearching(false);
    }, 300),
    []
  );

  // Handle search input changes
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!isSearching) setIsSearching(true);
    performSearch(query, documents);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setFilteredDocs(documents);
  };

  // Fetch documents on component mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const docs = await documentService.getDocuments(api);
        setDocuments(docs);
        setFilteredDocs(docs);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
    
    // Cleanup debounce on unmount
    return () => {
      performSearch.cancel();
    };
  }, [performSearch]);

  const handleBack = () => {
    navigate('/');
  };

  const handleChatWithDoc = (doc) => {
    // TODO: Implement chat functionality
    alert(`Chat with ${doc.originalname} will be implemented here`);
  };

  const handleGenerateSummary = (doc) => {
    // TODO: Implement summary generation
    alert(`Generating summary for ${doc.originalname} will be implemented here`);
  };

  // Highlight search matches in text
  const highlightMatch = (text) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = String(text).split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="highlight">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <FiLoader className="spinner" />
        <p>Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  const showNoResults = !isLoading && !isSearching && filteredDocs.length === 0;
  const showInitialState = !isLoading && !isSearching && filteredDocs.length === 0 && searchQuery === '';

  return (
    <div className="container">
      <div className="search-header">
        <button 
          onClick={handleBack} 
          className="back-button"
          aria-label="Go back"
        >
          <FiArrowLeft size={20} />
          <span>Back to Home</span>
        </button>
        <h1 className="page-title">Document Search</h1>
      </div>
      
      <div className="search-container">
        <div className="search-bar">
          <FiSearch className="search-icon" />
          <div className="search-input-container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by filename or type..."
              className="search-input"
              autoFocus
              aria-label="Search documents"
            />
            {searchQuery && (
              <button 
                className="clear-search-button"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <FiX />
              </button>
            )}
          </div>
          {isSearching && (
            <div className="search-loading">
              <FiLoader className="spinner" />
            </div>
          )}
        </div>
        
        <div className="document-list">
          {showInitialState && (
            <div className="empty-state">
              <FiFileText size={48} className="empty-icon" />
              <h3>No documents found</h3>
              <p>Upload your first document to get started</p>
            </div>
          )}
          
          {showInitialState ? (
            <div className="empty-state">
              <FiFileText size={48} className="empty-icon" />
              <h3>No documents found</h3>
              <p>Upload your first document to get started</p>
            </div>
          ) : showNoResults ? (
            <div className="no-results">
              <p>No documents found{searchQuery ? ` matching "${searchQuery}"` : ''}</p>
              {searchQuery && (
                <button 
                  className="clear-search"
                  onClick={clearSearch}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-icon">
                  <FiFileText className="document-icon-svg" />
                  <span className="document-format">
                    {doc.originalname?.split('.').pop().toUpperCase() || 'FILE'}
                  </span>
                </div>
                <div className="document-details">
                  <h3 className="document-name">
                    {highlightMatch(doc.originalname || doc.filename)}
                  </h3>
                  <div className="document-meta">
                    <span title="File size">{doc.size}</span>
                    <span className="meta-separator">•</span>
                    <span title="File type">{doc.mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                    <span className="meta-separator">•</span>
                    <span title="Uploaded">{doc.timeAgo || 'Recently'}</span>
                  </div>
                </div>
                <div className="document-actions">
                  <button 
                    className="action-button summary"
                    onClick={() => handleGenerateSummary(doc)}
                  >
                    <FiFile className="button-icon" />
                    <span>Generate Summary</span>
                    <FiChevronRight className="button-arrow" />
                  </button>
                  <button 
                    className="action-button chat"
                    onClick={() => handleChatWithDoc(doc)}
                  >
                    <FiMessageSquare className="button-icon" />
                    <span>Chat with Document</span>
                    <FiChevronRight className="button-arrow" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentSearch;
