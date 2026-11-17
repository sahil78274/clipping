// client/src/pages/ProjectsPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Layers,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Search,
  Calendar,
  Clock,
  Film,
  AlertCircle,
} from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      if (res.data.success) {
        setProjects(res.data.projects || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project and all its generated clips?')) {
      return;
    }

    try {
      const res = await api.delete(`/projects/${projectId}`);
      if (res.data.success) {
        setProjects((prev) => prev.filter((p) => p._id !== projectId));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const filteredProjects = projects.filter((p) =>
    (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.youtubeUrl || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container" style={{ padding: '36px 20px 80px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', marginBottom: '6px' }}>My Projects</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Manage all your video clipping jobs and exported moments.
          </p>
        </div>

        <Link to="/" className="btn btn-primary">
          <Plus size={16} />
          Create New Project
        </Link>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ marginBottom: '24px', maxWidth: '400px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            gap: '8px',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading projects..." />
      ) : filteredProjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Layers size={44} color="var(--text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
            {search ? 'No matching projects found' : 'No projects yet'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
            {search
              ? 'Try changing your search keywords.'
              : 'Paste a YouTube video link on the homepage to generate your first AI video clips.'}
          </p>
          {!search && (
            <Link to="/" className="btn btn-primary">
              <Plus size={16} /> Create First Project
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredProjects.map((p) => (
            <div
              key={p._id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  {(p.status === 'Completed' || p.status === 'completed') && <span className="badge badge-green">Completed</span>}
                  {(p.status === 'Failed' || p.status === 'failed') && <span className="badge badge-red">Failed</span>}
                  {(p.status === 'Processing' || p.status === 'analyzing' || p.status === 'generating') && (
                    <span className="badge badge-amber">Processing ({p.progress}%)</span>
                  )}
                  {(p.status === 'Queued' || p.status === 'waiting') && (
                    <span className="badge badge-neutral">Queued</span>
                  )}

                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 style={{ fontSize: '16px', marginBottom: '8px', lineHeight: 1.3 }}>
                  <Link to={`/project/${p._id}`} style={{ color: 'var(--text-primary)' }}>
                    {p.title}
                  </Link>
                </h3>

                {p.youtubeUrl && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginBottom: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.youtubeUrl}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: '18px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Film size={14} color="var(--green-accent)" />
                    {p.clipsCount || 0} Clips
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    {Math.round(p.videoDuration || 0)}s
                  </span>
                  <span>{p.settings?.format || '9:16'}</span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '14px',
                }}
              >
                <Link
                  to={`/project/${p._id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                >
                  View Clips
                </Link>

                <button
                  onClick={() => handleDelete(p._id)}
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--red-accent)' }}
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
