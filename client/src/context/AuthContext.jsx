// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('clipping_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('clipping_token') || null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' or 'signup'

  // Pending project data for unauthenticated users
  const [pendingProject, setPendingProject] = useState(() => {
    try {
      const stored = localStorage.getItem('clipping_pending_project');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  // Verify and refresh user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('clipping_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success && res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('clipping_user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.warn('Session check failed:', err.message);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('clipping_token', newToken);
      localStorage.setItem('clipping_user', JSON.stringify(newUser));
      setAuthModalOpen(false);
      return newUser;
    }
    throw new Error(res.data.message || 'Login failed');
  };

  const signup = async (name, email, password) => {
    const res = await api.post('/auth/signup', { name, email, password });
    if (res.data.success) {
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('clipping_token', newToken);
      localStorage.setItem('clipping_user', JSON.stringify(newUser));
      setAuthModalOpen(false);
      return newUser;
    }
    throw new Error(res.data.message || 'Signup failed');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('clipping_token');
    localStorage.removeItem('clipping_user');
  };

  const refreshUser = async () => {
    if (!token) return null;
    try {
      const res = await api.get('/auth/me');
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('clipping_user', JSON.stringify(res.data.user));
        return res.data.user;
      }
    } catch (e) {
      console.warn('Refresh user error:', e);
    }
    return null;
  };

  // Manage pending project data so non-logged-in users never lose their pasted URL
  const savePendingProject = (data) => {
    setPendingProject(data);
    localStorage.setItem('clipping_pending_project', JSON.stringify(data));
  };

  const clearPendingProject = () => {
    setPendingProject(null);
    localStorage.removeItem('clipping_pending_project');
  };

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
        pendingProject,
        savePendingProject,
        clearPendingProject,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
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
