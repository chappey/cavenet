import React, { useState } from 'react';

interface ComposerProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  cost?: number;
  costLabel?: string;
  disabled?: boolean;
}

const Composer: React.FC<ComposerProps> = ({
  onSubmit,
  placeholder = 'Grunt your thoughts into the cave wall...',
  cost = 2,
  costLabel = '🍖 Food',
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(content);
      setContent('');
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
