import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { apiFetch, setCurrentUserId, getCurrentUserId } from './lib/api';
import { useToast } from './components/ui/toast';
import type {
  CreateCharacterInput,
  CreateThreadInput,
  FeedSort,
  FeedResponse,
  ThreadSummary,
  UserProfile,
  UserSummary,
} from 'src/shared/contracts';

const Layout = lazy(() => import('./components/Layout'));
const CharacterSelect = lazy(() => import('./pages/CharacterSelect'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ThreadPage = lazy(() => import('./pages/ThreadPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TribePage = lazy(() => import('./pages/TribePage'));
const TribesListPage = lazy(() => import('./pages/TribesListPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const HuntGamePage = lazy(() => import('./pages/HuntGamePage'));

function App() {
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [feed, setFeed] = useState<FeedResponse>([]);
  const [currentSort, setCurrentSort] = useState<FeedSort>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characterPanelMode, setCharacterPanelMode] = useState<'select' | 'manage' | null>(userId ? null : 'select');
  const { error: showError, info: showInfo } = useToast();

  const fetchUsers = useCallback(async () => {
    try {
      const activeUserId = getCurrentUserId();
      const data = await apiFetch<UserSummary[]>('/users');
      setAllUsers(data);
      if (activeUserId && !data.some((u) => u.id === activeUserId)) {
        setCurrentUserId(null);
        setUserId(null);
        setUser(null);
        setFeed([]);
        setCharacterPanelMode('select');
      }
      setError(null);
    } catch (e: any) {
      console.error('Failed to load users', e);
      const message = e instanceof Error ? e.message : 'Failed to connect to the caveland.';
      setError(message);
      showError('Could not load users', message);
    }
  }, [showError]);

  const fetchMe = useCallback(async () => {
    if (!userId) { setUser(null); return; }
    try {
      const data = await apiFetch<UserProfile | null>('/me');
      setUser(data);
    } catch (e: any) {
      console.error('Failed to load user', e);
    }
  }, [userId]);

  const fetchFeed = useCallback(async (sort?: string) => {
    try {
      const s = (sort ?? currentSort) as FeedSort;
      const data = await apiFetch<FeedResponse>(`/feed?sort=${s}`);
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
    setCharacterPanelMode(null);
  };

  const handleCreateCharacter = async (input: CreateCharacterInput) => {
    try {
      const created = await apiFetch<UserSummary>('/users', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await fetchUsers();
      setCurrentUserId(created.id);
      setUserId(created.id);
      setCharacterPanelMode(null);
      showInfo('Character created', `${created.username} joins the cave.`);
      return created;
    } catch (e: any) {
      const message = e instanceof Error ? e.message : 'Failed to create character.';
      showError('Character creation failed', message);
      throw e;
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    try {
      await apiFetch(`/users/${id}`, { method: 'DELETE' });
      await fetchUsers();
      if (userId === id) {
        setCurrentUserId(null);
        setUserId(null);
        setUser(null);
        setFeed([]);
        setCharacterPanelMode('select');
      }
      showInfo('Character removed', 'The cave forgets one face.');
    } catch (e: any) {
      const message = e instanceof Error ? e.message : 'Failed to delete character.';
      showError('Could not delete character', message);
      throw e;
    }
  };

  const openCharacterManager = () => {
    setCharacterPanelMode('manage');
  };

  const closeCharacterPanel = () => {
    setCharacterPanelMode(userId ? null : 'select');
  };

  const handlePost = async (content: string, title?: string) => {
    if (!userId) {
      showError('Select a character first', 'Pick a cave person before posting.');
      return;
    }
    try {
      const payload: CreateThreadInput = {
        type: 'text',
        content,
        title: title || content.substring(0, 40),
      };

      await apiFetch('/threads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await Promise.all([fetchFeed(), fetchMe(), fetchUsers()]);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : 'Failed to post.';
      showError('Post failed', message);
      throw e;
    }
  };

  const handleSortChange = async (sort: FeedSort) => {
    setCurrentSort(sort);
    await fetchFeed(sort);
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
      <Suspense fallback={<div className="loading-state">Loading characters...</div>}>
        <CharacterSelect
          users={allUsers}
          mode="select"
          loading
          currentUserId={userId}
          onSelect={handleSwitchUser}
          onCreateCharacter={handleCreateCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onOpenManage={openCharacterManager}
          onClose={closeCharacterPanel}
        />
      </Suspense>
    );
  }

  // Show character select if no user chosen
  if (characterPanelMode || !userId) {
    return (
      <Suspense fallback={<div className="loading-state">Loading characters...</div>}>
        <CharacterSelect
          users={allUsers}
          mode={characterPanelMode ?? 'select'}
          currentUserId={userId}
          onSelect={handleSwitchUser}
          onCreateCharacter={handleCreateCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onOpenManage={openCharacterManager}
          onClose={closeCharacterPanel}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="loading-state">Loading cave...</div>}>
      <Routes>
        <Route element={
          <Layout
            user={user}
            users={allUsers}
            onSwitchUser={handleSwitchUser}
            onManageCharacters={openCharacterManager}
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
          <Route path="leaderboard" element={
            <LeaderboardPage users={allUsers} currentUserId={userId} />
          } />
          <Route path="stats" element={
            <StatsPage />
          } />
          <Route path="games/hunt" element={
            <HuntGamePage userId={userId} onRefreshUser={refreshUser} />
          } />
          <Route path="tribes/:id" element={
            <TribePage userId={userId} onRefreshUser={refreshUser} />
          } />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
