import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { apiFetch, setCurrentUserId, getCurrentUserId } from './lib/api';
import Layout from './components/Layout';
import CharacterSelect from './pages/CharacterSelect';
import HomePage from './pages/HomePage';
import ThreadPage from './pages/ThreadPage';
import ProfilePage from './pages/ProfilePage';
import TribePage from './pages/TribePage';
import TribesListPage from './pages/TribesListPage';

function App() {
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  const [user, setUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [currentSort, setCurrentSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch('/users');
      setAllUsers(data);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load users', e);
      setError(e.message || 'Failed to connect to the caveland.');
    }
  }, []);

  const fetchMe = useCallback(async () => {
    if (!userId) { setUser(null); return; }
    try {
      const data = await apiFetch('/me');
      setUser(data);
    } catch (e: any) {
      console.error('Failed to load user', e);
    }
  }, [userId]);

  const fetchFeed = useCallback(async (sort?: string) => {
    try {
      const s = sort ?? currentSort;
      const data = await apiFetch(`/feed?sort=${s}`);
      setFeed(data);
    } catch (e: any) {
      console.error('Failed to load feed', e);
    }
  }, [currentSort]);

  // Initial load — fetch users first, then me + feed in parallel
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUsers();
      setLoading(false);
    };
    init();
  }, [fetchUsers]);

  // When userId changes (on select or switch), fetch me + feed
  useEffect(() => {
    if (userId) {
      Promise.all([fetchMe(), fetchFeed()]);
    } else {
      setUser(null);
      setFeed([]);
    }
  }, [userId, fetchMe, fetchFeed]);

  const handleSwitchUser = (id: string) => {
    setCurrentUserId(id);
    setUserId(id);
  };

  const handlePost = async (content: string, title?: string) => {
    try {
      await apiFetch('/threads', {
        method: 'POST',
        body: JSON.stringify({
          type: 'text',
          content,
          title: title || content.substring(0, 40),
        }),
      });
      await Promise.all([fetchFeed(), fetchMe(), fetchUsers()]);
    } catch (e: any) {
      alert(`Failed to post: ${e.message}`);
      throw e; // Re-throw so Composer knows it failed
    }
  };

  const handleSortChange = async (sort: string) => {
    setCurrentSort(sort);
    await fetchFeed(sort);
  };

  const handleRecovery = async () => {
    try {
      const data = await apiFetch('/recovery', { method: 'POST' });
      alert(`The tribe gave you ${data.reward} 🍖 food.`);
      await Promise.all([fetchMe(), fetchUsers()]);
    } catch (e: any) {
      alert(`Recovery denied: ${e.message}`);
    }
  };

  const refreshUser = async () => {
    await Promise.all([fetchMe(), fetchUsers()]);
  };

  const handleRetry = async () => {
    setError(null);
    setLoading(true);
    await fetchUsers();
    setLoading(false);
  };

  // Show error screen if we can't even get the user list
  if (error && allUsers.length === 0) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <h1>🌪️ Storm Over CaveLand</h1>
          <p>We cannot reach the cave at this moment. The connection is weak.</p>
          <code className="error-msg">{error}</code>
          <button className="btn-carve" onClick={handleRetry}>
            🔄 Try Reconnecting
          </button>
        </div>
      </div>
    );
  }

  // Show loading state if we have no users yet
  if (loading && allUsers.length === 0) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner">🔥</div>
          <p>Lighting the torches...</p>
        </div>
      </div>
    );
  }

  // Show character select if no user chosen
  if (!userId) {
    return (
      <CharacterSelect
        users={allUsers}
        onSelect={handleSwitchUser}
      />
    );
  }

  return (
    <Routes>
      <Route element={
        <Layout
          user={user}
          users={allUsers}
          onSwitchUser={handleSwitchUser}
          onRecovery={handleRecovery}
        />
      }>
        <Route index element={
          <HomePage
            feed={feed}
            onPost={handlePost}
            onSortChange={handleSortChange}
            currentSort={currentSort}
            userId={userId}
          />
        } />
        <Route path="threads/:id" element={
          <ThreadPage userId={userId} onRefreshUser={refreshUser} />
        } />
        <Route path="profile" element={
          <ProfilePage userId={userId} onRefreshUser={refreshUser} onPost={handlePost} />
        } />
        <Route path="profile/:id" element={
          <ProfilePage userId={userId} onRefreshUser={refreshUser} onPost={handlePost} />
        } />
        <Route path="tribes" element={
          <TribesListPage userId={userId} onRefreshUser={refreshUser} />
        } />
        <Route path="tribes/:id" element={
          <TribePage userId={userId} onRefreshUser={refreshUser} />
        } />
      </Route>
    </Routes>
  );
}

export default App;
