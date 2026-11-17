// client/src/pages/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ShieldCheck,
  Users,
  Layers,
  Film,
  Coins,
  AlertTriangle,
  Search,
  PlusCircle,
  MinusCircle,
  Activity,
  Cpu,
  Database,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';

export default function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'projects' | 'transactions' | 'system'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');

  // Credit adjustment modal
  const [adjustModalUser, setAdjustModalUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes, projRes, txRes, sysRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
        api.get('/admin/projects'),
        api.get('/admin/transactions'),
        api.get('/admin/system-status'),
      ]);

      if (dashRes.data.success) setStats(dashRes.data.stats);
      if (usersRes.data.success) setUsers(usersRes.data.users);
      if (projRes.data.success) setProjects(projRes.data.projects);
      if (txRes.data.success) setTransactions(txRes.data.transactions);
      if (sysRes.data.success) setSystemStatus(sysRes.data.system);
    } catch (err) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const handleCreditAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModalUser) return;

    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) {
      alert('Please enter a valid non-zero credit amount.');
      return;
    }

    setAdjustLoading(true);

    try {
      const res = await api.patch(`/admin/users/${adjustModalUser._id}/credits`, {
        amount,
        reason: adjustReason.trim() || 'Admin manual credit adjustment',
      });

      if (res.data.success) {
        setNotification({
          type: 'success',
          message: `Credits for ${adjustModalUser.name} adjusted by ${amount > 0 ? '+' + amount : amount}.`,
        });
        setAdjustModalUser(null);
        setAdjustAmount('');
        setAdjustReason('');
        fetchAdminData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adjust credits.');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleToggleRole = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change ${targetUser.name}'s role to ${newRole.toUpperCase()}?`)) return;

    try {
      const res = await api.patch(`/admin/users/${targetUser._id}/role`, { role: newRole });
      if (res.data.success) {
        setNotification({ type: 'success', message: `Updated ${targetUser.name}'s role to ${newRole}.` });
        fetchAdminData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user role.');
    }
  };

  if (isLoading || (!isAdmin && !user)) {
    return <LoadingSpinner text="Checking administrative privileges..." />;
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="container" style={{ padding: '36px 20px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--green-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--green-accent)',
          }}
        >
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '24px' }}>CLIPPING Administration</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            System metrics, user credits management, project monitoring & AI engine health.
          </p>
        </div>
      </div>

      {notification.message && (
        <div
          className={`alert ${notification.type === 'error' ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: '24px' }}
        >
          {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification({ type: '', message: '' })}
            style={{ marginLeft: 'auto', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '12px',
          marginBottom: '28px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'overview', label: 'Overview Metrics', icon: Activity },
          { id: 'users', label: `Users (${users.length})`, icon: Users },
          { id: 'projects', label: `Projects (${projects.length})`, icon: Layers },
          { id: 'transactions', label: `Transactions (${transactions.length})`, icon: Coins },
          { id: 'system', label: 'Engine Health', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingSpinner text="Fetching admin metrics..." />
      ) : (
        <>
          {/* TAB 1: OVERVIEW METRICS */}
          {activeTab === 'overview' && stats && (
            <div>
              {/* KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '16px',
                  marginBottom: '32px',
                }}
              >
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    TOTAL USERS
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalUsers}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    TOTAL PROJECTS
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalProjects}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    CLIPS GENERATED
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green-accent)' }}>
                    {stats.totalClips}
                  </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    CREDITS ISSUED
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.creditsIssued}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    CREDITS CONSUMED
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#F59E0B' }}>
                    {stats.creditsConsumed}
                  </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    FAILED JOBS
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: stats.failedProjects > 0 ? 'var(--red-accent)' : 'var(--text-muted)' }}>
                    {stats.failedProjects}
                  </div>
                </div>
              </div>

              {/* Quick Jump Grid */}
              <div className="grid-2">
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px' }}>Recent Projects</h3>
                    <button onClick={() => setActiveTab('projects')} className="btn btn-outline btn-sm">
                      View All
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {projects.slice(0, 5).map((p) => (
                      <div
                        key={p._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: 'var(--bg-input)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            by {p.userId?.name || 'User'} &bull; {p.clipsCount || 0} clips
                          </div>
                        </div>
                        <span className={`badge ${p.status === 'completed' ? 'badge-green' : p.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px' }}>Engine Health Summary</h3>
                    <button onClick={() => setActiveTab('system')} className="btn btn-outline btn-sm">
                      Full Details
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Gemini AI Model:</span>
                      <span className="badge badge-green">{systemStatus?.gemini?.model || 'gemini-1.5-flash'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Gemini API Key:</span>
                      <span className={`badge ${systemStatus?.gemini?.isConfigured ? 'badge-green' : 'badge-amber'}`}>
                        {systemStatus?.gemini?.isConfigured ? 'Configured' : 'Fallback Engine Active'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>FFmpeg Video Processor:</span>
                      <span className="badge badge-green">Ready (9:16, 16:9, 1:1)</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Database:</span>
                      <span className="badge badge-green">Connected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '18px' }}>User Accounts ({filteredUsers.length})</h2>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 12px',
                    gap: '8px',
                    minWidth: '240px',
                  }}
                >
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>User</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Role</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Credits</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Projects</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Joined</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u._id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 600 }}>{u.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span className={`badge ${u.role === 'admin' ? 'badge-green' : 'badge-neutral'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--green-accent)' }}>
                            {u.credits}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            {u.projectsCount || 0}
                          </td>
                          <td style={{ padding: '12px 18px', color: 'var(--text-muted)' }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => setAdjustModalUser(u)}
                                className="btn btn-secondary btn-sm"
                                title="Add or deduct credits"
                              >
                                <Coins size={14} /> Adjust Credits
                              </button>
                              <button
                                onClick={() => handleToggleRole(u)}
                                className="btn btn-outline btn-sm"
                                title="Change role"
                              >
                                Toggle Role
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROJECTS OVERVIEW */}
          {activeTab === 'projects' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <h2 style={{ fontSize: '18px' }}>All Projects ({projects.length})</h2>
              </div>

              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Project</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>User</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Status</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Format</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Clips</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Created</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p._id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 600 }}>{p.title}</div>
                            {p.youtubeUrl && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.youtubeUrl}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                            {p.userId?.name || 'Unknown'}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span className={`badge ${p.status === 'completed' ? 'badge-green' : p.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            {p.settings?.format || '9:16'}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                            {p.clipsCount || 0}
                          </td>
                          <td style={{ padding: '12px 18px', color: 'var(--text-muted)' }}>
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <Link to={`/project/${p._id}`} className="btn btn-secondary btn-sm">
                              Inspect
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRANSACTIONS AUDIT */}
          {activeTab === 'transactions' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <h2 style={{ fontSize: '18px' }}>All Transactions ({transactions.length})</h2>
              </div>

              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Date & Time</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>User</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Type</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Description</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Amount</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx._id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 18px', color: 'var(--text-muted)' }}>
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                            {tx.userId?.name || 'User'}
                          </td>
                          <td style={{ padding: '12px 18px', textTransform: 'capitalize' }}>
                            {tx.type.replace('_', ' ')}
                          </td>
                          <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                            {tx.description}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 700, color: tx.amount > 0 ? 'var(--green-accent)' : 'var(--red-accent)' }}>
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                            {tx.balanceAfter}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM HEALTH */}
          {activeTab === 'system' && systemStatus && (
            <div className="grid-2">
              <div className="card">
                <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Gemini AI Configuration</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>API Status:</span>
                    <span className={`badge ${systemStatus.gemini.isConfigured ? 'badge-green' : 'badge-amber'}`}>
                      {systemStatus.gemini.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Configured Model:</span>
                    <span style={{ fontWeight: 600 }}>{systemStatus.gemini.model}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                    To configure your official Google Gemini API key, add <code>GEMINI_API_KEY=your_key</code> in <code>server/.env</code> and restart the server.
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>FFmpeg Video Engine</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Engine Status:</span>
                    <span className="badge badge-green">Operational</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subtitle Filters:</span>
                    <span>{systemStatus.ffmpeg.subtitles}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Supported Outputs:</span>
                    <span>{systemStatus.ffmpeg.videoFormats.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Adjust Credits Modal */}
      {adjustModalUser && (
        <div className="modal-overlay" onClick={() => setAdjustModalUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Adjust User Credits</h3>
              <button className="modal-close-btn" onClick={() => setAdjustModalUser(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '18px', padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{adjustModalUser.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{adjustModalUser.email}</div>
              <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--green-accent)' }}>
                Current Balance: <strong>{adjustModalUser.credits} Credits</strong>
              </div>
            </div>

            <form onSubmit={handleCreditAdjustment}>
              <div className="input-group">
                <label className="input-label">Credit Amount (+ to add, - to deduct)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="e.g. 50 or -20"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Reason / Internal Note</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Special promotion bonus"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAdjustModalUser(null)}
                  disabled={adjustLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjustLoading}>
                  {adjustLoading ? 'Updating...' : 'Apply Credit Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
