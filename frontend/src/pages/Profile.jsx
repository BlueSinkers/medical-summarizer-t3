import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiMail, FiCalendar, FiEdit2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import '../App.css';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading user data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const initials = useMemo(() => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, [user?.name]);

  if (isLoading) {
    return (
      <div className="chat-page loading-state">
        <div className="loading-container">
          <div className="spinner">
            <FiUser size={32} className="spin" />
          </div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page content-visible" style={{ paddingTop: '3rem' }}>
      <div className="chat-container" style={{ maxWidth: 720 }}>
        <div className="chat-header">
          <button 
            onClick={() => navigate(-1)} 
            className="back-btn"
            aria-label="Go back"
            type="button"
          >
            <FiArrowLeft size={18} />
            <span style={{ marginLeft: 6 }}>Back</span>
          </button>
          <h3>Profile</h3>
          <div style={{ width: 32 }} />
        </div>
        <div className="messages-container" style={{ maxHeight: 'unset' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user?.name || 'User'}
                  referrerPolicy="no-referrer"
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '999px',
                    objectFit: 'cover',
                    border: '1px solid #e5e7eb',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '999px',
                    background: '#eef2ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                    border: '1px solid #e5e7eb',
                  }}
                  aria-label="User initials"
                >
                  {initials}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                {user?.name || 'User'}
              </div>
              {user?.email && (
                <div style={{ color: '#6b7280', marginTop: 4 }}>{user.email}</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: '0.75rem', columnGap: '1rem' }}>
              <div style={{ color: '#6b7280' }}>Name</div>
              <div style={{ color: '#111827' }}>{user?.name || '-'}</div>

              <div style={{ color: '#6b7280' }}>Email</div>
              <div style={{ color: '#111827' }}>{user?.email || '-'}</div>

              <div style={{ color: '#6b7280' }}>Verified</div>
              <div style={{ color: '#111827' }}>{user?.isVerified ? 'Yes' : 'No'}</div>

              <div style={{ color: '#6b7280' }}>User ID</div>
              <div style={{ color: '#111827', wordBreak: 'break-all' }}>{user?.id || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
