import type { ApiEvent, ApiTier, ApiOrder, FrontendEvent, FrontendTier, FrontendTicket, ApiTicket } from '@/types';
import { TIER_PALETTE } from './constants';

const DEFAULT_COVER_PAIRS: [string, string][] = [
  ['#8b5cf6', '#ec4899'],
  ['#0ea5e9', '#6366f1'],
  ['#10b981', '#0ea5e9'],
  ['#f97316', '#ef4444'],
  ['#facc15', '#f97316'],
  ['#18181b', '#52525b'],
];

export function mapApiTierToFrontend(apiTier: ApiTier, index: number): FrontendTier {
  const palette = TIER_PALETTE[index] ?? TIER_PALETTE[TIER_PALETTE.length - 1];
  return {
    id: apiTier.id,
    name: apiTier.name,
    price: apiTier.price / 100, // cents to dollars
    capacity: apiTier.quantity,
    availableCount: apiTier.available_count,
    tierKey: apiTier.tier_key ?? palette.id,
    color: apiTier.color ?? palette.color,
  };
}

export function mapApiEventToFrontend(
  apiEvent: ApiEvent,
  tiers: ApiTier[],
): FrontendEvent {
  const coverPair = DEFAULT_COVER_PAIRS[
    Math.abs(hashString(apiEvent.id)) % DEFAULT_COVER_PAIRS.length
  ];

  return {
    id: apiEvent.id,
    name: apiEvent.title,
    category: apiEvent.category ?? 'General',
    venueId: apiEvent.venue_id,
    venueName: apiEvent.venue_name,
    venueCity: apiEvent.venue_city,
    date: toLocalDatetimeInput(apiEvent.start_time),
    description: apiEvent.description ?? '',
    tiers: tiers.map((t, i) => mapApiTierToFrontend(t, i)),
    cover: [
      apiEvent.cover_color_1 ?? coverPair[0],
      apiEvent.cover_color_2 ?? coverPair[1],
    ],
    status: apiEvent.status.toLowerCase(),
    createdAt: apiEvent.start_time.slice(0, 10),
  };
}

export function mapApiOrderToFrontend(
  apiOrder: ApiOrder,
  tickets: ApiTicket[],
): FrontendTicket {
  const seats = tickets
    .filter((t) => t.order_id === apiOrder.id)
    .map((t) => t.seat_label ?? '');

  const tierId = tickets.find((t) => t.order_id === apiOrder.id)?.tier_id ?? '';

  return {
    id: apiOrder.id,
    eventId: '', // not available from order alone; enriched separately if needed
    tierId,
    seats,
    qty: tickets.length,
    total: apiOrder.total_amount / 100,
    purchasedAt: apiOrder.created_at,
    status: apiOrder.status.toLowerCase(),
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function toLocalDatetimeInput(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
