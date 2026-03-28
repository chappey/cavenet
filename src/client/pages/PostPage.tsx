import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { treaty } from '@elysiajs/eden';
import type { App as AppType } from '../../server/index';

const api = treaty<AppType>(window.location.origin);

interface PostPageProps {
  handleLike: (id: string) => void;
  handleReply: (id: string) => void;
}

const PostPage: React.FC<PostPageProps> = ({ handleLike, handleReply }) => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPost = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await (api.api.threads as any)({ id }).get();
    if (data) setPost(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPost();
  }, [id]);

  if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Loading post...</div>;
  if (!post) return <div style={{ color: 'white', padding: '2rem' }}>Post not found</div>;

  return (
    <div className="post-details">
      <Link to="/" style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'block' }}>← Back to Tribe</Link>

      {(() => {
        const heat = post.fireGenerated;
        const isHot = heat > 8;
        const isWarm = heat > 3;

        let bg = "#1c1c1c";
        let glow = "0 10px 30px rgba(0,0,0,0.6)";

        if (isHot) {
          glow = "0 0 25px rgba(255,122,0,0.9)";
        } else if (isWarm) {
          glow = "0 0 15px rgba(255,122,0,0.4)";
        }

        return (
          <div
            className="post"
            style={{
              background: bg,
              boxShadow: glow,
              animation: isHot ? "fireGlow 2s infinite ease-in-out" : "none",
              transition: "0.3s"
            }}
          >
            <div className="post-header">
               <Link to={`/profile/${post.creatorId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <span>User: {post.creatorId.substring(0,8)}...</span>
               </Link>
              <span>🔥 {post.fireGenerated}</span>
            </div>
            <div className="post-content">
              {post.content}
            </div>
            <div className="post-actions">
               <button onClick={async () => { await handleLike(post.id); fetchPost(); }}>Like (+🍖)</button>
               <button onClick={async () => { await handleReply(post.id); fetchPost(); }}>Reply (+🔥)</button>
            </div>
          </div>
        );
      })()}

      <h3 style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>Echoes ({post.replies?.length ?? 0})</h3>
      <div className="replies" style={{ marginLeft: '1rem' }}>
        {post.replies?.map((reply: any) => {
          const heat = reply.fireGenerated;
          const isHot = heat > 8;
          const isWarm = heat > 3;

          let bg = "#1c1c1c";
          let glow = "0 10px 30px rgba(0,0,0,0.6)";

          if (isHot) {
            glow = "0 0 25px rgba(255,122,0,0.9)";
          } else if (isWarm) {
            glow = "0 0 15px rgba(255,122,0,0.4)";
          }

          return (
            <div
              key={reply.id}
              className="post reply"
              style={{
                fontSize: '0.9rem',
                opacity: 0.8,
                background: bg,
                boxShadow: glow,
                animation: isHot ? "fireGlow 2s infinite ease-in-out" : "none",
                transition: "0.3s"
              }}
            >
               <div className="post-header">
                 <span>User: {reply.creatorId.substring(0,8)}...</span>
                 <span>#{reply.replyIndex}</span>
               </div>
               <div className="post-content">
                 {reply.content}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PostPage;
