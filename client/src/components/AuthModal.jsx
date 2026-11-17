// client/src/components/AuthModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Sparkles, LogIn, AlertCircle } from 'lucide-react';

export default function AuthModal({ onSuccess }) {
  const { authModalOpen, authModalMode, closeAuthModal, openAuthModal, login, signup, pendingProject } = useAuth();
  const [isLogin, setIsLogin] = useState(authModalMode === 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync mode state when modal opens
  React.useEffect(() => {
    setIsLogin(authModalMode === 'login');
    setError('');
  }, [authModalMode, authModalOpen]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeAuthModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--green-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--green-accent)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <h3 className="modal-title">
              {isLogin ? 'Log In to CLIPPING' : 'Create Free Account'}
            </h3>
          </div>
          <button className="modal-close-btn" onClick={closeAuthModal}>
            <X size={18} />
          </button>
        </div>

        {pendingProject && (
          <div className="alert alert-success" style={{ fontSize: '13px', marginBottom: '16px' }}>
            <span>Your video link has been preserved and will be analyzed immediately upon login.</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              'Processing...'
            ) : isLogin ? (
              <>
                <LogIn size={16} /> Log In & Continue
              </>
            ) : (
              <>
                <Sparkles size={16} /> Claim 20 Free Credits & Start
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                }}
                style={{ color: 'var(--green-accent)', fontWeight: 600 }}
              >
                Sign up free (20 credits)
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
                style={{ color: 'var(--green-accent)', fontWeight: 600 }}
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
