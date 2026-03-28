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

  if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Scanning Neural Profile...</div>;
  if (!user) return <div style={{ color: 'white', padding: '2rem' }}>Neural Signal Lost: User Not Found</div>;

  return (
    <div className="profile">
      <div className="header-glass" style={{ marginBottom: '2rem' }}>
        <div className="brand">
          <h1>{user.username} Profile</h1>
          <span>Chronos Citizen ID: {user.id.substring(0, 12)}...</span>
        </div>
        <div className="stats" style={{ gap: '2rem' }}>
          <div className="stat">
            <span className="stat-val food">{user.food}</span>
            <span className="stat-label">Food</span>
          </div>
          <div className="stat">
            <span className="stat-val fire">{user.fire}</span>
            <span className="stat-label">Fire</span>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Historic Grunts</h3>
      <div className="feed">
        {user.posts?.map((post: any) => (
          <div key={post.id} className="post">
            <div className="post-header">
              <span>{new Date(post.createdAt).toLocaleString()}</span>
              <span>{post.fireGenerated} Fire Gen</span>
            </div>
            <div className="post-content">
              {post.content}
            </div>
            <div className="post-actions">
               <Link to={`/posts/${post.id}`}>
                 <button>View Deep Echoes</button>
               </Link>
            </div>
          </div>
        ))}
        {user.posts?.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No neural broadcasts from this citizen.</div>}
      </div>
    </div>
  );
};

export default ProfilePage;
