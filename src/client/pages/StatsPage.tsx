import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { apiFetch } from '../lib/api';
import { ChartContainer, ChartTooltipContent, ResponsiveContainer, Tooltip, ChartConfig } from '../components/ui/chart';

const activityConfig: ChartConfig = {
  fire: { label: 'Fire', color: 'var(--color-fire-hot)' },
  food: { label: 'Food', color: '#ff6b6b' },
  posts: { label: 'Posts', color: 'var(--color-ice)' },
  replies: { label: 'Replies', color: 'var(--color-fire-warm)' },
  likes: { label: 'Likes', color: '#a855f7' },
  tribes: { label: 'Tribes', color: '#34d399' },
};

const timelineConfig: ChartConfig = {
  posts: { label: 'Posts', color: 'var(--color-fire-hot)' },
  replies: { label: 'Replies', color: 'var(--color-ice)' },
  likes: { label: 'Likes', color: '#a855f7' },
};

const summaryCards = [
  { key: 'fire', label: 'Global Fire', icon: '🔥' },
  { key: 'food', label: 'Global Food', icon: '🍖' },
  { key: 'posts', label: 'Posts', icon: '🪨' },
  { key: 'replies', label: 'Replies', icon: '💬' },
  { key: 'likes', label: 'Likes', icon: '👍' },
  { key: 'tribes', label: 'Tribes', icon: '🏕️' },
] as const;

const resourcePieColors = ['var(--color-fire-hot)', '#ff6b6b'];

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch('/stats');
      setStats(data);
    } catch (e) {
      console.error('Failed to load stats', e);
      setError(e instanceof Error ? e.message : 'Failed to load stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const resourcePieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Fire', value: stats.summary.fire },
      { name: 'Food', value: stats.summary.food },
    ];
  }, [stats]);

  if (loading) return <div className="loading-state">Carving stats in the cave wall...</div>;

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-card stats-error-card">
          <h1>🪨 The wall would not carve</h1>
          <p>Stats could not load.</p>
          <code className="error-msg">{error}</code>
          <button className="btn-carve" onClick={fetchStats}>
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return <div className="loading-state">Carving stats in the cave wall...</div>;

  return (
    <div className="content-view stats-view">
      <div className="content-header">
        <Link to="/" className="back-link stats-back-link">← Back to Cave Wall</Link>
        <h1>📊 Cave Stats</h1>
        <p className="content-subtitle">Global fire, food, and engagement across the whole cave land.</p>
      </div>

      <div className="stats-summary-grid">
        {summaryCards.map(card => (
          <div key={card.key} className="stats-summary-card">
            <div className="stats-summary-icon">{card.icon}</div>
            <div className="stats-summary-label">{card.label}</div>
            <div className="stats-summary-value">{Number(stats.summary[card.key]).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="stats-grid">
        <ChartContainer config={activityConfig} className="stats-chart-card">
          <div className="stats-chart-header">
            <h2>Global Resources</h2>
            <p>Fire and food totals across all cave people.</p>
          </div>
          <div className="stats-chart-body tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.activityBreakdown} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="metric" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="var(--color-fire-hot)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        <ChartContainer config={timelineConfig} className="stats-chart-card">
          <div className="stats-chart-header">
            <h2>Recent Activity</h2>
            <p>Posts, replies, and likes over the last 7 days.</p>
          </div>
          <div className="stats-chart-body tall">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.activityTimeline} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <Area type="monotone" dataKey="posts" stroke="var(--color-fire-hot)" fill="rgba(255,122,0,0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="replies" stroke="var(--color-ice)" fill="rgba(100,140,255,0.12)" strokeWidth={2} />
                <Area type="monotone" dataKey="likes" stroke="#a855f7" fill="rgba(168,85,247,0.10)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        <ChartContainer config={activityConfig} className="stats-chart-card stats-chart-card-side">
          <div className="stats-chart-header">
            <h2>Resource Mix</h2>
            <p>Relative balance between fire and food.</p>
          </div>
          <div className="stats-chart-body pie">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={resourcePieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={4}>
                  {resourcePieData.map((entry, index) => (
                    <Cell key={entry.name} fill={resourcePieColors[index % resourcePieColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      <div className="stats-top-users">
        <div className="stats-chart-header">
          <h2>Top Cave People</h2>
          <p>Sorted by fire, then posts and replies.</p>
        </div>
        <div className="stats-leaderboard-list">
          {stats.topUsers.map((user: any, index: number) => (
            <Link key={user.id} to={`/profile/${user.id}`} className="stats-leaderboard-row">
              <div className="stats-rank">#{index + 1}</div>
              <div className="stats-user-main">
                <div className="stats-user-name-row">
                  <span className="stats-user-name">{user.username}</span>
                  <span className={`character-badge ${user.isPlayerCharacter ? 'player' : 'npc'}`}>
                    {user.isPlayerCharacter ? 'Player' : 'AI'}
                  </span>
                </div>
                <div className="stats-user-meta">Posts {user.posts} · Replies {user.replies} · Likes {user.likesReceived}</div>
              </div>
              <div className="stats-user-points">
                <span>🔥 {user.fire}</span>
                <span>🍖 {user.food}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
