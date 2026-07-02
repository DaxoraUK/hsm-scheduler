import React from "react";
import "./authExperience.css";

export function GroundControlMark({ className = "", title = "Ground Control" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="gc-mark-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#31e2cf" />
          <stop offset="100%" stopColor="#0ea5a8" />
        </linearGradient>
        <filter id="gc-mark-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="43" fill="rgba(7,18,31,0.78)" stroke="url(#gc-mark-ring)" strokeWidth="4" />
      <circle cx="60" cy="60" r="29" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2" />
      <circle cx="60" cy="60" r="13" fill="rgba(49,226,207,0.1)" stroke="#31e2cf" strokeWidth="2" />
      <path d="M60 5V22M60 98V115M5 60H22M98 60H115" stroke="#f15b4d" strokeWidth="5" strokeLinecap="round" />
      <path d="M60 32V48M60 72V88M32 60H48M72 60H88" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="60" r="6" fill="#f15b4d" filter="url(#gc-mark-glow)" />
      <path d="M60 60L84 38" stroke="#31e2cf" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="84" cy="38" r="3.5" fill="#31e2cf" />
    </svg>
  );
}

export default function BrandSplash({ message = "Initialising Ground Control" }) {
  return (
    <div className="gc-splash" role="status" aria-live="polite">
      <div className="gc-grid-field" aria-hidden="true" />
      <div className="gc-splash-orbit gc-splash-orbit-one" aria-hidden="true" />
      <div className="gc-splash-orbit gc-splash-orbit-two" aria-hidden="true" />

      <div className="gc-splash-content">
        <div className="gc-splash-mark-wrap">
          <div className="gc-splash-scan" aria-hidden="true" />
          <GroundControlMark className="gc-splash-mark" />
        </div>

        <div className="gc-splash-wordmark" aria-label="Ground Control">
          <span>GROUND</span>
          <strong>CONTROL</strong>
        </div>
        <div className="gc-splash-kicker">OPERATIONS PLATFORM</div>

        <div className="gc-splash-progress" aria-hidden="true">
          <span />
        </div>
        <div className="gc-splash-message">{message}</div>

        <div className="gc-splash-powered">
          <span>Powered by</span>
          <b>DA<span>X</span>ORA</b>
        </div>
      </div>
    </div>
  );
}
