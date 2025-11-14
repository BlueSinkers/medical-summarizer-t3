import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiFileText, FiClock, FiUpload, FiHome, FiMessageSquare, FiDownload } from 'react-icons/fi';
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
          .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
          .slice(0, 5);
        setRecentDocs(sortedDocs);
      } catch (error) {
        console.error('Error fetching recent documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentDocuments();
  }, []);

  const handleDownload = async (doc, e) => {
    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const id = doc._id || doc.id;
      if (!id) return;
      const response = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
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
                <li key={doc._id || doc.id} className="doc-item">
                  <Link to={`/documents/${doc._id || doc.id}`} onClick={onClose}>
                    <FiFileText size={16} />
                    <span className="doc-name" title={displayName}>
                      {displayName.length > 20 ? `${displayName.substring(0, 20)}...` : displayName}
                    </span>
                    <span className="doc-date">
                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
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
