import React from 'react';

interface CharacterSelectProps {
  users: any[];
  onSelect: (id: string) => void;
}

const CharacterSelect: React.FC<CharacterSelectProps> = ({ users, onSelect }) => {
  return (
    <div className="character-select">
      <div className="character-select-inner">
        <div className="character-select-header">
          <span className="character-select-icon">🔥</span>
          <h1>Cavenet</h1>
          <p>Choose your caveman</p>
        </div>

        <div className="character-grid">
          {users.map(user => (
            <button
              key={user.id}
              className="character-card"
              onClick={() => onSelect(user.id)}
            >
              <div className="character-avatar">
                <span>{user.username[0].toUpperCase()}</span>
              </div>
              <h3 className="character-name">{user.username}</h3>
              <p className="character-bio">{user.bio || 'A mysterious caveman...'}</p>
              <div className="character-stats">
                <span>🍖 {user.food}</span>
                <span>🔥 {user.fire}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterSelect;
