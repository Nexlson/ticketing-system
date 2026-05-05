'use client';
import { useState, useEffect, useCallback } from 'react';
import { eventsApi, ordersApi, venuesApi, ticketsApi } from './api-client';
import { mapApiEventToFrontend, mapApiTierToFrontend } from './mappers';
import type { FrontendEvent, FrontendTicket, FrontendVenue, HoldResult } from '@/types';
import { uid } from './helpers';

function makeOccupied(eventId: string, density = 0.28): Set<string> {
  let seed = 0;
  for (let i = 0; i < eventId.length; i++) seed = (seed * 31 + eventId.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const set = new Set<string>();
  const sections = [
    { id: 'A', rows: 4, perRow: 12 },
    { id: 'B', rows: 5, perRow: 14 },
    { id: 'C', rows: 5, perRow: 16 },
    { id: 'D', rows: 4, perRow: 12 },
  ];
  sections.forEach((sec) => {
    for (let r = 0; r < sec.rows; r++) {
      for (let c = 0; c < sec.perRow; c++) {
        if (rand() < density) set.add(`${sec.id}-${r + 1}-${c + 1}`);
      }
    }
  });
  return set;
}

export function useAppStore(userId: string | null) {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [tickets, setTickets] = useState<FrontendTicket[]>([]);
  const [venues, setVenues] = useState<FrontendVenue[]>([]);
  const [occupiedByEvent, setOccupiedByEvent] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load venues, events, and user orders once authenticated
  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [venueList, eventList] = await Promise.all([
          venuesApi.list().catch(() => [] as Awaited<ReturnType<typeof venuesApi.list>>),
          eventsApi.list().catch(() => [] as Awaited<ReturnType<typeof eventsApi.list>>),
        ]);

        const mappedVenues: FrontendVenue[] = venueList.map((v) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          city: v.city ?? v.address,
          capacity: v.capacity,
        }));
        setVenues(mappedVenues);

        // For each event, fetch its tiers and real occupied seats
        const mappedEvents: FrontendEvent[] = await Promise.all(
          eventList.map(async (apiEvent) => {
            const tiers = await eventsApi.getTiers(apiEvent.id).catch(() => []);
            return mapApiEventToFrontend(apiEvent, tiers);
          }),
        );
        setEvents(mappedEvents);

        const occupied: Record<string, Set<string>> = {};
        await Promise.all(
          mappedEvents.map(async (ev) => {
            const soldSeats = await eventsApi.getOccupiedSeats(ev.id).catch(() => [] as string[]);
            occupied[ev.id] = new Set(soldSeats);
          }),
        );
        setOccupiedByEvent(occupied);

        // Load user's orders
        try {
          const orders = await ordersApi.list();
          const userTickets: FrontendTicket[] = orders.map((o) => ({
            id: o.id,
            eventId: '',
            tierId: '',
            seats: [],
            qty: 1,
            total: o.total_amount / 100,
            purchasedAt: o.created_at,
            status: o.status.toLowerCase(),
          }));
          setTickets(userTickets);
        } catch {
          // user not logged in yet or no orders
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  const upsertEvent = useCallback(async (ev: FrontendEvent) => {
    const startTime = new Date(ev.date).toISOString();
    const endTime = new Date(new Date(ev.date).getTime() + 4 * 60 * 60 * 1000).toISOString();
    const isExisting = events.some((e) => e.id === ev.id);

    try {
      const payload = {
        venue_id: ev.venueId,
        title: ev.name,
        start_time: startTime,
        end_time: endTime,
        category: ev.category,
        description: ev.description,
        cover_color_1: ev.cover[0],
        cover_color_2: ev.cover[1],
        status: ev.status.toUpperCase(),
        ...(!isExisting && {
          tiers: ev.tiers.map((t) => ({
            name: t.name,
            price: t.price,
            quantity: t.capacity,
            color: t.color,
            tier_key: t.tierKey,
          })),
        }),
      };

      const apiEvent = isExisting
        ? await eventsApi.update(ev.id, payload)
        : await eventsApi.create(payload);

      const tiers = await eventsApi.getTiers(apiEvent.id).catch(() => []);
      const mapped = mapApiEventToFrontend(apiEvent, tiers);

      setEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === mapped.id);
        if (idx === -1) {
          setOccupiedByEvent((o) => ({ ...o, [mapped.id]: makeOccupied(mapped.id, 0) }));
          return [mapped, ...prev];
        }
        const next = [...prev];
        next[idx] = mapped;
        return next;
      });
    } catch (err) {
      // Optimistic local update if API fails
      setEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === ev.id);
        if (idx === -1) {
          setOccupiedByEvent((o) => ({ ...o, [ev.id]: makeOccupied(ev.id, 0) }));
          return [ev, ...prev];
        }
        const next = [...prev];
        next[idx] = ev;
        return next;
      });
      console.error('Event create failed, using local state:', err);
    }
  }, [events, venues]);

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addTicket = useCallback((t: FrontendTicket) => {
    setTickets((prev) => [t, ...prev]);
  }, []);

  const markSeatsTaken = useCallback((eventId: string, seats: string[]) => {
    setOccupiedByEvent((prev) => {
      const set = new Set(prev[eventId] ?? []);
      seats.forEach((s) => set.add(s));
      return { ...prev, [eventId]: set };
    });
  }, []);

  const holdSeats = useCallback(async (tierId: string, seatLabels: string[], queueToken?: string): Promise<HoldResult> => {
    return ticketsApi.hold(tierId, seatLabels, queueToken);
  }, []);

  const createOrder = useCallback(async (paymentToken: string, ticketIds: string[]): Promise<{ id: string }> => {
    return ordersApi.createOrder(paymentToken, ticketIds);
  }, []);

  const upsertVenue = useCallback(async (payload: {
    id?: string;
    name: string;
    address: string;
    city: string;
    capacity: number;
  }) => {
    const { id, ...data } = payload;
    const apiVenue = id
      ? await venuesApi.update(id, data)
      : await venuesApi.create(data);

    const mapped: FrontendVenue = {
      id: apiVenue.id,
      name: apiVenue.name,
      address: apiVenue.address,
      city: apiVenue.city ?? apiVenue.address,
      capacity: apiVenue.capacity,
    };

    setVenues((prev) => {
      const idx = prev.findIndex((v) => v.id === mapped.id);
      if (idx === -1) return [mapped, ...prev];
      const next = [...prev];
      next[idx] = mapped;
      return next;
    });
  }, []);

  return {
    events,
    tickets,
    venues,
    occupiedByEvent,
    loading,
    error,
    upsertEvent,
    removeEvent,
    addTicket,
    markSeatsTaken,
    holdSeats,
    createOrder,
    upsertVenue,
  };
}
