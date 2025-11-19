import React from 'react';
import { FiArrowLeft, FiCode, FiDatabase, FiCpu, FiShield, FiUpload, FiSearch, FiMessageSquare } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import '../App.css';

const About = () => {
  const techStack = [
    { name: 'React', description: 'Frontend library for building user interfaces', icon: <FiCode className="tech-icon" /> },
    { name: 'Node.js', description: 'JavaScript runtime for server-side logic', icon: <FiCpu className="tech-icon" /> },
    { name: 'MongoDB', description: 'NoSQL database for storing documents and user data', icon: <FiDatabase className="tech-icon" /> },
    { name: 'Express', description: 'Web application framework for Node.js', icon: <FiCode className="tech-icon" /> },
    { name: 'LangChain', description: 'Document analysis and RAG framework', icon: <FiCpu className="tech-icon" /> }
  ];

  const features = [
    {
      icon: <FiUpload className="feature-icon" />,
      title: 'Easy Upload',
      description: 'Quickly upload your medical documents in various formats including PDF, DOCX, and TXT.'
    },
    {
      icon: <FiSearch className="feature-icon" />,
      title: 'Smart Search',
      description: 'Find important information in your documents with our intelligent search functionality.'
    },
    {
      icon: <FiMessageSquare className="feature-icon" />,
      title: 'AI-Powered Chat',
      description: 'Get instant answers to your questions about the document content.'
    }
  ];

  return (
    <div className="page-container">
      <div className="about-container">
        <Link to="/" className="back-button">
          <FiArrowLeft size={20} />
        </Link>
        
        <header className="about-header">
          <h1>About MediSum</h1>
          <p className="subtitle">Transforming Medical Documentation with AI</p>
        </header>

        <section className="about-section">
          <h2>Our Mission</h2>
          <p>
            MediSum is designed to help healthcare professionals and patients alike by providing quick, 
            accurate summaries of medical documents. Our AI-powered platform saves you time and helps 
            you focus on what matters most - patient care.
          </p>
        </section>

        <section className="about-section">
          <h2>How It Works</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon-container">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>Technology Stack</h2>
          <p>
            We've built MediSum using cutting-edge technologies to ensure reliability, 
            security, and performance:
          </p>
          <div className="tech-stack">
            {techStack.map((tech, index) => (
              <div key={index} className="tech-card">
                <div className="tech-icon-container">
                  {tech.icon}
                </div>
                <div>
                  <h3>{tech.name}</h3>
                  <p>{tech.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>Get Started</h2>
          <p>
            Ready to experience the future of medical documentation? Upload your first document 
            and see how MediSum can transform your workflow.
          </p>
          <Link to="/" className="cta-button">
            Upload a Document
          </Link>
        </section>
      </div>
    </div>
  );
};

export default About;
