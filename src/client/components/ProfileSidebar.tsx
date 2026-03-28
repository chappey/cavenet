import React from 'react';
import { getFireGlowStyle } from './FireGlow';

interface ProfileSidebarProps {
  name: string;
  bio?: string;
  avatar?: string;
  fire: number;
  food: number;
  type?: 'user' | 'tribe';
  memberCount?: number;
  extra?: React.ReactNode;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({
  name,
  bio,
  avatar,
  fire,
  food,
  type = 'user',
  memberCount,
  extra,
}) => {
  const initial = name[0]?.toUpperCase() ?? '?';
  const glowStyle = getFireGlowStyle(fire);

  return (
    <aside className="profile-sidebar">
      {/* Avatar with fire glow ring */}
      <div
        className="sidebar-avatar"
        style={{
          boxShadow: fire > 8
            ? '0 0 30px rgba(255,122,0,0.8), 0 0 60px rgba(255,80,0,0.3)'
            : fire > 3
              ? '0 0 20px rgba(255,122,0,0.4)'
              : fire > 0
                ? '0 0 12px rgba(100,140,255,0.3)'
                : '0 0 8px rgba(0,0,0,0.4)',
          animation: fire > 8 ? 'fireGlow 2s infinite ease-in-out' : 'none',
        }}
      >
        <span className="sidebar-avatar-initial">{initial}</span>
      </div>

      <h2 className="sidebar-name">{name}</h2>

      {/* Stats */}
      <div className="sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{food}</span>
          <span className="sidebar-stat-label">🍖 Food</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{fire}</span>
          <span className="sidebar-stat-label">🔥 Fire</span>
        </div>
        {memberCount !== undefined && (
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{memberCount}</span>
            <span className="sidebar-stat-label">👥 Members</span>
          </div>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <div className="sidebar-bio">
          <h4>About</h4>
          <p>{bio}</p>
        </div>
      )}

      {extra}
    </aside>
  );
};

export default ProfileSidebar;
