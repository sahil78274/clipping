// client/src/components/EditClipModal.jsx
import React, { useState } from 'react';
import { X, Sliders, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function EditClipModal({ clip, maxDuration = 300, onClose, onRerendered }) {
  const [title, setTitle] = useState(clip?.title || '');
  const [startTime, setStartTime] = useState(clip?.startTime ?? 0);
  const [endTime, setEndTime] = useState(clip?.endTime ?? 30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!clip) return null;

  const duration = Math.max(0, endTime - startTime);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const start = parseFloat(startTime);
    const end = parseFloat(endTime);

    if (isNaN(start) || isNaN(end) || end <= start) {
      setError('End time must be greater than start time.');
      return;
    }

    if (end - start < 3) {
      setError('Clip duration must be at least 3 seconds.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.patch(`/clips/${clip._id}/rerender`, {
        startTime: start,
        endTime: end,
        title: title.trim(),
      });

      if (res.data.success && res.data.clip) {
        if (onRerendered) onRerendered(res.data.clip);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to re-render clip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#22C55E" />
            <h3 className="modal-title">Edit Clip Timestamps</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Clip Title</label>
            <input
              type="text"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter clip title"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="input-group">
              <label className="input-label">Start Time (seconds)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={maxDuration}
                className="input-field"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">End Time (seconds)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max={maxDuration}
                className="input-field"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Calculated Duration:</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green-accent)' }}>
              {duration.toFixed(1)}s
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={14} className="spin" /> Rendering...
                </>
              ) : (
                <>Re-render Clip</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
