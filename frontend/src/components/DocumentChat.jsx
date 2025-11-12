import { useState, useRef, useEffect, useCallback } from 'react';
import { FiSend, FiFileText, FiX, FiLoader } from 'react-icons/fi';

const DocumentChat = ({ document, onClose }) => {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: `Hello! I can help you with the document "${document?.originalname || 'this document'}". What would you like to know?`, 
      sender: 'ai',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (e) => {
    e.preventDefault();
    const userInput = input.trim();
    if (!userInput || isLoading) return;

    try {
      // Add user message
      const userMessage = { 
        id: Date.now(), 
        text: userInput, 
        sender: 'user',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      // Here you would typically make an API call to your backend
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulated response - replace with actual API call
      const response = {
        text: `I understand you're asking about "${userInput}". In a real implementation, this would be the AI's response based on the document content.`,
        documentContext: document?.id || 'current-document'
      };

      const aiMessage = {
        id: Date.now() + 1,
        text: response.text,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        context: response.documentContext
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
      
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="document-info">
          <FiFileText size={18} className="document-icon" />
          <div className="document-details">
            <h3>{document?.originalname || 'Document'}</h3>
            <span className="document-meta">
              {document?.mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}
              {document?.size && ` • ${formatFileSize(document.size)}`}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="close-chat" 
          aria-label="Close chat"
          title="Close chat"
        >
          <FiX size={20} />
        </button>
      </div>
      
      <div className="messages-container">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.sender} ${message.isError ? 'error' : ''}`}
            title={new Date(message.timestamp).toLocaleString()}
          >
            <div className="message-content">
              {message.text}
              {message.sender === 'ai' && message.context && (
                <div className="message-context" title="Document context">
                  <FiFileText size={12} /> {message.context}
                </div>
              )}
            </div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message ai">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSend} className="chat-input-container">
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this document..."
            disabled={isLoading}
            aria-label="Type your message"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className={`send-button ${isLoading ? 'loading' : ''}`}
            aria-label="Send message"
          >
            {isLoading ? <FiLoader className="spinner" /> : <FiSend size={18} />}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default DocumentChat;
