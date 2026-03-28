import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';

interface LayoutProps {
  user: any;
  attemptRecovery: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, attemptRecovery }) => {
  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-800 p-4 hidden md:block">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-orange-400">Cavenet</h2>
          <p className="text-sm text-gray-400">Tribe Social</p>
        </div>
        <nav className="space-y-2">
          <Link to="/" className="block px-4 py-2 rounded hover:bg-slate-700 text-white">
            🏠 Tribe Feed
          </Link>
          <Link to="/profile" className="block px-4 py-2 rounded hover:bg-slate-700 text-white">
            👤 Profile
          </Link>
          <div className="mt-8">
            <div className="text-sm text-gray-400 mb-2">Resources</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>🍖 Food</span>
                <span>{user?.food ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>🔥 Fire</span>
                <span>{user?.fire ?? 0}</span>
              </div>
            </div>
          </div>
          <button
            onClick={attemptRecovery}
            className="block w-full text-left px-4 py-2 rounded hover:bg-slate-700 text-white text-sm"
            title="Emergency Recovery"
          >
            🔄 Recovery
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-8">
        {/* MOBILE HEADER */}
        <div className="md:hidden mb-4 bg-slate-800 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <Link to="/" className="text-xl font-bold text-orange-400">Cavenet</Link>
            <div className="flex space-x-4">
              <Link to="/profile" className="text-white">👤</Link>
              <div className="text-white">🍖 {user?.food ?? 0}</div>
              <div className="text-white">🔥 {user?.fire ?? 0}</div>
              <button onClick={attemptRecovery} className="text-white" title="Recovery">🔄</button>
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
