import { useState, useRef, useEffect, useCallback } from 'react';
import { FiSend, FiFileText, FiX, FiLoader, FiMessageSquare, FiFile, FiArrowLeft } from 'react-icons/fi';

const DocumentChat = ({ document, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: `Hello! I can help you with the document "${document?.originalName || document?.originalname || 'this document'}". What would you like to know?`, 
      sender: 'ai',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Generate summary when switching to summary tab if not already generated
  useEffect(() => {
    if (activeTab === 'summary' && !summary) {
      generateSummary();
    }
  }, [activeTab]);
  
  const generateSummary = async () => {
    if (summary) return;
    
    try {
      setIsGeneratingSummary(true);
      setError(null);
      
      // Simulate API call to generate summary
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, you would call your backend API here:
      // const response = await api.post(`/documents/${document.id}/summarize`);
      // setSummary(response.data.summary);
      
      // For demo purposes, we'll use a mock summary
      setSummary(
        `This is a summary of the document "${document?.originalName || document?.originalname || 'your document'}". ` +
        "The document appears to be a medical record containing patient information, diagnosis, and treatment details. " +
        "Key points include the patient's medical history, current condition, prescribed medications, and recommended follow-up care. " +
        "The document is well-structured with clear sections for different aspects of the patient's care."
      );
    } catch (err) {
      console.error('Error generating summary:', err);
      setError('Failed to generate summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // Show loading for at least 1 second
    const timer = setTimeout(() => {
      setIsLoading(false);
      setShowContent(true);
      scrollToBottom();
    }, 1000);

    return () => clearTimeout(timer);
  }, [scrollToBottom]);

  if (isLoading || !showContent) {
    return (
      <div className="document-chat-loading">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading chat interface...</p>
        </div>
      </div>
    );
  }

  const handleSend = async (e) => {
    e.preventDefault();
    const userInput = input.trim();
    if (!userInput || isSending) return;

    try {
      setIsSending(true);
      // Add user message
      const userMessage = { 
        id: Date.now(), 
        text: userInput, 
        sender: 'user',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setError(null);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate context-aware mock response
      const lowerInput = userInput.toLowerCase();
      let responseText = '';
      
      // Check for common medical queries
      if (lowerInput.includes('diagnos') || lowerInput.includes('condition')) {
        responseText = `Based on the document, the primary diagnosis appears to be related to a cardiovascular condition. The patient shows symptoms including elevated blood pressure and increased heart rate.`;
      } 
      else if (lowerInput.includes('treatment') || lowerInput.includes('medication')) {
        responseText = `The document outlines a treatment plan that includes medication management with beta-blockers and lifestyle modifications. The patient is advised to maintain a low-sodium diet and engage in regular physical activity.`;
      }
      else if (lowerInput.includes('history') || lowerInput.includes('background')) {
        responseText = `The patient has a medical history that includes hypertension and hyperlipidemia. There's a family history of cardiovascular disease. Previous treatments include statin therapy and dietary adjustments.`;
      }
      else if (lowerInput.includes('follow') || lowerInput.includes('next') || lowerInput.includes('appointment')) {
        responseText = `The next follow-up is scheduled for 4 weeks from the last visit. The patient is advised to return sooner if symptoms worsen or if they experience any chest pain, shortness of breath, or dizziness.`;
      }
      else if (lowerInput.includes('risk') || lowerInput.includes('complication')) {
        responseText = `The patient has moderate cardiovascular risk factors including age, family history, and current lipid profile. The document notes the importance of monitoring blood pressure and cholesterol levels regularly.`;
      }
      else {
        // Default response for other queries
        responseText = `I've reviewed the document regarding your query about "${userInput}". The information suggests that this is a matter that should be discussed with your healthcare provider for personalized medical advice.`;
      }

      const aiMessage = {
        id: Date.now() + 1,
        text: responseText,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        context: document?.originalName || document?.originalname || 'Current Document'
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
      
      const errorMessage = {
        id: Date.now() + 1,
        text: 'I apologize, but I encountered an issue processing your request. This appears to be a mock implementation. In a production environment, this would connect to a medical AI service.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`chat-container ${showContent ? 'content-visible' : ''}`}>
      <div className="chat-header">
        <div className="header-left">
          <button className="back-button" onClick={onClose} aria-label="Go back">
            <FiArrowLeft size={20} />
          </button>
          <div className="document-info">
            <FiFileText className="document-icon" />
            <h3>{document?.originalName || document?.originalname || 'Document'}</h3>
          </div>
        </div>
        <button 
          className="close-chat" 
          onClick={onClose}
          aria-label="Close chat"
          title="Close chat"
        >
          <FiX size={20} />
        </button>
      </div>
      
      <div className="chat-tabs">
        <button
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <FiMessageSquare size={16} /> Chat
        </button>
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <FiFile size={16} /> Summary
        </button>
      </div>
      
      {activeTab === 'chat' ? (
        <>
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
        </>
      ) : (
        <div className="summary-container">
          {isGeneratingSummary ? (
            <div className="loading-summary">
              <FiLoader className="spinner" />
              <p>Generating summary...</p>
            </div>
          ) : error ? (
            <div className="error-summary">
              <p>{error}</p>
              <button 
                className="btn primary" 
                onClick={generateSummary}
                disabled={isGeneratingSummary}
              >
                {isGeneratingSummary ? 'Generating...' : 'Retry'}
              </button>
            </div>
          ) : (
            <div className="summary-content">
              <h3>Document Summary</h3>
              <div className="summary-text">
                {summary || 'No summary available. Please try generating one.'}
              </div>
              <div className="summary-actions">
                <button 
                  className="btn primary" 
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                >
                  {isGeneratingSummary ? 'Regenerating...' : 'Regenerate Summary'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
