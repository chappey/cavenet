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
  const [activeTab, setActiveTab] = useState<'threads' | 'members'>('threads');

  const fetchTribe = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await apiFetch(`/tribes/${id}`);
      setTribe(data);
    } catch (e) {
      console.error('Failed to load tribe', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTribe();
  }, [id]);

  const isMember = tribe?.members?.some((m: any) => m.id === userId);

  const handleJoin = async () => {
    if (!id) return;
    await apiFetch(`/tribes/${id}/join`, { method: 'POST' });
    await fetchTribe();
    onRefreshUser();
  };

  const handleLeave = async () => {
    if (!id) return;
    await apiFetch(`/tribes/${id}/leave`, { method: 'POST' });
    await fetchTribe();
    onRefreshUser();
  };

  const handlePost = async (content: string) => {
    if (!id) return;
    await apiFetch('/threads', {
      method: 'POST',
      body: JSON.stringify({
        type: 'text',
        content,
        title: content.substring(0, 40),
        tribeId: id,
      }),
    });
    await fetchTribe();
    onRefreshUser();
  };

  if (loading) return <div className="loading-state">Loading tribe...</div>;
  if (!tribe) return <div className="error-state">Tribe not found</div>;

  // Sum fire across all members for sidebar glow
  const totalFire = tribe.members?.reduce((s: number, m: any) => s + (m.fire ?? 0), 0) ?? 0;

  return (
    <div className="two-column-layout">
      {/* Sidebar */}
      <ProfileSidebar
        name={tribe.name}
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
                <button className="btn-leave" onClick={handleLeave}>Leave Tribe</button>
              ) : (
                <button className="btn-join" onClick={handleJoin}>Join Tribe</button>
              )}
            </div>
          )
        }
      />

      {/* Main Content */}
      <div className="main-column">
        {/* Tabs */}
        <div className="tab-bar">
          <button
            className={`tab ${activeTab === 'threads' ? 'active' : ''}`}
            onClick={() => setActiveTab('threads')}
          >
            🪨 Carvings
          </button>
          <button
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            👥 Members ({tribe.members?.length ?? 0})
          </button>
        </div>

        {/* Threads Tab */}
        {activeTab === 'threads' && (
          <div className="tab-content">
            {isMember && (
              <Composer
                onSubmit={handlePost}
                placeholder={`Carve into the ${tribe.name} wall...`}
                cost={2}
                costLabel="🍖 Food"
              />
            )}
            <div className="feed">
              {tribe.threads?.map((thread: any) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
              {(!tribe.threads || tribe.threads.length === 0) && (
                <div className="feed-empty">No carvings in this tribe yet.</div>
              )}
            </div>
          </div>
        )}

        {/* Members Tab */}
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
