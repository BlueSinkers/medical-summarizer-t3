import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import '../App.css';

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, checkAuth } = useAuth();

  // Check for session expiration message
  useEffect(() => {
    const sessionExpired = location.state?.sessionExpired;
    if (sessionExpired) {
      setError('Your session has expired. Please log in again.');
    }

    // Check if there's a redirect URL in the query params
    const redirect = searchParams.get('redirect');
    if (redirect && !location.state?.from) {
      navigate(location.pathname, {
        state: { from: { pathname: decodeURIComponent(redirect) } },
        replace: true
      });
    }
  }, [location, navigate, searchParams]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        // Check if we need to redirect after login
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth login
  const handleGoogleLogin = () => {
    const currentPath = window.location.pathname + window.location.search;
    localStorage.setItem('redirectAfterLogin', currentPath);
    window.location.href = 'http://localhost:3001/api/auth/google';
  };

  // Check for OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const userData = searchParams.get('user');
    const error = searchParams.get('error');

    if (error) {
      setError(
        error === 'auth_failed' 
          ? 'Authentication failed. Please try again.' 
          : 'An error occurred during login.'
      );
      setLoading(false);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (token && userData) {
      const handleOAuthCallback = async () => {
        try {
          setLoading(true);
          const user = JSON.parse(decodeURIComponent(userData));
          
          // Store the token and user data
          localStorage.setItem('token', token);
          
          // Update auth context
          await checkAuth();
          
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Redirect to home or intended path
          const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectTo, { replace: true });
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

  // const handleGoogleLogin = () => {
  //   setLoading(true);
  //   setError('');
  //   window.location.href = 'http://localhost:3001/api/auth/google';
  // };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h2 style={{ fontSize: '3rem', fontWeight: '700', background: 'linear-gradient(90deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block' }}>MediSum</h2>
          
          {/* <p style={{ fontSize: '1rem', fontWeight: '500', color: '#666' }}>Please sign in to continue</p> */}
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
              <span>Sign in/Sign up with Google</span>
            </>
          )}
        </button>
        
        <div className="login-footer">
          <p style={{ fontSize: '0.8rem', fontWeight: '500', color: '#666' }}>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
