'use client';
import { useState } from 'react';
import Icon from '../shared/Icon';
import Empty from '../shared/Empty';
import { fmtDateShort, fmtTime, fmtMoney } from '@/lib/helpers';
import type { FrontendEvent } from '@/types';

interface BrowseProps {
  store: {
    events: FrontendEvent[];
    occupiedByEvent: Record<string, Set<string>>;
  };
  onOpen: (id: string) => void;
}

export default function Browse({ store, onOpen }: BrowseProps) {
  const { events, occupiedByEvent } = store;
  const published = events.filter((e) => e.status === 'published');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  const cats = ['All', ...new Set(published.map((e) => e.category))];
  const list = published.filter(
    (e) =>
      (cat === 'All' || e.category === cat) &&
      (!q || e.name.toLowerCase().includes(q.toLowerCase())),
  );


  return (
    <div>
      <div className="page-head">
        <div>
          <h1>What&apos;s on</h1>
          <p>{list.length} events available · find something for tonight or next month.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            placeholder="Search events…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 34, width: 240 }}
          />
          <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-faint)' }}>
            <Icon name="search" size={14} />
          </span>
        </div>
      </div>

      <div className="filter-bar">
        {cats.map((c) => (
          <button
            key={c}
            className={`chip ${cat === c ? 'is-active' : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty title="No events match" body="Try a different category or search term." />
      ) : (
        <div className="event-grid">
          {list.map((ev) => {
            const totalSeats = ev.tiers.reduce((s, t) => s + t.capacity, 0);
            const sold = occupiedByEvent[ev.id]?.size ?? 0;
            const remaining = totalSeats - sold;
            const minPrice = Math.min(...ev.tiers.map((t) => t.price));
            const date = fmtDateShort(ev.date);
            let availClass = '', availText = `${remaining} tickets left`;
            if (remaining === 0) { availClass = 'sold'; availText = 'Sold out'; }
            else if (remaining < 30) availClass = 'low';

            return (
              <div key={ev.id} className="event-card" onClick={() => onOpen(ev.id)}>
                <div
                  className="event-card__cover"
                  style={{ '--c1': ev.cover[0], '--c2': ev.cover[1] } as React.CSSProperties}
                >
                  <div className="event-card__date-chip">
                    <div className="m">{date.m}</div>
                    <div className="d">{date.d}</div>
                  </div>
                  <div className="event-card__cat">{ev.category}</div>
                </div>
                <div className="event-card__body">
                  <div className="event-card__title">{ev.name}</div>
                  <div className="event-card__meta">
                    <span>{ev.venueName ?? '—'}</span>
                    <span>{fmtTime(ev.date)}</span>
                  </div>
                  <div className="event-card__price">
                    <span className="event-card__price-from">
                      From <b>{fmtMoney(minPrice)}</b>
                    </span>
                    <span className={`event-card__avail ${availClass}`}>{availText}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
