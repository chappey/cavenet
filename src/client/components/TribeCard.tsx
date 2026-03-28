import React from 'react';
import { Link } from 'react-router-dom';

interface TribeCardProps {
  tribe: {
    tribeId?: string;
    id?: string;
    tribeName?: string;
    name?: string;
    tribeAvatar?: string;
    avatar?: string;
    tribeDescription?: string;
    description?: string;
    memberCount?: number;
  };
}

const TribeCard: React.FC<TribeCardProps> = ({ tribe }) => {
  const id = tribe.tribeId ?? tribe.id ?? '';
  const name = tribe.tribeName ?? tribe.name ?? 'Unknown';
  const initial = name[0]?.toUpperCase() ?? '?';

  return (
    <Link to={`/tribes/${id}`} className="tribe-card">
      <div className="tribe-card-avatar">
        <span>{initial}</span>
      </div>
      <span className="tribe-card-name">{name}</span>
      {tribe.memberCount !== undefined && (
        <span className="tribe-card-members">👥 {tribe.memberCount}</span>
      )}
    </Link>
  );
};

export default TribeCard;
