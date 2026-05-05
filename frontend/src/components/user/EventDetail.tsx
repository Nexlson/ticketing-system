'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Icon from '../shared/Icon';
import Stadium from '../shared/Stadium';
import Stepper from '../shared/Stepper';
import QueueWaiting from './QueueWaiting';
import { STADIUM } from '@/lib/constants';
import { fmtDate, fmtTime, fmtMoney } from '@/lib/helpers';
import { useToast } from '../shared/Toast';
import { ticketsApi } from '@/lib/api-client';
import type { FrontendEvent, HoldResult } from '@/types';

type HoldState = 'idle' | 'holding' | 'queued' | 'window_active';

interface HoldInfo {
  eventId: string;
  tierId: string;
  qty: number;
  seats: string[];
  total: number;
  ticketIds: string[];
  expiresAt: string;
}

interface EventDetailProps {
  store: {
    events: FrontendEvent[];
    occupiedByEvent: Record<string, Set<string>>;
    markSeatsTaken: (eventId: string, seats: string[]) => void;
    holdSeats: (tierId: string, seatLabels: string[], queueToken?: string) => Promise<HoldResult>;
  };
  eventId: string;
  onBack: () => void;
  onCheckout: (hold: HoldInfo) => void;
}

export default function EventDetail({ store, eventId, onBack, onCheckout }: EventDetailProps) {
  const { showToast } = useToast();
  const ev = store.events.find((e) => e.id === eventId);
  const occupied = store.occupiedByEvent[eventId] ?? new Set<string>();
  const [tierId, setTierId] = useState<string>(ev?.tiers[0]?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [qty, setQty] = useState(2);
  const [holdState, setHoldState] = useState<HoldState>('idle');
  const [holdError, setHoldError] = useState<string | null>(null);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [queueInfo, setQueueInfo] = useState<{ position: number; estimatedWaitSec: number; tierId: string; token: string } | null>(null);
  const queueInfoRef = useRef(queueInfo);
  useEffect(() => { queueInfoRef.current = queueInfo; }, [queueInfo]);

  if (!ev) return null;

  const tier = ev.tiers.find((t) => t.id === tierId);
  const tierKey = tier?.tierKey;

  const tierAvail = useMemo(() => {
    const m: Record<string, { total: number; taken: number; free: number }> = {};
    ev.tiers.forEach((t, i) => {
      const sec = STADIUM.sections[i];
      const total = sec.rows * sec.perRow;
      let taken = 0;
      occupied.forEach((s) => { if (s.startsWith(`${sec.id}-`)) taken++; });
      m[t.id] = { total, taken, free: total - taken };
    });
    return m;
  }, [ev, occupied]);

  const toggleSeat = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= qty) {
          const first = next.values().next().value as string;
          next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((s) => {
        const secId = s.split('-')[0];
        const sec = STADIUM.sections.find((x) => x.id === secId);
        if (sec && sec.tier === tierKey) next.add(s);
      });
      return next;
    });
  }, [tierKey]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size <= qty) return prev;
      const arr = [...prev].slice(0, qty);
      return new Set(arr);
    });
  }, [qty]);

  const subtotal = (tier?.price ?? 0) * qty;
  const fees = Math.round(subtotal * 0.08);
  const total = subtotal + fees;
  const canCheckout = selected.size === qty && qty > 0;

  // Leave queue on unmount
  useEffect(() => {
    return () => {
      if (queueInfoRef.current) {
        ticketsApi.leaveQueue(queueInfoRef.current.tierId, queueInfoRef.current.token).catch(() => {});
      }
    };
  }, []);

  const attemptHold = useCallback(async (t: NonNullable<typeof tier>) => {
    setHoldState('holding');
    setHoldError(null);
    try {
      const result = await store.holdSeats(t.id, [...selected], queueInfoRef.current?.token);
      const seats = result.tickets.map((tk) => tk.seat_label ?? '').filter(Boolean);
      store.markSeatsTaken(ev.id, seats);
      onCheckout({
        eventId: ev.id,
        tierId: t.id,
        qty,
        seats,
        total,
        ticketIds: result.tickets.map((tk) => tk.id),
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      const e = err as { status?: number; body?: { queueAvailable?: boolean } };
      if (e.status === 503 && e.body?.queueAvailable) {
        setHoldState('idle');
        autoJoinQueue(t.id);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to hold seats';
        showToast(msg);
        setHoldError(msg);
        setHoldState('idle');
      }
    }
  }, [store, selected, ev, qty, total, onCheckout, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckout = () => { if (tier) attemptHold(tier); };

  const autoJoinQueue = async (targetTierId: string) => {
    setJoiningQueue(true);
    try {
      const result = await ticketsApi.joinQueue(targetTierId);
      setQueueInfo({ position: result.position, estimatedWaitSec: result.estimatedWaitSec, tierId: targetTierId, token: result.queueToken });
      setHoldState('queued');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to join queue');
    } finally {
      setJoiningQueue(false);
    }
  };

  const handleWindowActive = useCallback((_expiresAt: string) => {
    setHoldState('window_active');
    showToast('Your turn! Complete checkout before your window closes.', 'success');
  }, [showToast]);

  const handleLeaveQueue = async () => {
    if (queueInfo) await ticketsApi.leaveQueue(queueInfo.tierId, queueInfo.token).catch(() => {});
    setHoldState('idle');
    setQueueInfo(null);
  };

  return (
    <div>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        <Icon name="back" size={14} /> Back to events
      </button>

      <div className="detail">
        <div>
          <div
            className="detail__cover"
            style={{ '--c1': ev.cover[0], '--c2': ev.cover[1] } as React.CSSProperties}
          />
          <div
            style={{
              fontSize: 12, fontWeight: 600, color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
            }}
          >
            {ev.category}
          </div>
          <h1>{ev.name}</h1>

          <div className="detail__meta-row">
            <div className="detail__meta-item">
              <div className="l">Date</div>
              <div className="v">{fmtDate(ev.date)}</div>
            </div>
            <div className="detail__meta-item">
              <div className="l">Doors</div>
              <div className="v">{fmtTime(ev.date)}</div>
            </div>
            <div className="detail__meta-item">
              <div className="l">Venue</div>
              <div className="v">{ev.venueName ?? '—'}</div>
            </div>
            <div className="detail__meta-item">
              <div className="l">Location</div>
              <div className="v">{ev.venueCity ?? '—'}</div>
            </div>
          </div>

          <div className="detail__about">
            <h2>About this event</h2>
            <p>{ev.description}</p>
          </div>

          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Pick your seats</h2>
            <Stadium
              occupied={occupied}
              selected={selected}
              onToggle={toggleSeat}
              mode="pick"
              tierFilter={tierKey}
            />
            <div
              style={{
                fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center',
              }}
            >
              Tap any colored seat in <b>{tier?.name}</b> · red seats are already taken
            </div>
          </div>
        </div>

        <div className="detail__sidebar">
          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.04em', color: 'var(--text-faint)', marginBottom: 10,
              }}
            >
              Choose tier
            </div>
            <div className="tier-list">
              {ev.tiers.map((t) => {
                const avail = tierAvail[t.id];
                const soldOut = avail.free === 0;
                return (
                  <div
                    key={t.id}
                    className={`tier ${tierId === t.id ? 'is-selected' : ''} ${soldOut ? 'is-disabled' : ''}`}
                    onClick={() => !soldOut && setTierId(t.id)}
                  >
                    <div className="tier__head">
                      <div className="tier__name">
                        <span
                          style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                            background: t.color, marginRight: 6, verticalAlign: 'middle',
                          }}
                        />
                        {t.name}
                      </div>
                      <div className="tier__price">{fmtMoney(t.price)}</div>
                    </div>
                    <div className="tier__sub">
                      <span>
                        Section {STADIUM.sections.find((s) => s.tier === t.tierKey)?.id}
                      </span>
                      <span>{soldOut ? 'Sold out' : `${avail.free} left`}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}
            >
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>Quantity</span>
                <Stepper value={qty} onChange={setQty} min={1} max={6} />
              </div>
              <div className="summary__row" style={{ borderTop: 0, paddingTop: 0 }}>
                <span>Subtotal</span>
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

              {holdState === 'queued' || holdState === 'window_active' ? (
                queueInfo && (
                  <QueueWaiting
                    tierId={queueInfo.tierId}
                    queueToken={queueInfo.token}
                    initialPosition={queueInfo.position}
                    initialEstimatedWaitSec={queueInfo.estimatedWaitSec}
                    onWindowActive={handleWindowActive}
                    onLeave={handleLeaveQueue}
                  />
                )
              ) : (
                <>
                  {holdError && (
                    <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>
                      {holdError}
                    </div>
                  )}
                  <button
                    className="btn btn--primary btn--lg btn--block"
                    disabled={!canCheckout || holdState === 'holding'}
                    onClick={handleCheckout}
                    style={{ marginTop: 12 }}
                  >
                    {holdState === 'holding'
                      ? 'Holding seats…'
                      : selected.size < qty
                      ? `Select ${qty - selected.size} more seat${qty - selected.size !== 1 ? 's' : ''}`
                      : 'Continue to checkout'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {joiningQueue && (
        <div className="modal-bg">
          <div className="modal" style={{ maxWidth: 360, textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: 22, marginBottom: 12 }}>🎟️</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>High demand detected</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Joining the queue for you automatically…
            </div>
            <div style={{
              width: 32, height: 32, border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite', margin: '0 auto',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
