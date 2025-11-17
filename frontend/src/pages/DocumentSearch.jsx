import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FiSearch, 
  FiArrowLeft, 
  FiFileText, 
  FiMessageSquare, 
  FiFile, 
  FiChevronRight, 
  FiLoader, 
  FiX,
  FiMessageCircle,
  FiFilePlus,
  FiClock
} from 'react-icons/fi';
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
  const [activeDoc, setActiveDoc] = useState(null);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReset = !!(location.state && location.state.resetSearch);
  const { api } = useAuth();

  // Build a case-insensitive regex from user query.
  // If the user typed a valid regex, honor it. Otherwise, escape the query.
  const buildSearchRegex = (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return null;
    try {
      // Try to use the raw query as a regex (case-insensitive, global where needed)
      return new RegExp(trimmed, 'i');
    } catch (e) {
      // Escape regex special chars and fallback to plain text search
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, 'i');
    }
  };

  // Debounced search function with enhanced search capabilities
  const performSearch = useCallback(
    debounce((query, docs) => {
      const trimmed = query.trim();
      // Require at least 2 characters before filtering
      if (trimmed.length < 2) {
        const sortedDocs = [...docs].sort((a, b) => 
          new Date(b.uploadDate || b.createdAt) - new Date(a.uploadDate || a.createdAt)
        );
        setFilteredDocs(sortedDocs);
        setIsSearching(false);
        return;
      }

      if (!trimmed) {
        // If search is empty, show all documents sorted by most recent
        const sortedDocs = [...docs].sort((a, b) => 
          new Date(b.uploadDate || b.createdAt) - new Date(a.uploadDate || a.createdAt)
        );
        setFilteredDocs(sortedDocs);
        setIsSearching(false);
        return;
      }

      const rx = buildSearchRegex(trimmed);
      // Search by originalname with fallback to filename
      const results = docs.filter(doc => {
        const name = doc.originalName || doc.filename || '';
        return name && rx.test(String(name));
      });
      
      // Sort by relevance: exact match > startsWith > regex contains
      const qLower = trimmed.toLowerCase();
      const sortedResults = [...results].sort((a, b) => {
        const aName = String(a.originalName || a.filename || '');
        const bName = String(b.originalName || b.filename || '');
        const aLower = aName.toLowerCase();
        const bLower = bName.toLowerCase();
        const score = (nameLower) => {
          if (nameLower === qLower) return 4;          // exact full match
          if (nameLower.startsWith(qLower)) return 3;  // prefix match
          if (rx && rx.test(nameLower)) return 2;      // regex/contains
          return 1;
        };
        return score(bLower) - score(aLower);
      });
      
      setFilteredDocs(sortedResults);
      setIsSearching(false);
    }, 300),
    []
  );

  // Enhanced search function that searches through document content as well
  const searchDocuments = (query, docs) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return docs;
    const rx = buildSearchRegex(trimmed);
    return docs.filter(doc => {
      const name = doc.originalName || doc.filename || '';
      return name && rx.test(String(name));
    });
  };

  // Handle search input changes
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveDoc(null); // Clear active doc when user types
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      // Below 2 chars, do not search; show all docs
      const sortedDocs = [...documents].sort((a, b) => 
        new Date(b.uploadDate || b.createdAt) - new Date(a.uploadDate || a.createdAt)
      );
      setFilteredDocs(sortedDocs);
      setIsSearching(false);
      return;
    }
    if (!isSearching) setIsSearching(true);
    
    // If the search is cleared, reset filtered docs to show all
    if (!trimmed) {
      const sortedDocs = [...documents].sort((a, b) => 
        new Date(b.uploadDate || b.createdAt) - new Date(a.uploadDate || a.createdAt)
      );
      setFilteredDocs(sortedDocs);
      return;
    }
    
    performSearch(trimmed, documents);
  };
  
  // Handle document selection
  const handleDocumentSelect = (doc) => {
    setActiveDoc(doc);
    setSearchQuery(doc.originalName || doc.filename || '');
    setFilteredDocs([doc]); // Show only the selected document
  };

  // Clear search and show all documents sorted by most recent
  const clearSearch = () => {
    setSearchQuery('');
    setActiveDoc(null);
    const sortedDocs = [...documents].sort((a, b) => 
      new Date(b.uploadDate || b.createdAt) - new Date(a.uploadDate || a.createdAt)
    );
    setFilteredDocs(sortedDocs);
  };
  
  // Handle clicking on a document in the list
  const handleDocumentClick = (doc) => {
    handleDocumentSelect(doc);
  };

  // Store current state in sessionStorage before navigating away
  const saveSearchState = useCallback(() => {
    const stateToSave = {
      searchQuery,
      documents,
      filteredDocs: filteredDocs.length > 0 ? filteredDocs : documents,
      activeDoc,
      timestamp: Date.now()
    };
    sessionStorage.setItem('documentSearchState', JSON.stringify(stateToSave));
  }, [searchQuery, documents, filteredDocs, activeDoc]);

  // Restore search state from sessionStorage
  const restoreSearchState = useCallback(() => {
    try {
      const savedState = sessionStorage.getItem('documentSearchState');
      if (savedState) {
        const { searchQuery: savedQuery, documents: savedDocs, filteredDocs: savedFiltered, activeDoc: savedActiveDoc } = JSON.parse(savedState);
        
        // Only restore if the state is recent (within 1 hour)
        const isStateRecent = (Date.now() - (savedState.timestamp || 0)) < 3600000;
        
        if (savedDocs?.length > 0 && isStateRecent) {
          setDocuments(savedDocs);
          if (savedFiltered?.length > 0) {
            setFilteredDocs(savedFiltered);
            if (savedQuery) setSearchQuery(savedQuery);
            if (savedActiveDoc) setActiveDoc(savedActiveDoc);
          } else {
            setFilteredDocs(savedDocs);
          }
          return true;
        }
      }
    } catch (e) {
      console.error('Error restoring search state:', e);
    }
    return false;
  }, []);

  // Fetch documents on component mount and set up real-time updates
  useEffect(() => {
    let isMounted = true;
    let pollInterval;

    const fetchDocuments = async () => {
      if (!isMounted) return;
      
      try {
        if (!hasInitialLoad) {
          setIsLoading(true);
        }
        
        // Always fetch fresh data
        const freshDocs = await documentService.getDocuments(api);
        if (!isMounted) return;
        
        // Sort documents by upload date (newest first)
        const sortedDocs = [...freshDocs].sort((a, b) => 
          new Date(b.uploadDate || b.createdAt) - new Date(a.uploadDate || a.createdAt)
        );
        
        setDocuments(sortedDocs);
        
        // If coming from "Chat with AI" with resetSearch, clear prior state and show all
        if (shouldReset) {
          try {
            sessionStorage.removeItem('documentSearchState');
          } catch {}
          try {
            localStorage.removeItem('lastViewedDocument');
          } catch {}
          setSearchQuery('');
          setActiveDoc(null);
          setFilteredDocs(sortedDocs);
          // Clear the flag from history state so refresh/back doesn't keep resetting
          navigate('/documents', { replace: true, state: {} });
          return;
        }
        
        // Check if we have a document in localStorage from chat navigation
        const lastViewedDoc = localStorage.getItem('lastViewedDocument');
        if (lastViewedDoc) {
          try {
            const parsedDoc = JSON.parse(lastViewedDoc);
            const existingDoc = sortedDocs.find(doc => 
              (doc._id || doc.id) === (parsedDoc._id || parsedDoc.id)
            );
            
            if (existingDoc) {
              setSearchQuery(existingDoc.originalName || existingDoc.filename || '');
              setFilteredDocs([existingDoc]);
              setActiveDoc(existingDoc);
              // Clear the stored document to avoid showing it again
              localStorage.removeItem('lastViewedDocument');
              return;
            }
          } catch (e) {
            console.error('Error processing last viewed document:', e);
          }
        }
        
        // If no specific document to show, use the current search query or show all
        if (searchQuery.trim()) {
          performSearch(searchQuery, sortedDocs);
        } else {
          setFilteredDocs(sortedDocs);
        }
        
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents. Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setHasInitialLoad(true);
        }
      }
    };
    
    // Initial fetch
    fetchDocuments();
    
    // Set up polling for real-time updates (every 30 seconds)
    pollInterval = setInterval(fetchDocuments, 30000);
    
    // Cleanup function
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      performSearch.cancel();
    };
  }, [api, performSearch, searchQuery, hasInitialLoad]);

  useEffect(() => {
    return () => {
      // Reset loading states when component unmounts
      setIsStartingChat(false);
      setActiveDoc(null);
    };
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  const handleChatWithDoc = useCallback(async (doc) => {
    try {
      setIsStartingChat(true);
      setActiveDoc(doc);
      
      // Save current state before navigation
      saveSearchState();
      
      // Store the document in localStorage for cross-tab persistence
      localStorage.setItem('lastViewedDocument', JSON.stringify(doc));
      
      // Wait for 1 second to show loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to chat with document ID
      navigate(`/chat/${doc._id || doc.id}`, { 
        state: { 
          document: doc,
          documents: documents,
          returnPath: '/documents' // Indicate where to return after chat
        } 
      });
      
    } catch (err) {
      console.error('Error starting chat:', err);
      setError('Failed to start chat. Please try again.');
    } finally {
      // Don't reset isStartingChat here to prevent UI flicker during navigation
      // It will be reset when the component unmounts or when the chat is loaded
    }
  }, [navigate, documents, saveSearchState]);

  // Download document as a blob and save with the correct filename
  const handleDownloadDocument = async (doc, e) => {
    try {
      e?.stopPropagation();
      const id = doc._id || doc.id;
      if (!id) return;
      // Backend route: GET /documents/download/:id
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
      setError('Failed to download document. Please try again.');
    }
  };

  // Highlight search matches in text
  const highlightMatch = (text) => {
    const trimmed = (searchQuery || '').trim();
    if (!trimmed) return text;
    let rx;
    try {
      rx = new RegExp(trimmed, 'gi');
    } catch (e) {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      rx = new RegExp(escaped, 'gi');
    }
    const parts = String(text).split(rx);
    const matches = String(text).match(rx);
    if (!matches) return text;
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      out.push(parts[i]);
      if (i < parts.length - 1) {
        out.push(<span key={`h-${i}`} className="highlight">{matches[i]}</span>);
      }
    }
    return out;
  };

  // Show loading state only on initial load
  // if (isLoading && !hasInitialLoad) {
  //   return (
  //     <div className="loading-container">
  //       <FiLoader className="spinner" style={{
  //         animation: 'spin 1s linear infinite',
  //         fontSize: '3rem',
  //         marginBottom: '1rem',
  //         color: '#4f46e5'
  //       }} />
  //       <h2 style={{
  //         fontSize: '1.5rem',
  //         fontWeight: '600',
  //         color: '#1f2937',
  //         marginBottom: '0.5rem'
  //       }}>Loading Documents</h2>
  //       <p style={{
  //         color: '#6b7280',
  //         maxWidth: '400px',
  //         lineHeight: '1.5'
  //       }}>Please wait while we load your documents. This may take a moment...</p>
  //     </div>
  //   );
  // }

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

  // Show loading skeleton while searching
  if (isSearching) {
    return (
      <div className="document-search">
        <header className="search-header">
          <button 
            onClick={handleBack} 
            className="back-btn"
            aria-label="Go back"
          >
            <FiArrowLeft size={18} />
            <span>Back</span>
          </button>
          <h1>Document Chat</h1>
        </header>
        
        <div className="search-box">
          <div className="search-input-wrapper">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search documents..."
              className="search-input"
              autoFocus
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={clearSearch}
                className="clear-btn"
                aria-label="Clear search"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>
        
        <div className="documents-list">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="document-card loading-skeleton">
              <div className="doc-icon">
                <FiFileText />
              </div>
              <div className="doc-details">
                <h3 className="doc-name skeleton-line"></h3>
                <div className="doc-meta">
                  <span className="skeleton-line" style={{width: '100px'}}></span>
                </div>
              </div>
            </div>
          ))}
        </div>
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

  // Format file size to human readable format
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, seconds] of Object.entries(intervals)) {
      const interval = Math.floor(diffInSeconds / seconds);
      if (interval >= 1) {
        return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
      }
    }
    
    return 'Just now';
  };

  if (isLoading) {
    return (
      <div className="loading-state">
        <FiLoader className="spinner" />
        <span>Loading documents...</span>
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

  return (
    <div className="document-search">
      <header className="search-header">
        <button 
          onClick={handleBack} 
          className="back-btn"
          aria-label="Go back"
        >
          <FiArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1>Document Chat</h1>
      </header>
      
      <div className="search-box">
        <div className="search-input-wrapper">
          {/* <FiSearch className="search-icon" /> */}
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search documents..."
            className="search-input"
            autoFocus
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={clearSearch}
              className="clear-btn"
              aria-label="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      <div className="documents-list">
        {filteredDocs.length === 0 ? (
          <div className="empty-state">
            <FiFileText className="empty-icon" />
            <h3>No documents found</h3>
            <p>{searchQuery ? 'Try a different search term' : 'Upload a document to get started'}</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
              <div 
                key={doc.id} 
                className={`document-card ${activeDoc?.id === doc.id ? 'active' : ''}`}
                onClick={() => handleDocumentClick(doc)}
              >
                <div className="doc-icon">
                  <FiFileText />
                </div>
                <div className="doc-details">
                  <h3 className="doc-name">
                    {doc.originalName || 'Untitled Document'}
                  </h3>
                  <div className="doc-meta">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>{doc.mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                    <span>{doc.uploadDate ? formatTimeAgo(doc.uploadDate) : 'Recently'}</span>
                  </div>
                </div>
                <div className="doc-actions">
                  <button 
                    className="btn"
                    onClick={(e) => handleDownloadDocument(doc, e)}
                  >
                    Download
                  </button>
                  <button 
                    className="btn primary"
                    onClick={() => handleChatWithDoc(doc)}
                    disabled={isStartingChat}
                  >
                    {isStartingChat && activeDoc?.id === (doc.id || doc._id) ? (
                      <>
                        <FiLoader className="spin" style={{ marginRight: '6px' }} />
                        Opening...
                      </>
                    ) : 'Chat'}
                  </button>
                </div>
              </div>
            ))
          )}
      </div>
    </div>
  );
};

export default DocumentSearch;
