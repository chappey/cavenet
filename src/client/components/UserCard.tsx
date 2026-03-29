import React from 'react';
import { Link } from 'react-router-dom';
import type { UserSummary } from 'src/shared/contracts';

interface UserCardProps {
  user: UserSummary;
}

const UserCard: React.FC<UserCardProps> = ({ user }) => {
  const initial = user.username[0]?.toUpperCase() ?? '?';

  return (
    <Link to={`/profile/${user.id}`} className="user-card">
      <div className="user-card-avatar">
        <span>{initial}</span>
      </div>
      <span className="user-card-name">{user.username}</span>
      {user.fire !== undefined && (
        <span className="user-card-fire">🔥 {user.fire}</span>
      )}
    </Link>
  );
};

export default UserCard;
