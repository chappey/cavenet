import React, { useState } from 'react';
import ThreadCard from '../components/ThreadCard';
import Composer from '../components/Composer';

interface HomePageProps {
  feed: any[];
  onPost: (content: string) => Promise<void>;
  onSortChange: (sort: string) => void;
  currentSort: string;
  userId: string | null;
}

const HomePage: React.FC<HomePageProps> = ({ feed, onPost, onSortChange, currentSort, userId }) => {
  return (
    <div className="content-view">
      <div className="content-header">
        <h1>🏔️ Cave Wall</h1>
        <p className="content-subtitle">All grunts from the land</p>
      </div>

      {/* Sort controls */}
      <div className="sort-controls">
        <span className="sort-label">Sort by:</span>
        {[
          { key: 'newest', label: '🕐 Newest' },
          { key: 'active', label: '💬 Active' },
          { key: 'hottest', label: '🔥 Hottest' },
        ].map(opt => (
          <button
            key={opt.key}
            className={`sort-btn ${currentSort === opt.key ? 'active' : ''}`}
            onClick={() => onSortChange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      {userId && (
        <Composer
          onSubmit={onPost}
          placeholder="Grunt your thoughts into the cave wall..."
          cost={2}
          costLabel="🍖 Food"
        />
      )}

      {/* Feed */}
      <div className="feed">
        {feed.map(thread => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
        {feed.length === 0 && (
          <div className="feed-empty">
            No grunts yet. Be the first to carve into the wall.
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
