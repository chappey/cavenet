import React, { useState } from 'react';
import { getFireGlowStyle } from './FireGlow';

interface ProfileSidebarProps {
  name: string;
  abbreviation?: string;
  bio?: string;
  avatar?: string;
  fire: number;
  food: number;
  type?: 'user' | 'tribe';
  memberCount?: number;
  extra?: React.ReactNode;
  /** Allow editing the bio (only for own profile) */
  editable?: boolean;
  onUpdateBio?: (bio: string) => Promise<void>;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({
  name,
  abbreviation,
  bio,
  avatar,
  fire,
  food,
  type = 'user',
  memberCount,
  extra,
  editable = false,
  onUpdateBio,
}) => {
  const initial = abbreviation || name[0]?.toUpperCase() || '?';
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState(bio ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdateBio || saving) return;
    setSaving(true);
    try {
      await onUpdateBio(editBio);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditBio(bio ?? '');
    setEditing(false);
  };

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

      {/* Bio — view or edit mode */}
      <div className="sidebar-bio">
        <div className="sidebar-bio-header">
          <h4>About</h4>
          {editable && !editing && (
            <button className="bio-edit-btn" onClick={() => { setEditBio(bio ?? ''); setEditing(true); }}>
              ✏️ Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="bio-edit-form">
            <textarea
              className="bio-edit-textarea"
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={3}
              placeholder="Tell the tribe about yourself..."
            />
            <div className="bio-edit-actions">
              <button className="btn-carve" onClick={handleSave} disabled={saving}>
                {saving ? '...' : 'Save'}
              </button>
              <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <p>{bio || (editable ? 'Tell the tribe about yourself...' : 'No bio yet.')}</p>
        )}
      </div>

      {extra}
    </aside>
  );
};

export default ProfileSidebar;
