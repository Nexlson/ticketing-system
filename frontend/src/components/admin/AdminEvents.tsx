'use client';
import { useState } from 'react';
import Icon from '../shared/Icon';
import Empty from '../shared/Empty';
import Modal from '../shared/Modal';
import { fmtDate, fmtTime } from '@/lib/helpers';
import type { FrontendEvent } from '@/types';

interface AdminEventsProps {
  store: {
    events: FrontendEvent[];
    removeEvent: (id: string) => void;
    upsertEvent: (ev: FrontendEvent) => void;
    occupiedByEvent: Record<string, Set<string>>;
  };
  onCreate: () => void;
  onEdit: (ev: FrontendEvent) => void;
}

export default function AdminEvents({ store, onCreate, onEdit }: AdminEventsProps) {
  const { events, removeEvent, upsertEvent } = store;
  const [confirmDelete, setConfirmDelete] = useState<FrontendEvent | null>(null);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p>{events.length} total · manage everything from creation to ticket allocation.</p>
        </div>
        <button className="btn btn--primary" onClick={onCreate}>
          <Icon name="plus" /> New event
        </button>
      </div>

      {events.length === 0 ? (
        <Empty
          title="No events yet"
          body="Create your first event to start selling tickets."
          action={
            <button className="btn btn--primary" onClick={onCreate}>
              Create event
            </button>
          }
        />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Venue</th>
              <th>Date</th>
              <th>Tickets</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const totalSeats = ev.tiers.reduce((s, t) => s + t.capacity, 0);
              const sold = store.occupiedByEvent[ev.id]?.size ?? 0;
              return (
                <tr key={ev.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: 6,
                          background: `linear-gradient(135deg, ${ev.cover[0]}, ${ev.cover[1]})`,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{ev.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.category}</div>
                      </div>
                    </div>
                  </td>
                  <td>{ev.venueName ?? '—'}</td>
                  <td>
                    <div>{fmtDate(ev.date)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtTime(ev.date)}</div>
                  </td>
                  <td className="num">
                    <b>{sold}</b>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>/ {totalSeats}</span>
                  </td>
                  <td>
                    <span className={`status-dot ${ev.status === 'draft' ? 'draft' : ev.status === 'cancelled' || ev.status === 'completed' ? 'draft' : ''}`}>
                      {{ draft: 'Draft', published: 'Published', cancelled: 'Cancelled', completed: 'Completed' }[ev.status] ?? ev.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="icon-btn" onClick={() => onEdit(ev)} title="Edit">
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => setConfirmDelete(ev)}
                        title="Cancel event"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {confirmDelete && (
        <Modal
          title={`Cancel "${confirmDelete.name}"?`}
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="btn btn--secondary" onClick={() => setConfirmDelete(null)}>
                Keep
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  upsertEvent({ ...confirmDelete, status: 'cancelled' });
                  setConfirmDelete(null);
                }}
              >
                Cancel event
              </button>
            </>
          }
        >
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Existing ticket holders will be notified and refunded automatically. This can&apos;t be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
