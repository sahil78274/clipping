// client/src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AuthModal from '../components/AuthModal';
import {
  Scissors,
  Sparkles,
  Link as LinkIcon,
  Upload,
  CheckCircle,
  Shield,
  Zap,
  Clock,
  Layers,
  FileVideo,
  AlertCircle,
  Info,
} from 'lucide-react';

export default function HomePage() {
  const {
    isAuthenticated,
    user,
    refreshUser,
    openAuthModal,
    pendingProject,
    savePendingProject,
    clearPendingProject,
  } = useAuth();
  const navigate = useNavigate();

  // Mode: 'upload' | 'youtube'
  const [inputMode, setInputMode] = useState('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [projectTitle, setProjectTitle] = useState('');

  // Settings
  const [clipsCount, setClipsCount] = useState(5);
  const [customClipsCount, setCustomClipsCount] = useState('');
  const [isCustomCount, setIsCustomCount] = useState(false);
  const [format, setFormat] = useState('9:16');
  const [captions, setCaptions] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Calculate estimated credit cost (2 credits per clip)
  const effectiveClipsCount = isCustomCount
    ? Math.max(1, Math.min(20, parseInt(customClipsCount, 10) || 5))
    : clipsCount;
  const estimatedCost = effectiveClipsCount * 2;

  // Restore pending URL after login (Section 3 Requirement)
  useEffect(() => {
    if (pendingProject) {
      if (pendingProject.youtubeUrl) {
        setYoutubeUrl(pendingProject.youtubeUrl);
        setInputMode('youtube');
      }
      if (pendingProject.clipsCount) setClipsCount(pendingProject.clipsCount);
      if (pendingProject.format) setFormat(pendingProject.format);
      if (pendingProject.captions !== undefined) setCaptions(pendingProject.captions);

      if (isAuthenticated) {
        setInfoMessage('Your previously entered settings have been restored. Please select your authorized video file to begin.');
        clearPendingProject();
      }
    }
  }, [isAuthenticated, pendingProject]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setYoutubeUrl(text.trim());
    } catch (err) {
      // Clipboard permission denied or unavailable
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    // Must have a real uploaded video file
    if (!uploadedFile) {
      setError('Please select an authorized video file (.mp4, .mov, .webm, .mkv) to process clips.');
      return;
    }

    // Non-logged-in user handling
    if (!isAuthenticated) {
      savePendingProject({
        youtubeUrl: youtubeUrl.trim(),
        clipsCount: effectiveClipsCount,
        format,
        captions,
      });
      openAuthModal('signup');
      return;
    }

    // Check credit balance
    if (user && user.credits < estimatedCost) {
      setError(
        `Insufficient credits. You need ${estimatedCost} credits for ${effectiveClipsCount} clips, but have ${user.credits}. Please get credits from the Credits page.`
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('clipsCount', effectiveClipsCount);
      formData.append('format', format);
      formData.append('captions', captions);
      formData.append('videoFile', uploadedFile);

      if (projectTitle.trim()) {
        formData.append('title', projectTitle.trim());
      }
      if (youtubeUrl.trim()) {
        formData.append('youtubeUrl', youtubeUrl.trim());
      }

      const res = await api.post('/projects', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success && res.data.project) {
        refreshUser();
        navigate(`/project/${res.data.project._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to initialize video project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '60px' }}>
      <AuthModal onSuccess={() => refreshUser()} />

      {/* Hero Section */}
      <section style={{ padding: '60px 0 30px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '820px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--green-accent)',
              marginBottom: '20px',
            }}
          >
            <Sparkles size={14} />
            <span>AI-Powered Long-to-Shorts Engine</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 54px)',
              lineHeight: 1.15,
              marginBottom: '16px',
            }}
          >
            Turn Long Videos Into <span className="text-green">Short Clips</span>.
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 2.5vw, 19px)',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto 36px',
            }}
          >
            Paste your YouTube link or upload creator footage. Let AI find the best moments.
          </p>

          {/* Main Input Box */}
          <div className="card" style={{ padding: '24px', textAlign: 'left', boxShadow: 'var(--shadow-lg)' }}>
            {/* Input Mode Selector */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '14px',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`btn btn-sm ${inputMode === 'upload' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Upload size={14} />
                Upload Authorized Video
              </button>

              <button
                type="button"
                onClick={() => setInputMode('youtube')}
                className={`btn btn-sm ${inputMode === 'youtube' ? 'btn-primary' : 'btn-outline'}`}
              >
                <LinkIcon size={14} />
                YouTube Link & Source Video
              </button>
            </div>

            {infoMessage && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                <CheckCircle size={16} />
                <span>{infoMessage}</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleGenerate}>
              {inputMode === 'youtube' && (
                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '4px 6px 4px 14px',
                      gap: '10px',
                      marginBottom: '10px',
                    }}
                  >
                    <LinkIcon size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        padding: '10px 0',
                        fontSize: '15px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0 }}
                    >
                      Paste
                    </button>
                  </div>

                  {/* YouTube access rule notification */}
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      marginBottom: '16px',
                    }}
                  >
                    <Info size={16} color="var(--green-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Source Video Requirement:</strong> Direct downloading of public YouTube URLs is not supported due to platform restrictions and copyright rules. Please attach your authorized creator video file below.
                    </div>
                  </div>
                </div>
              )}

              {/* Video File Picker */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    border: uploadedFile ? '2px solid var(--green-primary)' : '2px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: uploadedFile ? 'var(--green-light)' : 'var(--bg-input)',
                    textAlign: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Upload size={28} color={uploadedFile ? 'var(--green-accent)' : 'var(--text-muted)'} />
                  <span style={{ fontWeight: 600, color: uploadedFile ? 'var(--green-accent)' : 'var(--text-primary)' }}>
                    {uploadedFile ? uploadedFile.name : 'Select authorized source video file (.mp4, .mov, .webm)'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {uploadedFile
                      ? `Size: ${(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB - Click to change`
                      : 'Supports creator MP4, MOV, WebM, MKV up to 500 MB'}
                  </span>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi"
                    onChange={(e) => setUploadedFile(e.target.files[0] || null)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Optional Project Title */}
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Optional project title (defaults to video filename)"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>

              {/* Clip Generation Settings Bar */}
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* Number of Clips */}
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Number of Clips
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setClipsCount(num);
                          setIsCustomCount(false);
                        }}
                        className={`btn btn-sm ${!isCustomCount && clipsCount === num ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '6px 0' }}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCustomCount(!isCustomCount)}
                      className={`btn btn-sm ${isCustomCount ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px' }}
                    >
                      Custom
                    </button>
                  </div>
                  {isCustomCount && (
                    <input
                      type="number"
                      min="1"
                      max="20"
                      placeholder="e.g. 4"
                      value={customClipsCount}
                      onChange={(e) => setCustomClipsCount(e.target.value)}
                      className="input-field"
                      style={{ marginTop: '8px', padding: '6px 10px', width: '100%' }}
                    />
                  )}
                </div>

                {/* Video Format */}
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Video Format
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { id: '9:16', label: '9:16 (Shorts)' },
                      { id: '16:9', label: '16:9' },
                      { id: '1:1', label: '1:1' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormat(f.id)}
                        className={`btn btn-sm ${format === f.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '6px 0' }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Captions */}
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Captions / Subtitles
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setCaptions(true)}
                      className={`btn btn-sm ${captions ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '6px 0' }}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptions(false)}
                      className={`btn btn-sm ${!captions ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '6px 0' }}
                    >
                      OFF
                    </button>
                  </div>
                </div>
              </div>

              {/* Action & Cost Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Estimated Cost:</span>
                  <span className="badge badge-green" style={{ fontSize: '13px' }}>
                    {estimatedCost} Credits ({effectiveClipsCount} clips &times; 2)
                  </span>
                  {isAuthenticated && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      (You have {user?.credits ?? 0})
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{ minWidth: '220px' }}
                >
                  {loading ? (
                    'Uploading & Processing...'
                  ) : (
                    <>
                      <Scissors size={18} />
                      Find Interesting Clips
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Trust Indicators */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              marginTop: '28px',
              flexWrap: 'wrap',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={15} color="var(--green-accent)" />
              <span>Authorized Source Processing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={15} color="var(--green-accent)" />
              <span>Fast FFmpeg MP4 Rendering</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} color="var(--green-accent)" />
              <span>Gemini AI Key Moment Scoring</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ padding: '40px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>How CLIPPING Works</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              Simple 3-step pipeline designed for anyone to produce viral short clips.
            </p>
          </div>

          <div className="grid-3">
            <div className="card">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--green-accent)',
                  fontWeight: 800,
                  fontSize: '18px',
                  marginBottom: '16px',
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Upload Creator Video</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Upload your creator-owned or authorized source video file. Choose vertical 9:16, square 1:1, or widescreen 16:9.
              </p>
            </div>

            <div className="card">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--green-accent)',
                  fontWeight: 800,
                  fontSize: '18px',
                  marginBottom: '16px',
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>AI Moment Identification</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                Gemini AI analyzes the video to detect hooks, punchlines, and high-engagement moments with precise timestamps.
              </p>
            </div>

            <div className="card">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--green-accent)',
                  fontWeight: 800,
                  fontSize: '18px',
                  marginBottom: '16px',
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Preview & Download MP4s</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
                FFmpeg renders real MP4s with burned-in subtitles. Preview clips in-browser, adjust timestamps if desired, and download individually or in bulk ZIP.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
