import type { ApiEvent, ApiTier, ApiTicket, ApiOrder, ApiVenue, HoldResult, QueueStatus, QueueJoinResult } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('token', token);
}

export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? res.statusText), { status: res.status, body });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface LoginApiResponse {
  token: string;
  expires_at: string;
  user_id: string;
  username: string;
  role: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<LoginApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};

export const eventsApi = {
  list: (venueId?: string) =>
    request<ApiEvent[]>(`/events${venueId ? `?venue_id=${venueId}` : ''}`),
  create: (payload: object) =>
    request<ApiEvent>('/events', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: object) =>
    request<ApiEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getTiers: (eventId: string) =>
    request<ApiTier[]>(`/events/${eventId}/tiers`),
  getOccupiedSeats: (eventId: string) =>
    request<string[]>(`/events/${eventId}/occupied-seats`),
};

export const ticketsApi = {
  get: (ticketId: string) =>
    request<ApiTicket>(`/tickets/${ticketId}`),
  hold: (tierId: string, seatLabels: string[], queueToken?: string) =>
    request<HoldResult>(`/tiers/${tierId}/hold`, {
      method: 'POST',
      body: JSON.stringify({ seat_labels: seatLabels, ...(queueToken ? { queue_token: queueToken } : {}) }),
    }),
  unlock: (ticketId: string) =>
    request<void>(`/tickets/${ticketId}/lock`, { method: 'DELETE' }),
  joinQueue: (tierId: string) =>
    request<QueueJoinResult>(`/tiers/${tierId}/queue`, { method: 'POST' }),
  getQueueStatus: (tierId: string, token: string) =>
    request<QueueStatus>(`/tiers/${tierId}/queue/status?token=${encodeURIComponent(token)}`),
  leaveQueue: (tierId: string, token: string) =>
    request<void>(`/tiers/${tierId}/queue?token=${encodeURIComponent(token)}`, { method: 'DELETE' }),
};

export const ordersApi = {
  list: () => request<ApiOrder[]>('/orders'),
  get: (orderId: string) => request<ApiOrder>(`/orders/${orderId}`),
  createOrder: (paymentToken: string, ticketIds: string[]) =>
    request<ApiOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({ payment_token: paymentToken, ticket_ids: ticketIds }),
    }),
};

export const venuesApi = {
  list: () => request<ApiVenue[]>('/venues'),
  create: (payload: object) =>
    request<ApiVenue>('/venues', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: object) =>
    request<ApiVenue>(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
};
