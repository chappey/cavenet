import React from 'react';

interface FireGlowProps {
  fireLevel: number;
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'span';
}

/** Returns glow style based on fire level */
export const getFireGlowStyle = (fireLevel: number): React.CSSProperties => {
  if (fireLevel > 8) {
    return {
      boxShadow: '0 0 25px rgba(255,122,0,0.9), inset 0 0 15px rgba(255,80,0,0.1)',
      animation: 'fireGlow 2s infinite ease-in-out',
    };
  }
  if (fireLevel > 3) {
    return {
      boxShadow: '0 0 15px rgba(255,122,0,0.4)',
    };
  }
  if (fireLevel > 0) {
    return {
      boxShadow: '0 0 8px rgba(100,140,255,0.3)',
    };
  }
  return {
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  };
};

/** Get CSS class name for glow intensity */
export const getFireGlowClass = (fireLevel: number): string => {
  if (fireLevel > 8) return 'glow-hot';
  if (fireLevel > 3) return 'glow-warm';
  if (fireLevel > 0) return 'glow-cool';
  return 'glow-none';
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
