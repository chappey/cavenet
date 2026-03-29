import React from 'react';

interface FireGlowProps {
  fireLevel: number;
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'span';
}

/**
 * Glow spectrum:
 *   0 fire    → cold (blue glow) — brand new, no engagement
 *   1-3 fire  → cool (faint blue) — starting to warm
 *   4-6 fire  → neutral (no glow) — balanced
 *   7-10 fire → warm (orange glow)
 *   11+ fire  → hot (intense animated fire glow)
 */
export const getFireGlowStyle = (fireLevel: number): React.CSSProperties => {
  if (fireLevel >= 11) {
    // HOT — pulsing fire
    return {
      boxShadow: '0 0 25px rgba(255,122,0,0.9), inset 0 0 15px rgba(255,80,0,0.1)',
      borderColor: 'rgba(255,122,0,0.7)',
      animation: 'fireGlow 2s infinite ease-in-out',
    };
  }
  if (fireLevel >= 7) {
    // WARM — steady orange
    return {
      boxShadow: '0 0 15px rgba(255,122,0,0.4)',
      borderColor: 'rgba(255,122,0,0.5)',
    };
  }
  if (fireLevel >= 4) {
    // NEUTRAL — no glow, subtle shadow
    return {
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    };
  }
  if (fireLevel >= 1) {
    // COOL — faint blue, warming up
    return {
      boxShadow: '0 0 10px rgba(100,140,255,0.25)',
      borderColor: 'rgba(100,140,255,0.3)',
    };
  }
  // COLD — brand new, no engagement, pulsing icy blue
  return {
    boxShadow: '0 0 18px rgba(100,160,255,0.5), 0 0 4px rgba(80,130,230,0.3)',
    borderColor: 'rgba(100,160,255,0.6)',
    animation: 'iceGlow 3s infinite ease-in-out',
  };
};

/** Get CSS class name for glow intensity */
export const getFireGlowClass = (fireLevel: number): string => {
  if (fireLevel >= 11) return 'glow-hot';
  if (fireLevel >= 7) return 'glow-warm';
  if (fireLevel >= 4) return 'glow-neutral';
  if (fireLevel >= 1) return 'glow-cool';
  return 'glow-cold';
};

const FireGlow: React.FC<FireGlowProps> = ({ fireLevel, children, className = '', as = 'div' }) => {
  const Tag = as;
  return (
    <Tag
      className={`${getFireGlowClass(fireLevel)} ${className}`}
      style={getFireGlowStyle(fireLevel)}
    >
      {children}
    </Tag>
  );
};

export default FireGlow;
