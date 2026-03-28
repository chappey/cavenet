import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';

interface LayoutProps {
  user: any;
  attemptRecovery: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, attemptRecovery }) => {
  return (
    <div className="cavenet-container">
      {/* HUD HEADER */}
      <div className="header-glass">
        <div className="brand">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>CaveFeed</h1>
          </Link>
          <span>Tribe Message Board</span>
        </div>
        <div className="stats">
          <Link to="/profile" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
             <span className="stat-label">Profile</span>
          </Link>
          <div className="stat" onClick={attemptRecovery} style={{ cursor: 'pointer' }} title="Emergency Recovery">
            <span className="stat-val food">{user?.food ?? 0}</span>
            <span className="stat-label">Food</span>
          </div>
          <div className="stat">
            <span className="stat-val fire">{user?.fire ?? 0}</span>
            <span className="stat-label">Fire</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
