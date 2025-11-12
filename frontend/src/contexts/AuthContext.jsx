import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext();

// Create axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Set up axios interceptor for auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const userData = searchParams.get('user');

    if (token && userData) {
      const processOAuth = async () => {
        try {
          const user = JSON.parse(decodeURIComponent(userData));
          setUser(user);
          localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Redirect to home or stored redirect path
          const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectTo);
        } catch (err) {
          console.error('Error processing OAuth:', err);
          setError('Failed to process login. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      processOAuth();
    } else {
      setLoading(false);
    }
  }, [searchParams, navigate]);

  // Check if user is already logged in on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await api.get('/auth/me');
          if (response.data.user) {
            setUser(response.data.user);
          } else {
            // Invalid token, clear it
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/login', credentials);
      
      if (response.data.token) {
        setUser(response.data.user);
        localStorage.setItem('token', response.data.token);
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
        localStorage.removeItem('redirectAfterLogin');
        navigate(redirectTo);
        
        return { success: true };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed. Please check your credentials.'
      };
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/register', userData);
      
      if (response.data.token) {
        setUser(response.data.user);
        localStorage.setItem('token', response.data.token);
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/';
        localStorage.removeItem('redirectAfterLogin');
        navigate(redirectTo);
        
        return { success: true };
      }
    } catch (error) {
      console.error('Registration failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Registration failed. Please try again.' 
      };
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loginWithGoogle = useCallback(() => {
    // Store current path for redirect after login
    localStorage.setItem('redirectAfterLogin', window.location.pathname);
    // Redirect to Google OAuth
    window.location.href = 'http://localhost:3001/api/auth/google';
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call the logout endpoint
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
      // Even if the API call fails, we'll still clear the local state
    } finally {
      try {
        // Clear all auth-related data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Clear any stored redirect URLs
        localStorage.removeItem('redirectAfterLogin');
        
        // Clear axios default headers
        delete api.defaults.headers.common['Authorization'];
        
        // Clear cookies (if any)
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Clear user state
        setUser(null);
        
        // Force a hard refresh to ensure all state is cleared
        window.location.href = '/login';
      } catch (cleanupError) {
        console.error('Error during cleanup after logout:', cleanupError);
        // Still try to navigate to login even if cleanup fails
        window.location.href = '/login';
      }
    }
  }, [navigate]);

  const value = {
    user,
    loading,
    error,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    api, // Export the configured axios instance
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
