'use client';
import { useState, useEffect } from 'react';
import Icon from '../shared/Icon';
import { fmtDate, fmtTime, fmtMoney, uid } from '@/lib/helpers';
import type { FrontendEvent, FrontendTicket } from '@/types';

interface HoldInfo {
  eventId: string;
  tierId: string;
  qty: number;
  seats: string[];
  total: number;
  ticketIds: string[];
  expiresAt: string;
}

interface CheckoutProps {
  store: {
    events: FrontendEvent[];
    createOrder: (paymentToken: string, ticketIds: string[]) => Promise<{ id: string }>;
  };
  hold: HoldInfo;
  holdSeconds?: number;
  onCancel: (reason?: string) => void;
  onPaid: (ticket: FrontendTicket) => void;
}

export default function Checkout({
  store,
  hold,
  holdSeconds = 300,
  onCancel,
  onPaid,
}: CheckoutProps) {
  const ev = store.events.find((e) => e.id === hold.eventId);
  const tier = ev?.tiers.find((t) => t.id === hold.tierId);

  const [remaining, setRemaining] = useState(holdSeconds);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [card, setCard] = useState('4242 4242 4242 4242');
  const [exp, setExp] = useState('12/27');
  const [cvc, setCvc] = useState('123');
  const [name, setName] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); onCancel('expired'); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const warn = remaining <= 60;

  const subtotal = (tier?.price ?? 0) * hold.qty;
  const fees = Math.round(subtotal * 0.08);
  const total = subtotal + fees;

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const paymentToken = `tok_${uid()}`;
      const order = await store.createOrder(paymentToken, hold.ticketIds);
      onPaid({
        id: order.id,
        eventId: hold.eventId,
        tierId: hold.tierId,
        seats: hold.seats,
        qty: hold.qty,
        total,
        purchasedAt: new Date().toISOString(),
        status: 'confirmed',
      });
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed');
      setPaying(false);
    }
  };

  if (!ev) return null;

  return (
    <div>
      <div className={`hold-banner ${warn ? 'warn' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="clock" size={16} />
          <div className="hold-banner__l">
            <b>Your seats are held</b> — complete checkout before the timer runs out, or they&apos;ll be released.
          </div>
        </div>
        <div className="hold-banner__r">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
      </div>

      <div className="checkout">
        <div>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Payment</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>
              This is a demo — no real card will be charged.
            </p>

            <div className="form-grid">
              <div className="field full">
                <label>Cardholder name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name on card"
                />
              </div>
              <div className="field full">
                <label>Card number</label>
                <input className="input" value={card} onChange={(e) => setCard(e.target.value)} />
              </div>
              <div className="field">
                <label>Expiry</label>
                <input className="input" value={exp} onChange={(e) => setExp(e.target.value)} />
              </div>
              <div className="field">
                <label>CVC</label>
                <input className="input" value={cvc} onChange={(e) => setCvc(e.target.value)} />
              </div>
            </div>

            {payError && (
              <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>
                {payError}
              </div>
            )}

            <button
              className="btn btn--primary btn--lg btn--block"
              onClick={pay}
              disabled={paying || !name}
              style={{ marginTop: 20 }}
            >
              {paying ? 'Processing…' : `Pay ${fmtMoney(total)}`}
            </button>
            <button
              className="btn-ghost btn--block"
              onClick={() => onCancel('user')}
              style={{ marginTop: 8, width: '100%', textAlign: 'center', padding: 8 }}
            >
              Cancel and release seats
            </button>
          </div>
        </div>

        <div className="card summary">
          <h3>Order summary</h3>
          <div
            style={{
              paddingBottom: 12, marginBottom: 8, borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ev.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.venueName ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fmtDate(ev.date)} · {fmtTime(ev.date)}
            </div>
          </div>
          <div className="summary__row" style={{ borderTop: 0 }}>
            <span>{tier?.name} × {hold.qty}</span>
            <span className="num">{fmtMoney(subtotal)}</span>
          </div>
          <div className="summary__row">
            <span>Service fees</span>
            <span className="num">{fmtMoney(fees)}</span>
          </div>
          <div className="summary__row total">
            <span>Total</span>
            <span className="num">{fmtMoney(total)}</span>
          </div>
          <div
            style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.04em', color: 'var(--text-faint)', marginBottom: 6,
              }}
            >
              Your seats
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hold.seats.map((s) => (
                <span key={s} className="seat-tag">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
