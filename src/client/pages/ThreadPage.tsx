import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { getFireGlowStyle } from '../components/FireGlow';
import Composer from '../components/Composer';

interface ThreadPageProps {
  userId: string | null;
  onRefreshUser: () => void;
}

const timeAgo = (date: any): string => {
  const d = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const ThreadPage: React.FC<ThreadPageProps> = ({ userId, onRefreshUser }) => {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inverted, setInverted] = useState(false);

  const fetchThread = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiFetch(`/threads/${id}`);
      setThread(data);
    } catch (e) {
      console.error('Failed to load thread', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [id]);

  const handleReply = async (content: string) => {
    if (!id) return;
    try {
      await apiFetch(`/threads/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      await fetchThread();
      onRefreshUser();
    } catch (e: any) {
      alert(`Failed to reply: ${e.message}`);
      throw e;
    }
  };

  const handleLike = async (replyId: string) => {
    try {
      await apiFetch(`/replies/${replyId}/like`, { method: 'POST' });
      await fetchThread();
      onRefreshUser();
    } catch (e: any) {
      alert(`Failed to like: ${e.message}`);
    }
  };

  if (loading && !thread) return <div className="loading-state">Loading thread...</div>;
  if (!thread) return <div className="error-state">Thread not found</div>;

  const threadReplies = inverted ? [...(thread.replies ?? [])].reverse() : thread.replies ?? [];
  const engagementStatus = thread.engagement?.status ?? 'inactive';
  const engagementIndicator = engagementStatus === 'complete'
    ? '✅'
    : engagementStatus === 'queued' || engagementStatus === 'active'
      ? '⏳'
      : '❌';

  return (
    <div className="thread-view">
      <Link to="/" className="back-link">← Back to Cave Wall</Link>

      {/* Original Post */}
      <div
        className="thread-op"
        style={getFireGlowStyle(thread.fireGenerated ?? 0)}
      >
        <div className="thread-op-header">
          <Link to={`/profile/${thread.creatorId}`} className="thread-op-author">
            <span className="avatar-initial">{(thread.creatorUsername ?? '?')[0].toUpperCase()}</span>
            <span>{thread.creatorUsername}</span>
          </Link>
          <span className="thread-op-time">{timeAgo(thread.createdAt)}</span>
        </div>
        {thread.title && <h2 className="thread-op-title">{thread.title}</h2>}
        <div className="thread-op-content">{thread.content}</div>
        <div className="thread-op-stats">
          <span>🔥 {thread.fireGenerated ?? 0}</span>
          <span>💬 {thread.replyCount ?? 0} replies</span>
          <span>👥 {thread.uniquePosters ?? 0} unique</span>
          <span title={engagementStatus === 'active' || engagementStatus === 'queued' ? 'Engagement running' : engagementStatus === 'complete' ? 'Engagement complete' : 'No engagement running'}>{engagementIndicator}</span>
        </div>
      </div>

      {/* Replies */}
      <div className="thread-replies-header">
        <h3>Replies ({thread.replies?.length ?? 0})</h3>
        <button
          className="sort-btn"
          onClick={() => setInverted(!inverted)}
        >
          {inverted ? '↑ Oldest first' : '↓ Newest first'}
        </button>
      </div>

      <div className="thread-replies">
        {threadReplies.map((reply: any) => {
          const replyFire = reply.fireGenerated ?? 0;
          const replyLikes = reply.likes ?? 0;

          return (
            <div
              key={reply.id}
              className="reply-card"
              style={getFireGlowStyle(replyFire)}
            >
              <div className="reply-header">
                <Link to={`/profile/${reply.creatorId}`} className="reply-author">
                  <span className="avatar-initial">{(reply.creatorUsername ?? '?')[0].toUpperCase()}</span>
                  <span>{reply.creatorUsername}</span>
                </Link>
                <div className="reply-meta">
                  <span className="reply-index">#{reply.replyIndex}</span>
                  <span className="reply-time">{timeAgo(reply.createdAt)}</span>
                </div>
              </div>
              <div className="reply-content">{reply.content}</div>
              <div className="reply-actions">
                <span className="reply-fire">🔥 {replyFire}</span>
                {replyLikes > 5 && <span className="reply-like-count">❤️ {replyLikes}</span>}
                {userId && (
                  <button
                    className="like-btn"
                    onClick={() => handleLike(reply.id)}
                    title="Like: converts 2-3 🔥 → 1 🍖"
                  >
                    👍 Like (+🍖)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Composer */}
      {userId && (
        <div className="thread-composer">
          <Composer
            onSubmit={handleReply}
            placeholder="Add your reply to this thread..."
            cost={0}
            costLabel="Free"
          />
        </div>
      )}
    </div>
  );
};

export default ThreadPage;
