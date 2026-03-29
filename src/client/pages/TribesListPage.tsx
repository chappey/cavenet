import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import TribeCard from '../components/TribeCard';

interface TribesListPageProps {
  userId: string | null;
  onRefreshUser: () => void;
}

const TribesListPage: React.FC<TribesListPageProps> = ({ userId, onRefreshUser }) => {
  const [tribes, setTribes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchTribes = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>('/tribes');
      setTribes(data);
    } catch (e) {
      console.error('Failed to load tribes', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTribes();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await apiFetch('/tribes', {
        method: 'POST',
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      setNewName('');
      setNewDesc('');
      setCreating(false);
      await fetchTribes();
      onRefreshUser();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  if (loading) return <div className="loading-state">Loading tribes...</div>;

  return (
    <div className="content-view">
      <div className="content-header">
        <h1>🏕️ Tribes</h1>
        <p className="content-subtitle">Communities of the cave land</p>
      </div>

      {userId && (
        <div className="tribes-actions">
          {!creating ? (
            <button className="btn-carve" onClick={() => setCreating(true)}>
              🏔️ Found New Tribe (3 🍖)
            </button>
          ) : (
            <div className="tribe-create-form">
              <input
                type="text"
                placeholder="Tribe name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="tribe-input"
              />
              <input
                type="text"
                placeholder="Description..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="tribe-input"
              />
              <div className="tribe-create-actions">
                <button className="btn-carve" onClick={handleCreate} disabled={!newName.trim()}>
                  🪨 Found Tribe
                </button>
                <button className="btn-cancel" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card-grid tribes-grid">
        {tribes.map(tribe => (
          <TribeCard key={tribe.id} tribe={tribe} />
        ))}
        {tribes.length === 0 && (
          <div className="feed-empty">No tribes have been founded yet.</div>
        )}
      </div>
    </div>
  );
};

export default TribesListPage;
