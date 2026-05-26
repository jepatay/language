import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/conversation', label: 'Chat', icon: '💬' },
  { to: '/games', label: 'Games', icon: '🎮' },
  { to: '/activities', label: 'Practice', icon: '🎯' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
