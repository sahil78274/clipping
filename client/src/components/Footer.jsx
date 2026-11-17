// client/src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Scissors, Shield, Zap, Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '18px' }}>
              <Scissors size={18} color="#22C55E" />
              <span>CLIPPING</span>
            </div>
            <div className="footer-text">
              Long Videos. Best Moments. Built for creators, podcasters, and media teams.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <Link to="/" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Home
            </Link>
            <Link to="/projects" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              My Projects
            </Link>
            <Link to="/credits" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Credit Packages
            </Link>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              &copy; {new Date().getFullYear()} CLIPPING. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
