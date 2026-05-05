'use client';
import { useState } from 'react';
import Modal from '../shared/Modal';
import { TIER_PALETTE, STADIUM } from '@/lib/constants';
import { uid } from '@/lib/helpers';
import type { FrontendEvent, FrontendTier, FrontendVenue } from '@/types';

interface EventFormProps {
  existing?: FrontendEvent;
  venues: FrontendVenue[];
  onClose: () => void;
  onSave: (ev: FrontendEvent) => void;
}

function defaultTiers(): FrontendTier[] {
  return TIER_PALETTE.map((t, i) => ({
    id: uid('tier'),
    name: t.name,
    price: t.default,
    capacity: STADIUM.sections[i].rows * STADIUM.sections[i].perRow,
    availableCount: STADIUM.sections[i].rows * STADIUM.sections[i].perRow,
    tierKey: t.id,
    color: t.color,
  }));
}

export default function EventForm({ existing, venues, onClose, onSave }: EventFormProps) {
  const isEdit = !!existing;
  const [draft, setDraft] = useState<FrontendEvent>(() =>
    existing ?? {
      id: uid('ev'),
      name: '',
      category: 'Music',
      venueId: venues[0]?.id ?? '',
      venueName: venues[0]?.name ?? null,
      venueCity: venues[0]?.city ?? null,
      date: '2026-08-15T20:00',
      description: '',
      tiers: defaultTiers(),
      cover: ['#8b5cf6', '#ec4899'],
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 10),
    },
  );

  const set = <K extends keyof FrontendEvent>(k: K, v: FrontendEvent[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setTier = (idx: number, patch: Partial<FrontendTier>) => {
    setDraft((d) => {
      const tiers = [...d.tiers];
      tiers[idx] = { ...tiers[idx], ...patch };
      return { ...d, tiers };
    });
  };

  const venue = venues.find((v) => v.id === draft.venueId);
  const totalCapacity = draft.tiers.reduce((s, t) => s + (Number(t.capacity) || 0), 0);

  const save = (status: string) => {
    onSave({ ...draft, status });
    onClose();
  };

  const COVER_OPTIONS: [string, string][] = [
    ['#8b5cf6', '#ec4899'],
    ['#0ea5e9', '#6366f1'],
    ['#10b981', '#0ea5e9'],
    ['#f97316', '#ef4444'],
    ['#facc15', '#f97316'],
    ['#18181b', '#52525b'],
  ];

  return (
    <Modal
      title={isEdit ? 'Edit event' : 'New event'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--secondary" onClick={() => save('draft')}>Save draft</button>
          <button
            className="btn btn--primary"
            disabled={!draft.name}
            onClick={() => save('published')}
          >
            {isEdit ? 'Save changes' : 'Publish'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label>Event name</label>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Aurora Live in Concert"
          />
        </div>

        <div className="field">
          <label>Category</label>
          <select
            className="select"
            value={draft.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {['Music', 'Classical', 'Comedy', 'Conference', 'Festival', 'Sports', 'Theater'].map(
              (c) => <option key={c}>{c}</option>,
            )}
          </select>
        </div>

        <div className="field">
          <label>Venue</label>
          <select
            className="select"
            value={draft.venueId}
            onChange={(e) => set('venueId', e.target.value)}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.city}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Date &amp; time</label>
          <input
            className="input"
            type="datetime-local"
            value={draft.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>

        <div className="field">
          <label>Cover gradient</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COVER_OPTIONS.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => set('cover', g)}
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
                  border:
                    draft.cover[0] === g[0] && draft.cover[1] === g[1]
                      ? '2px solid var(--text)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <div className="field full">
          <label>Description</label>
          <textarea
            className="textarea"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="What's this event about?"
          />
        </div>

        <div className="full" style={{ marginTop: 8 }}>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 8,
            }}
          >
            <label style={{ fontWeight: 600, fontSize: 13.5 }}>Ticket tiers</label>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {totalCapacity} seats · venue cap {venue?.capacity}
            </span>
          </div>
          <div
            style={{
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: '0 14px', background: 'var(--bg-subtle)',
            }}
          >
            <div
              className="tier-row"
              style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                color: 'var(--text-faint)', letterSpacing: '0.04em',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>Tier</div>
              <div>Price (MYR)</div>
              <div>Tickets</div>
              <div></div>
            </div>
            {draft.tiers.map((t, i) => (
              <div key={t.id} className="tier-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: 2, background: t.color,
                    }}
                  />
                  <input
                    className="input"
                    style={{ padding: '6px 10px' }}
                    value={t.name}
                    onChange={(e) => setTier(i, { name: e.target.value })}
                  />
                </div>
                <input
                  className="input"
                  style={{ padding: '6px 10px' }}
                  type="number"
                  value={t.price}
                  onChange={(e) => setTier(i, { price: Number(e.target.value) })}
                />
                <input
                  className="input"
                  style={{ padding: '6px 10px' }}
                  type="number"
                  value={t.capacity}
                  onChange={(e) => setTier(i, { capacity: Number(e.target.value) })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
                  Sec {STADIUM.sections[i]?.id}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Tiers map 1:1 to venue sections. Capacity per tier is bounded by section size.
          </div>
        </div>
      </div>
    </Modal>
  );
}
