import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import ProfileSidebar from '../components/ProfileSidebar';
import ThreadCard from '../components/ThreadCard';
import UserCard from '../components/UserCard';
import Composer from '../components/Composer';

interface TribePageProps {
  userId: string | null;
  onRefreshUser: () => void;
}

const TribePage: React.FC<TribePageProps> = ({ userId, onRefreshUser }) => {
  const { id } = useParams<{ id: string }>();
  const [tribe, setTribe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'threads' | 'members'>('threads');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTribe = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch(`/tribes/${id}`);
      setTribe(data);
    } catch (e: any) {
      console.error('Failed to load tribe', e);
      setError(e.message || 'The spirits are blocking access to this tribe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTribe();
  }, [id]);

  const isMember = tribe?.members?.some((m: any) => m.id === userId);

  const handleJoin = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      await apiFetch(`/tribes/${id}/join`, { method: 'POST' });
      await fetchTribe();
      onRefreshUser();
    } catch (e: any) {
      alert(`Failed to join: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      await apiFetch(`/tribes/${id}/leave`, { method: 'POST' });
      await fetchTribe();
      onRefreshUser();
    } catch (e: any) {
      alert(`Failed to leave: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async (content: string, title?: string) => {
    if (!id) return;
    try {
      await apiFetch('/threads', {
        method: 'POST',
        body: JSON.stringify({
          type: 'text',
          content,
          title: title || content.substring(0, 40),
          tribeId: id,
        }),
      });
      await fetchTribe();
      onRefreshUser();
    } catch (e: any) {
      alert(`Failed to post: ${e.message}`);
      throw e;
    }
  };

  if (loading && !tribe) return (
    <div className="loading-state">
      <div className="spinner">🔥</div>
      <p>Finding the tribe's camp...</p>
    </div>
  );

  if (error && !tribe) return (
    <div className="error-state">
      <div className="error-icon">🌋</div>
      <h3>Tribe is Hidden</h3>
      <p>{error}</p>
      <button className="btn-carve" onClick={fetchTribe}>
        🔄 Seek the Camp Again
      </button>
    </div>
  );

  if (!tribe) return <div className="error-state">Tribe not found</div>;

  const totalFire = tribe.members?.reduce((s: number, m: any) => s + (m.fire ?? 0), 0) ?? 0;

  return (
    <div className="two-column-layout">
      {/* Sidebar */}
      <ProfileSidebar
        name={tribe.name}
        abbreviation={tribe.abbreviation}
        bio={tribe.description}
        avatar={tribe.avatar}
        fire={totalFire}
        food={0}
        type="tribe"
        memberCount={tribe.memberCount ?? tribe.members?.length ?? 0}
        extra={
          userId && (
            <div className="sidebar-actions">
              {isMember ? (
                <button className="btn-leave" onClick={handleLeave} disabled={actionLoading}>
                  {actionLoading ? '...' : 'Leave Tribe'}
                </button>
              ) : (
                <button className="btn-join" onClick={handleJoin} disabled={actionLoading}>
                  {actionLoading ? '...' : 'Join Tribe'}
                </button>
              )}
            </div>
          )
        }
      />

      {/* Main Content */}
      <div className="main-column">
        <div className="tab-bar">
          <button
            className={`tab ${activeTab === 'threads' ? 'active' : ''}`}
            onClick={() => setActiveTab('threads')}
          >
            🪨 Posts
          </button>
          <button
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            👥 Members ({tribe.members?.length ?? 0})
          </button>
        </div>

        {activeTab === 'threads' && (
          <div className="tab-content">
            {isMember && (
              <Composer
                onSubmit={handlePost}
                placeholder={`Post to the ${tribe.name} wall...`}
                cost={2}
                costLabel="🍖 Food"
                showTitle
              />
            )}
            <div className="feed">
              {tribe.threads?.map((thread: any) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
              {(!tribe.threads || tribe.threads.length === 0) && (
                <div className="feed-empty">No posts in this tribe yet.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="tab-content">
            <div className="card-grid">
              {tribe.members?.map((member: any) => (
                <UserCard key={member.id} user={member} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TribePage;
