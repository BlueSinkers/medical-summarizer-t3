import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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

// Add response interceptor to handle 401 responses
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Clear user data on 401
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Check if user is authenticated
  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return null;
      }

      const response = await api.get('/auth/me');
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        await checkAuth();
      } else {
        setLoading(false);
      }
    };
    initAuth();
  }, [checkAuth]);

  
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
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        console.log('Checking auth with token:', token);
        // Set the authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Try to fetch user data
        console.log('Sending request to /auth/me');
        const response = await api.get('/auth/me');
        console.log('Auth response:', response.data);
        
        if (response.data.name) {
          console.log('User authenticated:', response.data.email);
          setUser({
            name: response.data.name,
            email: response.data.email,
            picture: response.data.picture,
            id: response.data.id,
            isVerified: response.data.isVerified
          });
        } else {
          console.error('No user data in response');
          throw new Error('No user data received');
        }
      } catch (error) {
        console.error('Auth check failed:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });
        // Only clear token if it's an auth error
        if (error.response && error.response.status === 401) {
          console.log('Clearing invalid token');
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, token } = response.data;
      
      // Store token and update auth headers
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update user state
      setUser(user);
      setError(null);
      
      // Always redirect to home page after login
      navigate('/', { replace: true });
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(message);
      return { success: false, message };
    }
  }, [navigate, location.state?.from?.pathname]); 
  
  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/register', userData);
      
      if (response.data.token) {
        const userData = response.data.user || response.data;
        setUser({
          name: userData.name,
          email: userData.email,
          picture: userData.picture,
          id: userData.id || userData._id,
          isVerified: userData.isVerified || false
        });
        
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
    checkAuth,
    isAuthenticated: !!user
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
