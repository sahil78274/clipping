// client/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Scissors,
  Film,
  Coins,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        {/* Brand */}
        <Link to="/" className="nav-brand">
          <div className="nav-brand-logo">
            <Scissors size={18} strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>CLIPPING</span>
            <span className="nav-tagline">Long Videos. Best Moments.</span>
          </div>
        </Link>

        {/* Links & Actions */}
        <div className="nav-links">
          {isAuthenticated ? (
            <>
              <Link
                to="/projects"
                className={`nav-link ${location.pathname === '/projects' ? 'active' : ''}`}
              >
                <Layers size={16} />
                <span>My Projects</span>
              </Link>

              <Link
                to="/clips"
                className={`nav-link ${location.pathname === '/clips' ? 'active' : ''}`}
              >
                <Film size={16} />
                <span>My Clips</span>
              </Link>

              <Link to="/credits" className="credit-badge" title="View credit details and buy packages">
                <Coins size={15} />
                <span>{user?.credits ?? 0} Credits</span>
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                  style={{ color: '#22C55E' }}
                >
                  <ShieldCheck size={16} />
                  <span>Admin</span>
                </Link>
              )}

              {/* User Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <UserIcon size={14} />
                  <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.name || 'Account'}
                  </span>
                  <ChevronDown size={14} />
                </button>

                {dropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      width: '180px',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 200,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {user?.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {user?.email}
                      </div>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <UserIcon size={14} />
                      Profile & Settings
                    </Link>

                    <Link
                      to="/credits"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Coins size={14} />
                      Credit Packages
                    </Link>

                    <button
                      onClick={handleLogout}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: 'var(--red-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left',
                        borderTop: '1px solid var(--border)',
                        background: 'none',
                        width: '100%',
                        cursor: 'pointer',
                      }}
                    >
                      <LogOut size={14} />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => openAuthModal('login')}
                className="btn btn-outline btn-sm"
              >
                Log In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="btn btn-primary btn-sm"
              >
                <Sparkles size={14} />
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
