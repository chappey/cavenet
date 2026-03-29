import React from 'react';
import { Link } from 'react-router-dom';
import ThreadCard from '../components/ThreadCard';
import Composer from '../components/Composer';

interface HomePageProps {
  feed: any[];
  onPost: (content: string, title?: string) => Promise<void>;
  onSortChange: (sort: string) => void;
  currentSort: string;
  userId: string | null;
}

const HomePage: React.FC<HomePageProps> = ({ feed, onPost, onSortChange, currentSort, userId }) => {
  return (
    <div className="content-view">
      <div className="content-header">
        <h1>🏔️ Cave Wall</h1>
        <p className="content-subtitle">All posts from the land</p>
      </div>

      <div className="home-actions">
        <Link to="/leaderboard" className="btn-carve home-leaderboard-btn">
          🏆 View Leaderboard
        </Link>
        <Link to="/stats" className="btn-carve home-stats-btn">
          📊 View Stats
        </Link>
        <Link to="/games/hunt" className="btn-carve home-games-btn">
          🎮 Hunt for Fire
        </Link>
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
          placeholder="Write your post on the cave wall..."
          cost={2}
          costLabel="🍖 Food"
          showTitle
        />
      )}

      {/* Feed */}
      <div className="feed">
        {feed.map(thread => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
        {feed.length === 0 && (
          <div className="feed-empty">
            No posts yet. Be the first to carve into the wall.
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
