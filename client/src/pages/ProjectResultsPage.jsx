// client/src/pages/ProjectResultsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EditClipModal from '../components/EditClipModal';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Download,
  FolderArchive,
  RefreshCw,
  Trash2,
  Sliders,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  FileVideo,
  Clock,
} from 'lucide-react';

export default function ProjectResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingClip, setEditingClip] = useState(null);

  const pollIntervalRef = useRef(null);

  const fetchProjectData = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      if (res.data.success) {
        setProject(res.data.project);
        setClips(res.data.clips || []);

        const status = (res.data.project.status || '').toLowerCase();
        if (status === 'completed' || status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch project details');
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();

    pollIntervalRef.current = setInterval(fetchProjectData, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [id]);

  const handleRetry = async () => {
    try {
      setLoading(true);
      const res = await api.post(`/projects/${id}/retry`);
      if (res.data.success) {
        fetchProjectData();
        pollIntervalRef.current = setInterval(fetchProjectData, 2000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to retry project.');
      setLoading(false);
    }
  };

  const handleDeleteClip = async (clipId) => {
    if (!window.confirm('Are you sure you want to delete this clip?')) return;
    try {
      const res = await api.delete(`/clips/${clipId}`);
      if (res.data.success) {
        setClips((prev) => prev.filter((c) => c._id !== clipId));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete clip.');
    }
  };

  const handleClipRerendered = (updatedClip) => {
    setClips((prev) => prev.map((c) => (c._id === updatedClip._id ? updatedClip : c)));
  };

  if (loading && !project) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <LoadingSpinner text="Loading video project..." />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div className="alert alert-error" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/projects" className="btn btn-secondary">
            <ArrowLeft size={16} /> Return to My Projects
          </Link>
        </div>
      </div>
    );
  }

  const statusLower = (project?.status || '').toLowerCase();
  const isQueued = statusLower === 'queued' || statusLower === 'waiting';
  const isProcessing = statusLower === 'processing' || statusLower === 'analyzing' || statusLower === 'generating';
  const isCompleted = statusLower === 'completed';
  const isFailed = statusLower === 'failed';

  return (
    <div className="container" style={{ padding: '36px 20px 80px' }}>
      {/* Top back button & header */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '14px',
          }}
        >
          <ArrowLeft size={14} /> Back to My Projects
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '24px' }}>{project?.title}</h1>
              {isCompleted && <span className="badge badge-green">Completed</span>}
              {isFailed && <span className="badge badge-red">Failed</span>}
              {isProcessing && <span className="badge badge-amber">Processing</span>}
              {isQueued && <span className="badge badge-neutral">Queued</span>}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {project?.youtubeUrl && (
                <span style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Source: {project.youtubeUrl}
                </span>
              )}
              <span>Format: {project?.settings?.format || '9:16'}</span>
              <span>Captions: {project?.settings?.captions ? 'Enabled' : 'Disabled'}</span>
              <span>Duration: {Math.round(project?.videoDuration || 0)}s</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {isCompleted && clips.length > 0 && (
              <a
                href={`/api/clips/download-all/${project._id}`}
                className="btn btn-primary"
                download
              >
                <FolderArchive size={16} />
                Download All (ZIP)
              </a>
            )}

            {isFailed && (
              <button onClick={handleRetry} className="btn btn-primary">
                <RefreshCw size={16} />
                Retry Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Processing Card */}
      {(isQueued || isProcessing) && (
        <div className="card pulse-generating" style={{ marginBottom: '32px', border: '1px solid var(--green-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: 'var(--green-accent)',
                  boxShadow: '0 0 10px #22C55E',
                }}
              />
              <span style={{ fontWeight: 600, fontSize: '15px' }}>
                {project.currentStep || 'Processing video moments...'}
              </span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green-accent)' }}>
              {project.progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                width: `${project.progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #16A34A 0%, #22C55E 100%)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Analyzing audio/scene transitions and rendering actual MP4 clips using FFmpeg. Progress updates automatically.
          </div>
        </div>
      )}

      {/* Failure state notice */}
      {isFailed && (
        <div className="alert alert-error" style={{ marginBottom: '28px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600 }}>Video processing failed</div>
            <div style={{ fontSize: '13px', marginTop: '2px' }}>
              {project.errorMessage || 'An error occurred while analyzing or rendering clips. Any reserved credits have been refunded.'}
            </div>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '18px' }}>
          Generated Clips ({clips.length})
        </h2>
        {isCompleted && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Rendered in {project.settings.format} MP4 format
          </span>
        )}
      </div>

      {/* Clips Grid */}
      {clips.length === 0 && !isProcessing && !isQueued ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <FileVideo size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>No clips available</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
            {isFailed
              ? 'This project encountered an error. Check the error message above or retry with an authorized video.'
              : 'Clips will appear here once rendering is complete.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {clips.map((clip) => (
            <div
              key={clip._id}
              className="card"
              style={{
                padding: '0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Video Player */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: clip.format === '9:16' ? '9/16' : clip.format === '1:1' ? '1/1' : '16/9',
                  maxHeight: '440px',
                  background: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <video
                  src={clip.videoUrl}
                  poster={clip.thumbnailUrl || undefined}
                  controls
                  preload="metadata"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    background: '#000000',
                  }}
                />

                {/* Score badge overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(9, 13, 11, 0.85)',
                    border: '1px solid var(--border)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--green-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backdropFilter: 'blur(6px)',
                    pointerEvents: 'none',
                  }}
                >
                  <Sparkles size={11} />
                  <span>Score: {clip.score}/100</span>
                </div>

                {/* Timestamp overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    background: 'rgba(9, 13, 11, 0.85)',
                    border: '1px solid var(--border)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                  }}
                >
                  {Math.round(clip.startTime)}s - {Math.round(clip.endTime)}s ({Math.round(clip.duration)}s)
                </div>
              </div>

              {/* Clip Card Content */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {clip.title}
                </div>

                {clip.description && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {clip.description}
                  </div>
                )}

                {/* Card Actions */}
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <a
                    href={`/api/clips/download/${clip._id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    download
                  >
                    <Download size={14} />
                    Download MP4
                  </a>

                  <button
                    onClick={() => setEditingClip(clip)}
                    className="btn btn-secondary btn-sm"
                    title="Edit timestamps and re-render"
                  >
                    <Sliders size={14} />
                  </button>

                  <button
                    onClick={() => handleDeleteClip(clip._id)}
                    className="btn btn-danger btn-sm"
                    title="Delete clip"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp editing modal */}
      {editingClip && (
        <EditClipModal
          clip={editingClip}
          maxDuration={project?.videoDuration || 300}
          onClose={() => setEditingClip(null)}
          onRerendered={handleClipRerendered}
        />
      )}
    </div>
  );
}
