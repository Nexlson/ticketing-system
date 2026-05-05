'use client';
import Icon from './shared/Icon';
import type { AuthUser } from '@/types';

interface TopBarProps {
  user: AuthUser;
  route: string;
  onRoute: (r: string) => void;
  onLogout: () => void;
}

export default function TopBar({ user, route, onRoute, onLogout }: TopBarProps) {
  const isAdmin = user.role === 'admin';
  const links = isAdmin
    ? [
        { id: 'admin/events', label: 'Events' },
        { id: 'admin/venues', label: 'Venues' },
      ]
    : [
        { id: 'browse', label: 'Browse' },
        { id: 'tickets', label: 'My Tickets' },
      ];

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <div className="topbar__brand-mark">T</div>
        Tixley
      </div>
      <nav className="topbar__nav">
        {links.map((l) => (
          <button
            key={l.id}
            className={route.startsWith(l.id) ? 'is-active' : ''}
            onClick={() => onRoute(l.id)}
          >
            {l.label}
          </button>
        ))}
      </nav>
      <div className="topbar__user">
        <span className="role-pill">{user.role}</span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{user.name}</span>
        <div className="avatar">{user.name[0]?.toUpperCase()}</div>
        <button className="btn-ghost" onClick={onLogout} title="Sign out">
          <Icon name="logout" />
        </button>
      </div>
    </header>
  );
}
