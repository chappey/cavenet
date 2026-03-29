import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import ProfileSidebar from '../components/ProfileSidebar';
import ThreadCard from '../components/ThreadCard';
import TribeCard from '../components/TribeCard';
import Composer from '../components/Composer';

interface ProfilePageProps {
  userId: string | null;
  onRefreshUser: () => void;
  onPost: (content: string, title?: string) => Promise<void>;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userId, onRefreshUser, onPost }) => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'threads' | 'tribes'>('threads');

  // Use route param if present, otherwise use logged-in user
  const profileId = id || userId;
  const isOwnProfile = !id || id === userId;

  const fetchProfile = async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      const data = await apiFetch(`/users/${profileId}`);
      setProfile(data);
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when profileId changes OR when userId changes (catches the race condition)
  useEffect(() => {
    fetchProfile();
  }, [profileId, userId]);

  const handleUpdateBio = async (bio: string) => {
    if (!profileId) return;
    try {
      await apiFetch(`/users/${profileId}/bio`, {
        method: 'PATCH',
        body: JSON.stringify({ bio }),
      });
      await fetchProfile();
      onRefreshUser();
    } catch (e: any) {
      alert(`Failed to update bio: ${e.message}`);
    }
  };

  if (loading && !profile) return <div className="loading-state">Loading cave...</div>;
  if (!profile) return <div className="error-state">Caveman not found</div>;

  return (
    <div className="two-column-layout">
      {/* Sidebar */}
      <ProfileSidebar
        name={profile.username}
        bio={profile.bio}
        avatar={profile.avatar}
        fire={profile.fire}
        food={profile.food}
        editable={isOwnProfile}
        onUpdateBio={handleUpdateBio}
      />

      {/* Main Content */}
      <div className="main-column">
        {/* Tabs */}
        <div className="tab-bar">
          <button
            className={`tab ${activeTab === 'threads' ? 'active' : ''}`}
            onClick={() => setActiveTab('threads')}
          >
            🪨 Posts
          </button>
          <button
            className={`tab ${activeTab === 'tribes' ? 'active' : ''}`}
            onClick={() => setActiveTab('tribes')}
          >
            🏕️ Tribes ({profile.tribes?.length ?? 0})
          </button>
        </div>

        {/* Threads Tab */}
        {activeTab === 'threads' && (
          <div className="tab-content">
            {isOwnProfile && (
              <Composer
                onSubmit={async (content, title) => {
                  await onPost(content, title);
                  await fetchProfile();
                }}
                placeholder="Carve something on your cave wall..."
                cost={2}
                costLabel="🍖 Food"
                showTitle
              />
            )}
            <div className="feed">
              {profile.threads?.map((thread: any) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
              {(!profile.threads || profile.threads.length === 0) && (
                <div className="feed-empty">This caveman has not posted yet.</div>
              )}
            </div>
          </div>
        )}

        {/* Tribes Tab */}
        {activeTab === 'tribes' && (
          <div className="tab-content">
            <div className="card-grid">
              {profile.tribes?.map((tribe: any) => (
                <TribeCard key={tribe.tribeId} tribe={tribe} />
              ))}
              {(!profile.tribes || profile.tribes.length === 0) && (
                <div className="feed-empty">Not part of any tribe yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
