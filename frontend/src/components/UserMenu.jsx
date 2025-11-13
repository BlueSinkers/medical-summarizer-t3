import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLogOut, FiChevronDown, FiUser as FiUserIcon } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';

const UserMenu = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside or when sidebar is toggled
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Close dropdown when clicking on sidebar toggle
    const handleSidebarToggle = () => {
      setIsOpen(false);
    };

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    
    // Listen for sidebar toggle events
    const sidebarToggles = document.querySelectorAll('.sidebar-toggle, .hamburger-menu');
    sidebarToggles.forEach(toggle => {
      toggle.addEventListener('click', handleSidebarToggle);
    });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      sidebarToggles.forEach(toggle => {
        toggle.removeEventListener('click', handleSidebarToggle);
      });
    };
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      console.log('Initiating logout...');
      await onLogout();
      console.log('Logout successful, redirecting...');
      // Force a hard redirect to ensure all state is cleared
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, redirect to login
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleProfileClick = (e) => {
    e.preventDefault();
    setIsOpen(false);
    navigate('/profile'); // Assuming you have a profile route
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (!user) return null;

  // Handle avatar image error
  const handleImageError = (e) => {
    const img = e.target;
    const fallback = img.nextElementSibling;
    if (fallback && fallback.classList.contains('avatar-fallback')) {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    }
  };

  return (
    <div className="user-menu" ref={dropdownRef}>
      <button 
        className="user-menu-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User menu"
        type="button"
      >
        <div className="user-avatar">
          {user.picture ? (
            <>
              <img 
                src={user.picture} 
                alt={user.name || 'User'} 
                className="avatar-image" 
                onError={handleImageError}
                referrerPolicy="no-referrer"
              />
              {user.picture.includes('googleusercontent')}
            </>
          ) : (
            <div className="avatar-fallback">
              {user.name ? getInitials(user.name) : <FiUserIcon />}
            </div>
          )}
        </div>
        <div className="user-info">
          <span className="user-name" title={user.name}>
            {user.name || 'User'}
          </span>
        </div>
        <FiChevronDown className={`dropdown-icon ${isOpen ? 'open' : ''}`} />
      </button>
      
      <div className={`dropdown-menu ${isOpen ? 'open' : ''}`}>
        <div className="dropdown-header">
          <div className="user-avatar large">
            {user.picture ? (
              <>
                <img 
                  src={user.picture} 
                  alt={user.name || 'User'} 
                  className="avatar-image"
                  onError={handleImageError}
                />
                <div className="avatar-fallback" style={{ display: 'none' }}>
                  {user.name ? getInitials(user.name) : <FiUserIcon />}
                </div>
              </>
            ) : (
              <div className="avatar-fallback">
                {user.name ? getInitials(user.name) : <FiUserIcon />}
              </div>
            )}
          </div>
          <div className="user-details">
            <div className="user-name">{user.name || 'User'}</div>
            <div className="user-email" title={user.email}>
              {user.email || ''}
            </div>
          </div>
        </div>
        
        <div className="dropdown-divider"></div>
        
        <button 
          className="dropdown-item"
          onClick={handleProfileClick}
          aria-label="View profile"
        >
          <FiUser className="dropdown-icon" />
          <span>Profile</span>
        </button>
        
        <button 
          className="dropdown-item"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Log out"
        >
          <FiLogOut className="dropdown-icon" />
          <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
        </button>
      </div>
    </div>
  );
};

export default UserMenu;
