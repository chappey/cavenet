import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { treaty } from '@elysiajs/eden';
import type { App as AppType } from '../server/index';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PostPage from './pages/PostPage';
import ProfilePage from './pages/ProfilePage';

const api = treaty<AppType>(window.location.origin);

function App() {
  const [user, setUser] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchState = async () => {
    try {
      setLoading(true);
      const [meRes, feedRes] = await Promise.all([
        api.api.me.get(),
        api.api.feed.get()
      ]);

      if (meRes.data) setUser(meRes.data);
      if (feedRes.data) setFeed(feedRes.data as any[]);
    } catch (e) {
      console.error("Failed to load state", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handlePost = async () => {
    if (!content.trim()) return;
    const { error } = await api.api.posts.post({
      type: 'text',
      content: content,
    });
    if (!error) {
      setContent('');
      await fetchState();
    } else {
      alert(`Simulation Error: ${error.value}`);
    }
  };

  const handleLike = async (id: string) => {
    await api.api.posts({ id }).like.post();
    await fetchState();
  };

  const handleReply = async (id: string) => {
     const text = prompt("Enter primitive reply:");
     if (!text) return;
     await api.api.posts({ id }).replies.post({ content: text });
     await fetchState();
  };

  const attemptRecovery = async () => {
     const { data, error } = await api.api.recovery.post();
     if (data) alert(`Chronos Admin granted you ${data.reward} food.`);
     if (error) alert(`Recovery denied: ${error.value}`);
     await fetchState();
  };

  // Remove the blocking loader for a faster perceived experience
  // The layout will handle showing partial loading states if needed


  return (
    <Routes>
      <Route element={<Layout user={user} attemptRecovery={attemptRecovery} />}>
        <Route index element={
          <HomePage 
            feed={feed} 
            content={content} 
            setContent={setContent} 
            handlePost={handlePost} 
            handleLike={handleLike} 
            handleReply={handleReply} 
          />
        } />
        <Route path="posts/:id" element={
          <PostPage 
            handleLike={handleLike} 
            handleReply={handleReply} 
          />
        } />
        <Route path="profile" element={<ProfilePage currentUser={user} />} />
        <Route path="profile/:id" element={<ProfilePage currentUser={user} />} />
      </Route>
    </Routes>
  );
}

export default App;
