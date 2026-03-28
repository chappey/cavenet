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
      <Link to="/" style={{ color: 'var(--accent-primary)', marginBottom: '1rem', display: 'block' }}>← Back to Feed</Link>

      <div className="post" style={{ border: '1px solid var(--accent-primary)' }}>
        <div className="post-header">
           <Link to={`/profile/${post.creatorId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span>User: {post.creatorId.substring(0,8)}...</span>
          </Link>
          <span>{post.fireGenerated} Fire Gen</span>
        </div>
        <div className="post-content">
          {post.content}
        </div>
        <div className="post-actions">
           <button onClick={async () => { await handleLike(post.id); fetchPost(); }}>Like (Converts to Food)</button>
           <button onClick={async () => { await handleReply(post.id); fetchPost(); }}>Reply (+Fire)</button>
        </div>
      </div>

      <h3 style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>Echoes ({post.replies?.length ?? 0})</h3>
      <div className="replies" style={{ marginLeft: '1rem' }}>
        {post.replies?.map((reply: any) => (
          <div key={reply.id} className="post reply" style={{ fontSize: '0.9rem', opacity: 0.8 }}>
             <div className="post-header">
               <span>User: {reply.creatorId.substring(0,8)}...</span>
               <span>#{reply.replyIndex}</span>
             </div>
             <div className="post-content">
               {reply.content}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PostPage;
