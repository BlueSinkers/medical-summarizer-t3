import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLogOut, FiChevronDown, FiUser as FiUserIcon, FiInfo } from 'react-icons/fi';

const UserMenu = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await onLogout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleProfileClick = (e) => {
    e.preventDefault();
    setIsOpen(false);
    navigate('/profile');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (!user) return null;

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
                  referrerPolicy="no-referrer"
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
            {user.email && (
              <div className="user-email" title={user.email}>
                {user.email}
              </div>
            )}
          </div>
        </div>

        <div className="dropdown-divider"></div>

        <button className="dropdown-item" onClick={handleProfileClick}>
          <FiUser className="dropdown-icon" />
          <span>Profile</span>
        </button>

        <button
          className="dropdown-item"
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(false);
            navigate('/about');
          }}
        >
          <FiInfo className="dropdown-icon" />
          <span>About</span>
        </button>

        <div className="dropdown-divider"></div>

        <button className="dropdown-item danger" onClick={handleLogout} disabled={isLoggingOut}>
          <FiLogOut className="dropdown-icon" />
          <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
};

export default UserMenu;
