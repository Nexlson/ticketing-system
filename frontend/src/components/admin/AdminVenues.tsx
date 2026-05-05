'use client';
import { useState } from 'react';
import Icon from '../shared/Icon';
import Empty from '../shared/Empty';
import VenueForm from './VenueForm';
import type { FrontendVenue } from '@/types';

interface AdminVenuesProps {
  venues: FrontendVenue[];
  onUpsert: (v: { id?: string; name: string; address: string; city: string; capacity: number }) => void;
}

export default function AdminVenues({ venues, onUpsert }: AdminVenuesProps) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FrontendVenue | null>(null);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Venues</h1>
          <p>{venues.length} venues configured.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> New venue
        </button>
      </div>

      {venues.length === 0 ? (
        <Empty
          title="No venues yet"
          body="Add your first venue to start creating events."
          action={
            <button className="btn btn--primary" onClick={() => setCreating(true)}>
              Create venue
            </button>
          }
        />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>City</th>
              <th>Capacity</th>
              <th>Layout</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id}>
                <td><b>{v.name}</b></td>
                <td style={{ color: 'var(--text-muted)' }}>{v.address}</td>
                <td>{v.city}</td>
                <td className="num">{v.capacity.toLocaleString()} seats</td>
                <td>Stadium · 4 sections</td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="icon-btn" onClick={() => setEditing(v)} title="Edit">
                      <Icon name="edit" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <VenueForm
          onClose={() => setCreating(false)}
          onSave={(v) => { onUpsert(v); setCreating(false); }}
        />
      )}
      {editing && (
        <VenueForm
          existing={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => { onUpsert(v); setEditing(null); }}
        />
      )}
    </div>
  );
}
