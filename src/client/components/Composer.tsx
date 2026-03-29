import React, { useState } from 'react';

interface ComposerProps {
  onSubmit: (content: string, title?: string) => Promise<void>;
  placeholder?: string;
  cost?: number;
  costLabel?: string;
  disabled?: boolean;
  /** Show a title input above the textarea (for thread creation) */
  showTitle?: boolean;
}

const Composer: React.FC<ComposerProps> = ({
  onSubmit,
  placeholder = 'Write your post on the cave wall...',
  cost = 2,
  costLabel = '🍖 Food',
  disabled = false,
  showTitle = false,
}) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(content, showTitle ? title : undefined);
      setContent('');
      setTitle('');
    } catch (e) {
      // Error already handled by caller (alert), don't clear fields
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="composer">
      {showTitle && (
        <input
          type="text"
          className="composer-title"
          placeholder="Thread title..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={disabled || submitting}
        />
      )}
      <textarea
        placeholder={placeholder}
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || submitting}
        rows={3}
      />
      <div className="composer-actions">
        <span className="composer-cost">-{cost} {costLabel}</span>
        <button
          className="btn-carve"
          onClick={handleSubmit}
          disabled={!content.trim() || submitting || disabled}
        >
          {submitting ? '...' : '🪨 Carve'}
        </button>
      </div>
    </div>
  );
};

export default Composer;
