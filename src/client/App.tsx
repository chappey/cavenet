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

  // Fetch all available users (for switcher + character select)
  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch('/users');
      setAllUsers(data);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  }, []);

  // Fetch current user data
  const fetchMe = useCallback(async () => {
    if (!userId) { setUser(null); return; }
    try {
      const data = await apiFetch('/me');
      setUser(data);
    } catch (e) {
      console.error('Failed to load user', e);
    }
  }, [userId]);

  // Fetch feed
  const fetchFeed = useCallback(async (sort?: string) => {
    try {
      const s = sort ?? currentSort;
      const data = await apiFetch(`/feed?sort=${s}`);
      setFeed(data);
    } catch (e) {
      console.error('Failed to load feed', e);
    }
  }, [currentSort]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUsers();
      if (userId) {
        await Promise.all([fetchMe(), fetchFeed()]);
      }
      setLoading(false);
    };
    init();
  }, []);

  // When user changes
  useEffect(() => {
    if (userId) {
      fetchMe();
      fetchFeed();
    } else {
      setUser(null);
    }
  }, [userId]);

  const handleSwitchUser = (id: string) => {
    setCurrentUserId(id);
    setUserId(id);
  };

  const handlePost = async (content: string) => {
    await apiFetch('/threads', {
      method: 'POST',
      body: JSON.stringify({ type: 'text', content, title: content.substring(0, 40) }),
    });
    await Promise.all([fetchFeed(), fetchMe(), fetchUsers()]);
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

  // Show character select if no user chosen
  if (!userId || (!user && !loading)) {
    if (allUsers.length === 0 && loading) {
      return <div className="loading-state">Loading Cavenet...</div>;
    }
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
          <ProfilePage currentUser={user} onRefreshUser={refreshUser} onPost={handlePost} />
        } />
        <Route path="profile/:id" element={
          <ProfilePage currentUser={user} onRefreshUser={refreshUser} onPost={handlePost} />
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
