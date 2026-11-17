// client/src/pages/MyClipsPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import EditClipModal from '../components/EditClipModal';
import { downloadFile, getAuthenticatedDownloadUrl } from '../utils/downloadHelper';
import {
  Film,
  Download,
  Sliders,
  Trash2,
  Sparkles,
  Layers,
  Search,
  Filter,
} from 'lucide-react';

export default function MyClipsPage() {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingClip, setEditingClip] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const handleDownloadClick = async (e, endpoint, fallbackFilename, key) => {
    e.preventDefault();
    setDownloadError('');
    setDownloadingKey(key);
    try {
      await downloadFile(endpoint, fallbackFilename);
    } catch (err) {
      setDownloadError(err.message || 'Failed to download file.');
      alert(err.message || 'Failed to download file.');
    } finally {
      setDownloadingKey('');
    }
  };

  const fetchClips = async () => {
    try {
      const res = await api.get('/clips');
      if (res.data.success) {
        setClips(res.data.clips || []);
      }
    } catch (err) {
      console.error('Fetch clips error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  const handleDelete = async (clipId) => {
    if (!window.confirm('Delete this clip?')) return;
    try {
      const res = await api.delete(`/clips/${clipId}`);
      if (res.data.success) {
        setClips((prev) => prev.filter((c) => c._id !== clipId));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete clip.');
    }
  };

  const filteredClips = clips.filter((clip) => {
    const matchesFormat = formatFilter === 'all' || clip.format === formatFilter;
    const matchesSearch =
      (clip.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (clip.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (clip.projectId?.title || '').toLowerCase().includes(search.toLowerCase());
    return matchesFormat && matchesSearch;
  });

  return (
    <div className="container" style={{ padding: '36px 20px 80px' }}>
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
          <h1 style={{ fontSize: '26px', marginBottom: '6px' }}>My Clips</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            All your generated highlights across all projects in one centralized library.
          </p>
        </div>

        <Link to="/" className="btn btn-primary">
          Generate New Clips
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', '9:16', '16:9', '1:1'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormatFilter(fmt)}
              className={`btn btn-sm ${formatFilter === fmt ? 'btn-primary' : 'btn-secondary'}`}
            >
              {fmt === 'all' ? 'All Formats' : fmt}
            </button>
          ))}
        </div>

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
            placeholder="Search clip titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '13px',
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading your clip library..." />
      ) : filteredClips.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Film size={44} color="var(--text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
            {clips.length === 0 ? 'No clips generated yet' : 'No clips match your filter'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
            {clips.length === 0
              ? 'Paste a YouTube video URL on the homepage to start creating high-impact short clips.'
              : 'Try clearing your search or format filters.'}
          </p>
          {clips.length === 0 && (
            <Link to="/" className="btn btn-primary">
              Create First Project
            </Link>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredClips.map((clip) => (
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
                  maxHeight: '420px',
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
                  }}
                />

                {/* Score */}
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
                    pointerEvents: 'none',
                  }}
                >
                  <Sparkles size={11} />
                  <span>Score: {clip.score}/100</span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{clip.title}</div>
                  {clip.enhancementStatus === 'completed' && clip.enhancedVideoUrl && (
                    <span className="badge badge-green" style={{ fontSize: '10px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Sparkles size={10} /> 1080p
                    </span>
                  )}
                </div>

                {clip.projectId && (
                  <Link
                    to={`/project/${clip.projectId._id}`}
                    style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                  >
                    From: {clip.projectId.title}
                  </Link>
                )}

                {/* Duration & Resolution info */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-input)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--green-accent)', fontWeight: 600 }}>
                    Duration: {clip.actualClipDuration ? Number(clip.actualClipDuration).toFixed(1) : clip.duration ? Number(clip.duration).toFixed(1) : (clip.endTime - clip.startTime).toFixed(1)}s
                  </span>
                  <span>
                    {clip.enhancementStatus === 'completed' && clip.enhancedResolution
                      ? clip.enhancedResolution
                      : clip.resolution || (clip.format === '9:16' ? '720x1280' : '1280x720')}
                  </span>
                </div>

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
                  {clip.enhancementStatus === 'completed' && clip.enhancedVideoUrl ? (
                    <>
                      <a
                        href={getAuthenticatedDownloadUrl(
                          `/api/clips/download-enhanced/${clip._id}`
                        )}
                        onClick={(e) =>
                          handleDownloadClick(
                            e,
                            `/clips/download-enhanced/${clip._id}`,
                            `${(clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_')}_1080p.mp4`,
                            `${clip._id}_1080p`
                          )
                        }
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        download
                        title={`Download 1080p (${clip.enhancedResolution || '1080x1920'})`}
                      >
                        <Sparkles size={14} />{' '}
                        {downloadingKey === `${clip._id}_1080p`
                          ? 'Downloading...'
                          : 'Download 1080p'}
                      </a>
                      <a
                        href={getAuthenticatedDownloadUrl(`/api/clips/download/${clip._id}`)}
                        onClick={(e) =>
                          handleDownloadClick(
                            e,
                            `/clips/download/${clip._id}`,
                            `${(clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_')}_720p.mp4`,
                            `${clip._id}_720p`
                          )
                        }
                        className="btn btn-secondary btn-sm"
                        download
                        title="Download original 720p"
                      >
                        <Download size={14} />{' '}
                        {downloadingKey === `${clip._id}_720p` ? '...' : '720p'}
                      </a>
                    </>
                  ) : (
                    <a
                      href={getAuthenticatedDownloadUrl(`/api/clips/download/${clip._id}`)}
                      onClick={(e) =>
                        handleDownloadClick(
                          e,
                          `/clips/download/${clip._id}`,
                          `${(clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`,
                          clip._id
                        )
                      }
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      download
                    >
                      <Download size={14} />{' '}
                      {downloadingKey === clip._id ? 'Downloading...' : 'Download MP4'}
                    </a>
                  )}

                  <button
                    onClick={() => setEditingClip(clip)}
                    className="btn btn-secondary btn-sm"
                    title="Edit timestamps"
                  >
                    <Sliders size={14} />
                  </button>

                  <button
                    onClick={() => handleDelete(clip._id)}
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

      {editingClip && (
        <EditClipModal
          clip={editingClip}
          onClose={() => setEditingClip(null)}
          onRerendered={(updated) => {
            setClips((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
          }}
        />
      )}
    </div>
  );
}
