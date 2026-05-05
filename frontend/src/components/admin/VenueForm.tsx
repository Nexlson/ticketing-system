'use client';
import { useState } from 'react';
import Modal from '../shared/Modal';
import type { FrontendVenue } from '@/types';

interface VenueDraft {
  id?: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
}

interface VenueFormProps {
  existing?: FrontendVenue;
  onClose: () => void;
  onSave: (v: VenueDraft) => void;
}

export default function VenueForm({ existing, onClose, onSave }: VenueFormProps) {
  const isEdit = !!existing;
  const [draft, setDraft] = useState<VenueDraft>(() =>
    existing
      ? { id: existing.id, name: existing.name, address: existing.address, city: existing.city, capacity: existing.capacity }
      : { name: '', address: '', city: '', capacity: 0 },
  );

  const set = <K extends keyof VenueDraft>(k: K, v: VenueDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const valid = draft.name.trim() && draft.address.trim() && draft.capacity > 0;

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Modal
      title={isEdit ? 'Edit venue' : 'New venue'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={!valid} onClick={save}>
            {isEdit ? 'Save changes' : 'Create venue'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label>Venue name</label>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Madison Square Garden"
          />
        </div>

        <div className="field full">
          <label>Address</label>
          <input
            className="input"
            value={draft.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="e.g. 4 Pennsylvania Plaza"
          />
        </div>

        <div className="field">
          <label>City</label>
          <input
            className="input"
            value={draft.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="e.g. New York"
          />
        </div>

        <div className="field">
          <label>Capacity</label>
          <input
            className="input"
            type="number"
            min={1}
            value={draft.capacity || ''}
            onChange={(e) => set('capacity', Number(e.target.value))}
            placeholder="e.g. 20000"
          />
        </div>
      </div>
    </Modal>
  );
}
