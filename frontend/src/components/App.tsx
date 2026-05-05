'use client';
import { useState, useEffect } from 'react';
import Login from './Login';
import TopBar from './TopBar';
import AdminEvents from './admin/AdminEvents';
import AdminVenues from './admin/AdminVenues';
import EventForm from './admin/EventForm';
import Browse from './user/Browse';
import EventDetail from './user/EventDetail';
import Checkout from './user/Checkout';
import MyTickets from './user/MyTickets';
import PurchaseSuccess from './user/PurchaseSuccess';
import { useAppStore } from '@/lib/store';
import { getToken, clearToken } from '@/lib/api-client';
import type { AuthUser, FrontendEvent, FrontendTicket } from '@/types';

interface HoldInfo {
  eventId: string;
  tierId: string;
  qty: number;
  seats: string[];
  total: number;
  ticketIds: string[];
  expiresAt: string;
}

const HOLD_SECONDS = 300;

function hexToRgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function shade(hex: string, percent: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const adjust = (c: number) => Math.max(0, Math.min(255, Math.round(c + (c * percent) / 100)));
  const toHex = (c: number) => adjust(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [route, setRoute] = useState('browse');
  const [editingEvent, setEditingEvent] = useState<FrontendEvent | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [hold, setHold] = useState<HoldInfo | null>(null);
  const [success, setSuccess] = useState<FrontendTicket | null>(null);

  const store = useAppStore(user?.id ?? null);

  // Apply accent color
  useEffect(() => {
    const accent = '#5b5bf5';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-soft', hexToRgba(accent, 0.08));
    document.documentElement.style.setProperty('--accent-border', hexToRgba(accent, 0.22));
    document.documentElement.style.setProperty('--accent-hover', shade(accent, -10));
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      // We have a token but need user info — try to parse from JWT payload
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const name = (payload.username as string)
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        setUser({
          id: payload.sub,
          username: payload.username,
          name,
          role: (payload.role ?? 'user') as 'admin' | 'user',
          token,
        });
      } catch {
        clearToken();
      }
    }
  }, []);

  // Set initial route on login
  useEffect(() => {
    if (user) {
      setRoute(user.role === 'admin' ? 'admin/events' : 'browse');
    }
  }, [user]);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setRoute('browse');
  };

  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === 'admin';

  const onCheckoutFromDetail = (h: HoldInfo) => {
    setHold(h);
    setOpenEventId(null);
    setRoute('checkout');
  };

  const onPaid = (ticket: FrontendTicket) => {
    store.addTicket(ticket);
    store.markSeatsTaken(ticket.eventId, ticket.seats);
    setSuccess(ticket);
    setHold(null);
    setRoute('success');
  };

  const onCancelHold = () => {
    setHold(null);
    setRoute('browse');
  };

  return (
    <div className="app">
      <TopBar
        user={user}
        route={route}
        onRoute={(r) => {
          setRoute(r);
          setOpenEventId(null);
          setHold(null);
          setSuccess(null);
        }}
        onLogout={handleLogout}
      />

      <main className="page">
        {/* Admin */}
        {isAdmin && route === 'admin/events' && (
          <AdminEvents
            store={store}
            onCreate={() => setCreatingEvent(true)}
            onEdit={(ev) => setEditingEvent(ev)}
          />
        )}
        {isAdmin && route === 'admin/venues' && (
          <AdminVenues venues={store.venues} onUpsert={store.upsertVenue} />
        )}

        {/* User */}
        {!isAdmin && route === 'browse' && !openEventId && (
          <Browse store={store} onOpen={(id) => setOpenEventId(id)} />
        )}
        {!isAdmin && route === 'browse' && openEventId && (
          <EventDetail
            store={store}
            eventId={openEventId}
            onBack={() => setOpenEventId(null)}
            onCheckout={onCheckoutFromDetail}
          />
        )}
        {!isAdmin && route === 'checkout' && hold && (
          <Checkout
            store={store}
            hold={hold}
            holdSeconds={HOLD_SECONDS}
            onCancel={onCancelHold}
            onPaid={onPaid}
          />
        )}
        {!isAdmin && route === 'success' && success && (
          <PurchaseSuccess
            ticket={success}
            event={store.events.find((e) => e.id === success.eventId)}
            onView={() => { setSuccess(null); setRoute('tickets'); }}
            onMore={() => { setSuccess(null); setRoute('browse'); }}
          />
        )}
        {!isAdmin && route === 'tickets' && (
          <MyTickets store={store} onBrowse={() => setRoute('browse')} />
        )}
      </main>

      {/* Admin modals */}
      {creatingEvent && (
        <EventForm
          venues={store.venues}
          onClose={() => setCreatingEvent(false)}
          onSave={(ev) => store.upsertEvent(ev)}
        />
      )}
      {editingEvent && (
        <EventForm
          existing={editingEvent}
          venues={store.venues}
          onClose={() => setEditingEvent(null)}
          onSave={(ev) => store.upsertEvent(ev)}
        />
      )}
    </div>
  );
}
