import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import '../App.css';

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  // Check for OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const userData = searchParams.get('user');
    const error = searchParams.get('error');

    if (error) {
      setError(error === 'auth_failed' 
        ? 'Authentication failed. Please try again.' 
        : 'An error occurred during login.');
      return;
    }

    if (token && userData) {
      const handleOAuthCallback = async () => {
        try {
          setLoading(true);
          const user = JSON.parse(decodeURIComponent(userData));
          login({ user, token });
          navigate('/');
        } catch (err) {
          console.error('Error processing OAuth callback:', err);
          setError('Failed to process login. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      handleOAuthCallback();
    }
  }, [navigate, searchParams, login]);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/auth/me', {
          credentials: 'include',
        });
        if (response.ok) {
          const userData = await response.json();
          if (userData.user) {
            login({ user: userData.user });
            navigate('/');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };

    checkAuth();
  }, [navigate, login]);

  const handleGoogleLogin = () => {
    setLoading(true);
    setError('');
    window.location.href = 'http://localhost:3001/api/auth/google';
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h2>Welcome to Medical Summarizer</h2>
          <p>Please sign in to continue</p>
        </div>
        
        {error && (
          <div className="error-message">
            <FiAlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        
        <button 
          onClick={handleGoogleLogin} 
          className="google-login-btn"
          disabled={loading}
        >
          {loading ? (
            <div className="spinner"></div>
          ) : (
            <>
              <FcGoogle size={20} />
              <span>Continue with Google</span>
            </>
          )}
        </button>
        
        <div className="login-footer">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
