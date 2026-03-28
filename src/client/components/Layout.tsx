import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  user: any;
  users: any[];
  onSwitchUser: (id: string) => void;
  onRecovery: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, users, onSwitchUser, onRecovery }) => {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-layout">
      {/* TOP NAV */}
      <nav className="top-nav">
        <div className="nav-inner">
          {/* Brand */}
          <Link to="/" className="nav-brand">
            <span className="brand-icon">🔥</span>
            <span className="brand-text">Cavenet</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="nav-links desktop-only">
            <Link to="/" className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
              🏔️ Cave Wall
            </Link>
            <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
              👤 My Cave
            </Link>
            <Link to="/tribes" className={`nav-link ${isActive('/tribes') ? 'active' : ''}`}>
              🏕️ Tribes
            </Link>
          </div>

          {/* Resources + User Switcher */}
          <div className="nav-right">
            {user && (
              <div className="nav-resources desktop-only">
                <span className="resource" title="Food">🍖 {user.food}</span>
                <span className="resource" title="Fire">🔥 {user.fire}</span>
              </div>
            )}

            {/* User Switcher */}
            <div className="user-switcher">
              <button
                className="switcher-btn"
                onClick={() => setSwitcherOpen(!switcherOpen)}
              >
                <span className="switcher-avatar">
                  {user ? user.username[0].toUpperCase() : '?'}
                </span>
                <span className="switcher-name desktop-only">
                  {user?.username ?? 'Select'}
                </span>
                <span className="switcher-chevron">▾</span>
              </button>

              {switcherOpen && (
                <div className="switcher-dropdown">
                  <div className="switcher-label">Switch Caveman</div>
                  {users.map(u => (
                    <button
                      key={u.id}
                      className={`switcher-option ${u.id === user?.id ? 'selected' : ''}`}
                      onClick={() => {
                        onSwitchUser(u.id);
                        setSwitcherOpen(false);
                      }}
                    >
                      <span className="switcher-option-avatar">{u.username[0].toUpperCase()}</span>
                      <span className="switcher-option-info">
                        <span className="switcher-option-name">{u.username}</span>
                        <span className="switcher-option-stats">🍖{u.food} 🔥{u.fire}</span>
                      </span>
                    </button>
                  ))}
                  <div className="switcher-divider" />
                  <button className="switcher-option recovery" onClick={() => { onRecovery(); setSwitcherOpen(false); }}>
                    🔄 Emergency Recovery
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="mobile-menu-btn mobile-only" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              ☰
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="mobile-nav">
            <Link to="/" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>🏔️ Cave Wall</Link>
            <Link to="/profile" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>👤 My Cave</Link>
            <Link to="/tribes" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>🏕️ Tribes</Link>
            {user && (
              <div className="mobile-nav-resources">
                <span>🍖 {user.food}</span>
                <span>🔥 {user.fire}</span>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Click-away backdrop for switcher */}
      {switcherOpen && <div className="backdrop" onClick={() => setSwitcherOpen(false)} />}

      {/* MAIN */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
