import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as documentService from '../services/documentService';
import DocumentChat from '../components/DocumentChat';

const ChatPage = () => {
  const { documentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { api } = useAuth();

  const [document, setDocument] = useState(location.state?.document || null);
  const [isLoading, setIsLoading] = useState(!location.state?.document);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchDocument = async () => {
      if (document || !documentId) return;
      try {
        setIsLoading(true);
        const docs = await documentService.getDocuments(api);
        if (!isMounted) return;
        const found = docs.find(d => (d._id || d.id)?.toString() === documentId);
        if (found) {
          setDocument(found);
        } else {
          setError('Document not found');
        }
      } catch (err) {
        console.error('Error loading document for chat:', err);
        if (isMounted) {
          setError('Failed to load document for chat.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
    };
  }, [api, document, documentId]);

  const handleClose = () => {
    const returnPath = location.state?.returnPath || '/documents';
    navigate(returnPath);
  };

  if (isLoading) {
    return (
      <div className="chat-page loading-state">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="chat-page">
        <div className="chat-container">
          <div className="chat-header">
            <h3>Document Chat</h3>
          </div>
          <div className="messages-container empty">
            <p>{error || 'No document selected for chat.'}</p>
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate('/documents')}
            >
              Back to Documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <DocumentChat document={document} onClose={handleClose} />
    </div>
  );
};

export default ChatPage;
