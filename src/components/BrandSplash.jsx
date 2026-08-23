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

export function DaxoraMark({ className = "", title = "Daxora" }) {
  return <svg className={className} viewBox="0 0 120 120" role="img" aria-label={title}><defs><linearGradient id="daxora-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5eead4" /><stop offset="100%" stopColor="#2563eb" /></linearGradient><filter id="daxora-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><rect x="13" y="13" width="94" height="94" rx="29" fill="rgba(8,18,35,.85)" stroke="rgba(94,234,212,.35)" strokeWidth="2" /><path d="M34 31 60 58 86 31M34 89 60 62 86 89" fill="none" stroke="url(#daxora-mark)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" filter="url(#daxora-glow)" /><circle cx="60" cy="60" r="5" fill="#f97360" /></svg>;
}

export default function BrandSplash({ message = "Initialising Daxora" }) {
  return (
    <div className="gc-splash" role="status" aria-live="polite">
      <div className="gc-grid-field" aria-hidden="true" />
      <div className="gc-splash-orbit gc-splash-orbit-one" aria-hidden="true" />
      <div className="gc-splash-orbit gc-splash-orbit-two" aria-hidden="true" />

      <div className="gc-splash-content">
        <div className="gc-splash-mark-wrap">
          <div className="gc-splash-scan" aria-hidden="true" />
          <DaxoraMark className="gc-splash-mark" />
        </div>

        <div className="gc-splash-wordmark" aria-label="Daxora">
          <span>DAXORA</span>
          <strong>PLATFORM</strong>
        </div>
        <div className="gc-splash-kicker">GRASSROOTS SPORT, CONNECTED</div>

        <div className="gc-splash-progress" aria-hidden="true">
          <span />
        </div>
        <div className="gc-splash-message">{message}</div>

        <div className="gc-splash-powered">
          <span>Secure platform services</span>
        </div>
      </div>
    </div>
  );
}
