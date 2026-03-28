import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface HomePageProps {
  feed: any[];
  content: string;
  setContent: (val: string) => void;
  handlePost: () => void;
  handleLike: (id: string) => void;
  handleReply: (id: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ feed, content, setContent, handlePost, handleLike, handleReply }) => {
  return (
    <>
      {/* COMPOSER */}
      <div className="composer">
        <textarea 
          placeholder="Share your primal thoughts..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="composer-actions">
          <span style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>-2 Food Cost</span>
          <button className="primary" onClick={handlePost}>Broadcast</button>
        </div>
      </div>

      {/* FEED */}
      <div className="feed">
        {feed.map(post => (
          <div key={post.id} className="post">
            <div className="post-header">
              <Link to={`/posts/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <span>User: {post.userId.substring(0,8)}...</span>
              </Link>
              <span>{post.fireGenerated} Fire Gen</span>
            </div>
            <div className="post-content">
              {post.content}
            </div>
            <div className="post-actions">
              <button onClick={() => handleLike(post.id)}>Like (Converts to Food)</button>
              <button onClick={() => handleReply(post.id)}>Reply (+Fire)</button>
              <Link to={`/posts/${post.id}`}>
                <button>View Details</button>
              </Link>
            </div>
          </div>
        ))}
        {feed.length === 0 && <div style={{color:'var(--text-secondary)', textAlign:'center'}}>The chronosphere is empty. Be the first to grunt.</div>}
      </div>
    </>
  );
};

export default HomePage;
