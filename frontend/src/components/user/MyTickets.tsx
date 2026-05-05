'use client';
import QR from '../shared/QR';
import Empty from '../shared/Empty';
import { fmtDate, fmtTime, fmtMoney } from '@/lib/helpers';
import type { FrontendTicket, FrontendEvent } from '@/types';

interface MyTicketsProps {
  store: {
    tickets: FrontendTicket[];
    events: FrontendEvent[];
  };
  onBrowse: () => void;
}

export default function MyTickets({ store, onBrowse }: MyTicketsProps) {
  const { tickets, events } = store;

  if (tickets.length === 0) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>My tickets</h1>
            <p>Your purchased tickets and QR codes.</p>
          </div>
        </div>
        <Empty
          title="No tickets yet"
          body="Once you book an event, your tickets will appear here."
          action={
            <button className="btn btn--primary" onClick={onBrowse}>
              Browse events
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My tickets</h1>
          <p>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} · show the QR at the venue.
          </p>
        </div>
      </div>
      <div className="tickets-list">
        {tickets.map((t) => {
          const ev = events.find((e) => e.id === t.eventId);
          const tier = ev?.tiers.find((x) => x.id === t.tierId);

          return (
            <div key={t.id} className="ticket">
              <div className="ticket__main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {tier && (
                    <span
                      style={{ width: 8, height: 8, borderRadius: 2, background: tier.color }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}
                  >
                    {tier?.name ?? 'Ticket'} · {t.qty} {t.qty === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>
                {ev ? (
                  <>
                    <h3>{ev.name}</h3>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {ev.venueName ?? '—'} · {fmtDate(ev.date)} · {fmtTime(ev.date)}
                    </div>
                  </>
                ) : (
                  <h3>Order #{t.id.slice(-6).toUpperCase()}</h3>
                )}
                {t.seats.length > 0 && (
                  <div className="ticket__seats">
                    {t.seats.map((s) => (
                      <span key={s} className="seat-tag">{s}</span>
                    ))}
                  </div>
                )}
                <div className="ticket__meta">
                  <span>Order <b>#{t.id.slice(-6).toUpperCase()}</b></span>
                  <span>Paid <b>{fmtMoney(t.total)}</b></span>
                  <span className="status-dot">Confirmed</span>
                </div>
              </div>
              <div className="ticket__qr">
                <QR value={t.id} size={84} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
