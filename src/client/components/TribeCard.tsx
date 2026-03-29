import React from 'react';
import { Link } from 'react-router-dom';
import type { TribeSummary, TribeMembership } from 'src/shared/contracts';

interface TribeCardProps {
  tribe: TribeSummary | TribeMembership;
}

const isTribeMembership = (tribe: TribeSummary | TribeMembership): tribe is TribeMembership => {
  return 'tribeId' in tribe;
};

/** Get a clean abbreviation — never show raw field names or empty text */
const getAbbr = (tribe: TribeCardProps['tribe']): string => {
  if (isTribeMembership(tribe)) {
    const abbr = tribe.tribeAbbreviation;
    if (abbr && abbr.length <= 5 && abbr.toLowerCase() !== 'abbreviation') {
      return abbr.toUpperCase();
    }

    return tribe.tribeName[0]?.toUpperCase() || '?';
  }

  const abbr = tribe.abbreviation;
  if (abbr && abbr.length <= 5 && abbr.toLowerCase() !== 'abbreviation') {
    return abbr.toUpperCase();
  }

  // Fallback: first letter of name
  return tribe.name[0]?.toUpperCase() || '?';
};

const TribeCard: React.FC<TribeCardProps> = ({ tribe }) => {
  const id = isTribeMembership(tribe) ? tribe.tribeId : tribe.id;
  const name = isTribeMembership(tribe) ? tribe.tribeName : tribe.name;
  const memberCount = isTribeMembership(tribe) ? undefined : tribe.memberCount;
  const abbr = getAbbr(tribe);

  return (
    <Link to={`/tribes/${id}`} className="tribe-card">
      <div className="tribe-card-avatar">
        <span>{abbr}</span>
      </div>
      <span className="tribe-card-name">{name}</span>
      {memberCount !== undefined && (
        <span className="tribe-card-members">👥 {memberCount}</span>
      )}
    </Link>
  );
};

export default TribeCard;
