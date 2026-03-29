import React from 'react';
import { Link } from 'react-router-dom';

interface TribeCardProps {
  tribe: {
    tribeId?: string;
    id?: string;
    tribeName?: string;
    name?: string;
    tribeAbbreviation?: string;
    abbreviation?: string;
    tribeAvatar?: string;
    avatar?: string;
    tribeDescription?: string;
    description?: string;
    memberCount?: number;
  };
}

/** Get a clean abbreviation — never show raw field names or empty text */
const getAbbr = (tribe: TribeCardProps['tribe']): string => {
  // Check explicit abbreviation fields, filtering out empty strings and the literal word "abbreviation"
  for (const val of [tribe.tribeAbbreviation, tribe.abbreviation]) {
    if (val && val.length <= 5 && val.toLowerCase() !== 'abbreviation') {
      return val.toUpperCase();
    }
  }
  // Fallback: first letter of name
  const name = tribe.tribeName || tribe.name || '';
  return name[0]?.toUpperCase() || '?';
};

const TribeCard: React.FC<TribeCardProps> = ({ tribe }) => {
  const id = tribe.tribeId ?? tribe.id ?? '';
  const name = tribe.tribeName ?? tribe.name ?? 'Unknown';
  const abbr = getAbbr(tribe);

  return (
    <Link to={`/tribes/${id}`} className="tribe-card">
      <div className="tribe-card-avatar">
        <span>{abbr}</span>
      </div>
      <span className="tribe-card-name">{name}</span>
      {tribe.memberCount !== undefined && (
        <span className="tribe-card-members">👥 {tribe.memberCount}</span>
      )}
    </Link>
  );
};

export default TribeCard;
