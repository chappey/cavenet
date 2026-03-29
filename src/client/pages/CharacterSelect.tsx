import React from 'react';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

interface CharacterSelectProps {
  users: any[];
  currentUserId: string | null;
  mode: 'select' | 'manage';
  loading?: boolean;
  onSelect: (id: string) => void;
  onCreateCharacter: (input: { username: string; bio: string; avatar?: string }) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onOpenManage: () => void;
  onClose: () => void;
}

const CharacterSelect: React.FC<CharacterSelectProps> = ({
  users,
  currentUserId,
  mode,
  loading,
  onSelect,
  onCreateCharacter,
  onDeleteCharacter,
  onOpenManage,
  onClose,
}) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [showAiCharacters, setShowAiCharacters] = useState(false);

  const playerCharacters = useMemo(() => users.filter(user => user.isPlayerCharacter), [users]);
  const visibleUsers = mode === 'manage'
    ? [...users].sort((a, b) => (b.fire ?? 0) - (a.fire ?? 0))
    : showAiCharacters ? [...users].sort((a, b) => (b.fire ?? 0) - (a.fire ?? 0)) : playerCharacters;

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await onCreateCharacter({ username: newName.trim(), bio: newBio.trim() });
      setNewName('');
      setNewBio('');
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (generatingDraft) return;
    setGeneratingDraft(true);
    try {
      const draft = await apiFetch('/ai/character-draft', { method: 'POST', body: '{}' });
      setNewName(draft.username ?? '');
      setNewBio(draft.bio ?? '');
      setCreating(true);
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleRemove = async (userId: string, username: string) => {
    if (!confirm(`Remove ${username}?`)) return;
    await onDeleteCharacter(userId);
  };

  const creationForm = (
    <div className="character-create-form">
      <div className="character-create-form-headline">
        <span className="character-create-form-title">Make a caveman</span>
        <span className="character-create-form-subtitle">
          Type it yourself or let the wand fill it in.
        </span>
      </div>
      <input
        className="tribe-input"
        type="text"
        placeholder="Character name..."
        value={newName}
        onChange={e => setNewName(e.target.value)}
      />
      <input
        className="tribe-input"
        type="text"
        placeholder="Short bio..."
        value={newBio}
        onChange={e => setNewBio(e.target.value)}
      />
      <div className="tribe-create-actions character-create-form-actions">
        <button className="btn-carve character-wand-btn" onClick={handleGenerateDraft} disabled={generatingDraft}>
          🪄 {generatingDraft ? 'Generating...' : 'Generate'}
        </button>
        <button className="btn-carve" onClick={handleCreate} disabled={!newName.trim() || saving}>
          {saving ? '...' : 'Create Caveman'}
        </button>
        <button className="btn-cancel" onClick={() => setCreating(false)}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="character-select">
      <div className="character-select-inner">
        <div className="character-select-header">
          <span className="character-select-icon">🔥</span>
          <h1>{mode === 'manage' ? 'Manage Characters' : 'Cavenet'}</h1>
          <p>
            {mode === 'manage'
              ? 'Add, remove, or take control of caveman agents.'
              : 'Choose one of your cavemen to post.'}
          </p>
        </div>

        {mode === 'select' && (
          <div className="character-quick-create">
            {!creating ? (
              <button className="btn-carve character-create-primary" onClick={() => setCreating(true)}>
                ✨ Create Caveman
              </button>
            ) : (
              creationForm
            )}
          </div>
        )}

        {mode === 'select' && (
          <div className="character-select-controls">
            <button
              className={`character-filter-toggle ${showAiCharacters ? 'active' : ''}`}
              onClick={() => setShowAiCharacters(value => !value)}
              type="button"
            >
              {showAiCharacters ? '👁️ Hide AI characters' : '👁️ Show AI characters'}
            </button>
          </div>
        )}

        {mode === 'select' && playerCharacters.length === 0 && (
          <div className="character-empty-callout">
            No player character yet. Create one or show AI characters to look around.
          </div>
        )}

        {mode === 'manage' && (
          <div className="character-manager-actions">
            {!creating ? (
              <div className="character-create-actions-row">
                <button className="btn-carve" onClick={() => setCreating(true)}>
                  ➕ Add Character
                </button>
                <button className="btn-carve character-wand-btn" onClick={handleGenerateDraft} disabled={generatingDraft}>
                  🪄 {generatingDraft ? 'Generating...' : 'Generate Character'}
                </button>
              </div>
            ) : (
              creationForm
            )}
            <button className="btn-cancel" onClick={onClose}>
              {currentUserId ? 'Back' : 'Done'}
            </button>
          </div>
        )}

        {loading && (
          <div className="character-loading-panel">
            <div className="loading-content">
              <div className="spinner">🔥</div>
              <p>Gathering cave people...</p>
            </div>
          </div>
        )}

        <div className="character-grid">
          {visibleUsers.map(user => (
            <div
              key={user.id}
              className={`character-card ${user.id === currentUserId ? 'selected' : ''}`}
              onClick={mode === 'select' ? () => onSelect(user.id) : undefined}
            >
              <div className="character-avatar">
                <span>{user.username[0].toUpperCase()}</span>
              </div>
              <div className="character-card-topline">
                <h3 className="character-name">{user.username}</h3>
                <span className={`character-badge ${user.isPlayerCharacter ? 'player' : 'npc'}`}>
                  {user.isPlayerCharacter ? 'Player' : 'AI'}
                </span>
              </div>
              <p className="character-bio">{user.bio || 'A mysterious caveman...'}</p>
              <div className="character-stats">
                <span>🍖 {user.food}</span>
                <span>🔥 {user.fire}</span>
              </div>
              <div className="character-card-actions">
                {mode === 'manage' ? (
                  <>
                    <button className="btn-carve character-card-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(user.id); }}>
                      {user.isPlayerCharacter ? 'Use' : 'Take Control'}
                    </button>
                    {user.isPlayerCharacter && (
                      <button
                        className="btn-cancel character-card-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleRemove(user.id, user.username);
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <span className="character-select-hint">Tap to choose</span>
                )}
              </div>
            </div>
          ))}
          {!loading && visibleUsers.length === 0 && (
            <div className="feed-empty">
              {mode === 'manage' ? 'No characters yet. Add one to begin.' : 'No player characters yet. Use Manage to create one.'}
            </div>
          )}
        </div>

        {!loading && mode === 'select' && (
          <div className="character-manager-footer">
            <button className="btn-carve" onClick={onOpenManage}>
              🧭 Manage Characters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterSelect;
