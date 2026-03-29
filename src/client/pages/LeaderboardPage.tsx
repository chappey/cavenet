import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { UserSummary } from 'src/shared/contracts';

interface LeaderboardPageProps {
	users: UserSummary[];
	currentUserId: string | null;
}

const getMedal = (rank: number) => {
	if (rank === 0) return '🥇';
	if (rank === 1) return '🥈';
	if (rank === 2) return '🥉';
	return `#${rank + 1}`;
};

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ users, currentUserId }) => {
	const rankedUsers = useMemo(() => {
		return [...users].sort((a, b) => {
			const fireDiff = (b.fire ?? 0) - (a.fire ?? 0);
			if (fireDiff !== 0) return fireDiff;
			const foodDiff = (b.food ?? 0) - (a.food ?? 0);
			if (foodDiff !== 0) return foodDiff;
			return String(a.username).localeCompare(String(b.username));
		});
	}, [users]);

	return (
		<div className="content-view leaderboard-view">
			<div className="content-header">
				<Link to="/" className="back-link leaderboard-back-link">← Back to Cave Wall</Link>
				<h1>🏆 Leaderboard</h1>
				<p className="content-subtitle">All cave people, player-created and AI-controlled</p>
			</div>

			<div className="leaderboard-list">
				{rankedUsers.map((user, index) => (
					<Link
						key={user.id}
						to={`/profile/${user.id}`}
						className={`leaderboard-row ${user.id === currentUserId ? 'current' : ''}`}
					>
						<div className="leaderboard-rank">{getMedal(index)}</div>
						<div className="leaderboard-avatar">
							<span>{user.username[0]?.toUpperCase() ?? '?'}</span>
						</div>
						<div className="leaderboard-main">
							<div className="leaderboard-name-row">
								<span className="leaderboard-name">{user.username}</span>
								<span className={`character-badge ${user.isPlayerCharacter ? 'player' : 'npc'}`}>
									{user.isPlayerCharacter ? 'Player' : 'AI'}
								</span>
								{user.id === currentUserId && <span className="leaderboard-you">You</span>}
							</div>
							<p className="leaderboard-bio">{user.bio || 'A mysterious caveman...'}</p>
						</div>
						<div className="leaderboard-stats">
							<div className="leaderboard-stat">
								<span className="leaderboard-stat-label">Fire</span>
								<span className="leaderboard-stat-value">🔥 {user.fire ?? 0}</span>
							</div>
							<div className="leaderboard-stat">
								<span className="leaderboard-stat-label">Food</span>
								<span className="leaderboard-stat-value">🍖 {user.food ?? 0}</span>
							</div>
						</div>
					</Link>
				))}
				{rankedUsers.length === 0 && (
					<div className="feed-empty">No cave people found.</div>
				)}
			</div>
		</div>
	);
};

export default LeaderboardPage;