'use client';
import Icon from '../shared/Icon';
import { fmtDate, fmtMoney } from '@/lib/helpers';
import type { FrontendTicket, FrontendEvent } from '@/types';

interface PurchaseSuccessProps {
  ticket: FrontendTicket;
  event?: FrontendEvent;
  onView: () => void;
  onMore: () => void;
}

export default function PurchaseSuccess({ ticket, event, onView, onMore }: PurchaseSuccessProps) {
  const tier = event?.tiers.find((t) => t.id === ticket.tierId);

  return (
    <div className="success-screen">
      <div className="success-screen__check">
        <Icon name="check" size={28} />
      </div>
      <h1>You&apos;re going!</h1>
      <p>
        Confirmation sent to your email. Find it under <b>My Tickets</b> anytime.
      </p>
      {event && (
        <div
          style={{
            maxWidth: 420, margin: '0 auto', padding: 20,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-elevated)', textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{event.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            {fmtDate(event.date)} · {tier?.name ?? ''} × {ticket.qty}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ticket.seats.map((s) => (
              <span key={s} className="seat-tag">{s}</span>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
        <button className="btn btn--secondary" onClick={onMore}>Browse more</button>
        <button className="btn btn--primary" onClick={onView}>View my tickets</button>
      </div>
    </div>
  );
}
