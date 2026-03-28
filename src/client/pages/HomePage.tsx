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
          placeholder="Grunt your thoughts into the cave wall..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="composer-actions">
          <span style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>-2 🍖 Food Cost</span>
          <button className="primary" onClick={handlePost}>Carve</button>
        </div>
      </div>

      {/* FEED */}
      <div className="feed">
        {feed.map(post => {
          // Heat system
          const heat = post.fireGenerated;
          const isHot = heat > 8;
          const isWarm = heat > 3;

          // Always dark base
          let bg = "#1c1c1c";

          // Glow strength
          let glow = "0 10px 30px rgba(0,0,0,0.6)";

          if (isHot) {
            glow = "0 0 25px rgba(255,122,0,0.9)";
          } else if (isWarm) {
            glow = "0 0 15px rgba(255,122,0,0.4)";
          }

          return (
            <div
              key={post.id}
              className="post"
              style={{
                background: bg,
                boxShadow: glow,
                animation: isHot ? "fireGlow 2s infinite ease-in-out" : "none",
                transition: "0.3s"
              }}
            >
              <div className="post-header">
                <Link to={`/threads/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span>User: {post.creatorId.substring(0,8)}...</span>
                </Link>
              <span>🔥 {post.fireGenerated}</span>
              </div>
              <div className="post-content">
                {post.content}
              </div>
              <div className="post-actions">
                <button onClick={() => handleLike(post.id)}>Like (+🍖)</button>
                <button onClick={() => handleReply(post.id)}>Reply (+🔥)</button>
                <Link to={`/threads/${post.id}`}>
                  <button>View</button>
                </Link>
              </div>
            </div>
          );
        })}
        {feed.length === 0 && <div style={{color:'var(--text-secondary)', textAlign:'center'}}>No grunts yet. Be the first to post.</div>}
      </div>
    </>
  );
};

export default HomePage;
