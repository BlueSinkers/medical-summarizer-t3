import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as documentService from '../services/documentService';
import DocumentChat from '../components/DocumentChat';
import { FiLoader } from 'react-icons/fi';

const ChatPage = () => {
  const { documentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { api } = useAuth();

  const [document, setDocument] = useState(location.state?.document || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let loadingTimer;
    const MIN_LOADING_TIME = 1000; // 1 second minimum loading time
    const startTime = Date.now();

    const fetchDocument = async () => {
      try {
        if (!document && documentId) {
          const docs = await documentService.getDocuments(api);
          if (!isMounted) return;
          const found = docs.find(d => (d._id || d.id)?.toString() === documentId);
          if (found) setDocument(found);
          else setError('Document not found');
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load document for chat.');
        }
      } finally {
        if (isMounted) {
          // Calculate remaining time to ensure minimum loading time
          const elapsed = Date.now() - startTime;
          const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsed);
          
          loadingTimer = setTimeout(() => {
            if (isMounted) {
              setShowContent(true);
              setIsLoading(false);
            }
          }, remainingTime);
        }
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
      clearTimeout(loadingTimer);
    };
  }, [api, document, documentId]);

  if (isLoading || !showContent) {
    return (
      <div className="chat-page loading-state">
        <div className="loading-container">
          <div className="spinner">
            <FiLoader className="spin" size={32} />
          </div>
          <p>Loading your chat...</p>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    const returnPath = location.state?.returnPath || '/documents';
    navigate(returnPath);
  };

  if (error) {
    return (
      <div className="chat-page error-state content-visible">
        <p className="error-message">{error}</p>
        <button onClick={handleClose} className="btn">
          Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="chat-page content-visible">
      {document ? (
        <DocumentChat document={document} onClose={handleClose} />
      ) : (
        <div className="no-document">
          <p>No document selected</p>
          <button onClick={handleClose} className="btn">
            Back to Documents
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
