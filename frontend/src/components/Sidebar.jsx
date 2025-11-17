import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiFileText, FiClock, FiUpload, FiHome, FiMessageSquare, FiDownload, FiFile } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import * as documentService from '../services/documentService';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const { api } = useAuth();

  useEffect(() => {
    const fetchRecentDocuments = async () => {
      try {
        const docs = await documentService.getDocuments(api);
        // Sort by most recent first and take the first 5
        const sortedDocs = [...docs]
          .sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt))
          .slice(0, 5);
        setRecentDocs(sortedDocs);
      } catch (error) {
        console.error('Error fetching recent documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentDocuments();
  }, [api]);

  const getFileIcon = (doc) => {
    const name = doc.originalName || doc.originalname || doc.filename || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return { Icon: FiFile, color: '#ef4444' };
    if (ext === 'doc' || ext === 'docx') return { Icon: FiFileText, color: '#2563eb' };
    if (ext === 'txt' || ext === 'md') return { Icon: FiFileText, color: '#10b981' };
    return { Icon: FiFile, color: '#6b7280' };
  };

  const formatFileSize = (bytes) => {
    if (bytes == null && bytes !== 0) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (doc, e) => {
    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const id = doc._id || doc.id;
      if (!id) return;
      // Backend route: GET /api/documents/download/:id (api instance has /api base)
      const response = await api.get(`/documents/download/${id}`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const filename = doc.originalName || doc.originalname || doc.filename || `document-${id}`;
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download document:', err);
      alert('Failed to download document. Please try again.');
    }
  };

  const navItems = [
    { to: '/', icon: <FiHome size={20} />, text: 'Home' },
    { to: '/upload', icon: <FiUpload size={20} />, text: 'Upload' },
    { to: '/documents', icon: <FiFileText size={20} />, text: 'All Documents' },
    { to: '/chat', icon: <FiMessageSquare size={20} />, text: 'Chat' },
  ];

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>Medical Summarizer</h3>
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-link ${location.pathname === item.to ? 'active' : ''}`}
            onClick={onClose}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.text}</span>
          </Link>
        ))}
      </nav>

      <div className="recent-docs">
        <h4><FiClock size={18} /> Recent Documents</h4>
        {loading ? (
          <div className="loading-docs">Loading...</div>
        ) : recentDocs.length > 0 ? (
          <ul className="doc-list">
            {recentDocs.map((doc) => {
              const displayName = doc.originalName || doc.originalname || doc.filename || 'Untitled';
              return (
                <li 
                  key={doc._id || doc.id} 
                  className="doc-item"
                  data-filetype={(doc.originalName || doc.originalname || doc.filename || '').split('.').pop().toLowerCase()}
                >
                  <Link to={`/documents/${doc._id || doc.id}`} onClick={onClose}>
                    {(() => { 
                      const { Icon, color } = getFileIcon(doc); 
                      return <Icon size={16} color={color} />; 
                    })()}
                    <span className="doc-name" title={displayName}>
                      {displayName.length > 25 ? `${displayName.substring(0, 22)}...` : displayName}
                    </span>
                    <span className="doc-size">
                      {doc.size != null ? formatFileSize(doc.size) : ''}
                    </span>
                  </Link>
                  <button
                    className="download-btn"
                    title="Download"
                    aria-label={`Download ${displayName}`}
                    onClick={(e) => handleDownload(doc, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}
                  >
                    <FiDownload size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="no-docs">No recent documents</p>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
