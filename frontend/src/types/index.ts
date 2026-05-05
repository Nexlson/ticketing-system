export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export type TicketStatus = 'AVAILABLE' | 'LOCKED' | 'SOLD';
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

// Backend response shapes (snake_case from API)
export interface ApiEvent {
  id: string;
  venue_id: string;
  venue_name: string | null;
  venue_city: string | null;
  organizer_id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: EventStatus;
  category?: string;
  description?: string;
  cover_color_1?: string;
  cover_color_2?: string;
}

export interface ApiTier {
  id: string;
  event_id: string;
  name: string;
  price: number; // cents
  quantity: number;
  available_count: number;
  color?: string;
  tier_key?: string;
}

export interface ApiTicket {
  id: string;
  tier_id: string;
  seat_label: string | null;
  status: TicketStatus;
  order_id: string | null;
  lock_expires_at: string | null;
  version: number;
}

export interface ApiOrder {
  id: string;
  user_id: string;
  total_amount: number; // cents
  status: OrderStatus;
  payment_reference_id: string | null;
  created_at: string;
}

export interface ApiVenue {
  id: string;
  name: string;
  address: string;
  city: string | null;
  capacity: number;
}

// Frontend UI shapes
export interface FrontendEvent {
  id: string;
  name: string;
  category: string;
  venueId: string;
  venueName: string | null;
  venueCity: string | null;
  date: string;
  description: string;
  tiers: FrontendTier[];
  cover: [string, string];
  status: string;
  createdAt: string;
}

export interface FrontendTier {
  id: string;
  name: string;
  price: number; // dollars
  capacity: number;
  availableCount: number;
  tierKey: string;
  color: string;
}

export interface FrontendVenue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export interface FrontendTicket {
  id: string;
  eventId: string;
  tierId: string;
  seats: string[];
  qty: number;
  total: number;
  purchasedAt: string;
  status: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  token: string;
}

export interface HoldResult {
  tickets: ApiTicket[];
  expiresAt: string;
}

export interface QueueStatus {
  position: number | null;
  isActive: boolean;
  expiresAt: string | null;
}

export interface QueueJoinResult {
  queueToken: string;
  position: number;
  estimatedWaitSec: number;
}
