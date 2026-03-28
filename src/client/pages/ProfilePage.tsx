import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { treaty } from '@elysiajs/eden';
import type { App as AppType } from '../../server/index';

const api = treaty<AppType>(window.location.origin);

interface ProfilePageProps {
  currentUser: any;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    const userId = id || currentUser?.id;
    if (!userId) return;

    // Use current user data if it's the same user
    if (userId === currentUser?.id) {
      setUser(currentUser);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await api.api.users({ id: userId }).get();
    if (data) setUser(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, [id, currentUser]);

  if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Loading profile...</div>;
  if (!user) return <div style={{ color: 'white', padding: '2rem' }}>User not found</div>;

  return (
    <div className="profile">
      <div className="header-glass" style={{ marginBottom: '2rem' }}>
        <div className="brand">
          <h1>{user.username} Profile</h1>
          <span>Tribe ID: {user.id.substring(0, 12)}...</span>
        </div>
        <div className="stats" style={{ gap: '2rem' }}>
          <div className="stat">
            <span className="stat-val food">{user.food}</span>
            <span className="stat-label">🍖</span>
          </div>
          <div className="stat">
            <span className="stat-val fire">{user.fire}</span>
            <span className="stat-label">🔥</span>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Carvings</h3>
      <div className="feed">
        {user.threads?.map((post: any) => {
          const heat = post.fireGenerated;
          const isHot = heat > 8;
          const isWarm = heat > 3;

          let bg = "#1c1c1c";
          let glow = "0 10px 30px rgba(0,0,0,0.6)";

          if (isHot) {
            glow = "0 0 25px rgba(255,122,0,0.9)";
          } else if (isWarm) {
            glow = "0 0 15px rgba(255,122,0,0.4)";
          }

          return (
            <div
              key={post.id}
              className="post"
              style={{
                background: bg,
                boxShadow: glow,
                animation: isHot ? "fireGlow 2s infinite ease-in-out" : "none",
                transition: "0.3s"
              }}
            >
              <div className="post-header">
                <span>{new Date(post.createdAt).toLocaleString()}</span>
                <span>🔥 {post.fireGenerated}</span>
              </div>
              <div className="post-content">
                {post.content}
              </div>
              <div className="post-actions">
                 <Link to={`/threads/${post.id}`}>
                   <button>View Deep Echoes</button>
                 </Link>
              </div>
            </div>
          );
        })}
        {user.threads?.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>This caveman has not posted yet.</div>}
      </div>
    </div>
  );
};

export default ProfilePage;
