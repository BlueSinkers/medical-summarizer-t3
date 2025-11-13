import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiFileText, FiClock, FiUpload, FiHome, FiMessageSquare } from 'react-icons/fi';
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
            {recentDocs.map((doc) => (
              <li key={doc._id} className="doc-item">
                <Link to={`/documents/${doc._id}`} onClick={onClose}>
                  <FiFileText size={16} />
                  <span className="doc-name" title={doc.originalname}>
                    {doc.originalname.length > 20 
                      ? `${doc.originalname.substring(0, 20)}...` 
                      : doc.originalname}
                  </span>
                  <span className="doc-date">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-docs">No recent documents</p>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
