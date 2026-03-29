import React from 'react';
import { Link } from 'react-router-dom';
import { getFireGlowStyle } from './FireGlow';

interface ThreadCardProps {
  thread: any;
  onLike?: (replyId: string) => void;
  onReply?: (threadId: string) => void;
  compact?: boolean;
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

const ThreadCard: React.FC<ThreadCardProps> = ({ thread, compact = false }) => {
  const fireLevel = thread.fireGenerated ?? 0;

  return (
    <Link to={`/threads/${thread.id}`} className="thread-card-link">
      <div
        className="thread-card"
        style={getFireGlowStyle(fireLevel)}
      >
        {/* Header */}
        <div className="thread-card-header">
          <div className="thread-card-meta">
            <Link
              to={`/profile/${thread.creatorId}`}
              className="thread-card-author"
              onClick={e => e.stopPropagation()}
            >
              <span className="avatar-initial">{(thread.creatorUsername ?? '?')[0].toUpperCase()}</span>
              <span>{thread.creatorUsername ?? 'Unknown'}</span>
            </Link>
            {/* Tribe badge */}
            {thread.tribeId && (() => {
              const raw = thread.tribeAbbreviation;
              const valid = raw && raw.length <= 5 && raw.toLowerCase() !== 'abbreviation';
              const label = valid ? raw : (thread.tribeName?.[0]?.toUpperCase() || null);
              return label ? (
                <Link
                  to={`/tribes/${thread.tribeId}`}
                  className="tribe-badge"
                  onClick={e => e.stopPropagation()}
                  title={thread.tribeName ?? 'Tribe'}
                >
                  {label}
                </Link>
              ) : null;
            })()}
            <span className="thread-card-time">{timeAgo(thread.createdAt)}</span>
          </div>
          <div className="thread-card-stats">
            <span className="stat-fire" title="Fire generated">🔥 {fireLevel}</span>
          </div>
        </div>

        {/* Title */}
        {thread.title && (
          <h3 className="thread-card-title">{thread.title}</h3>
        )}

        {/* Content preview */}
        <p className="thread-card-content">
          {thread.content?.length > 200
            ? thread.content.substring(0, 200) + '...'
            : thread.content}
        </p>

        {/* Footer metrics */}
        <div className="thread-card-footer">
          <span title="Replies">💬 {thread.replyCount ?? 0}</span>
          <span title="Unique posters">👥 {thread.uniquePosters ?? 0}</span>
        </div>

        {/* Recent replies preview */}
        {!compact && thread.recentReplies?.length > 0 && (
          <div className="thread-card-replies">
            {thread.recentReplies.slice(0, 3).map((reply: any) => (
              <div key={reply.id} className="thread-card-reply-preview">
                <span className="reply-author">{reply.creatorUsername}</span>
                <span className="reply-text">
                  {reply.content?.length > 80
                    ? reply.content.substring(0, 80) + '...'
                    : reply.content}
                </span>
              </div>
            ))}
            {(thread.replyCount ?? 0) > 3 && (
              <div className="thread-card-more">
                +{thread.replyCount - 3} more replies
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default ThreadCard;
