// client/src/components/LoadingSpinner.jsx
import React from 'react';

export default function LoadingSpinner({ size = 28, text = 'Loading...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '14px' }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--green-accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {text && <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</span>}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
