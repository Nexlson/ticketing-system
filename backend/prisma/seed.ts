import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: hash, role: 'admin' },
  });

  await prisma.user.upsert({
    where: { username: 'alex' },
    update: {},
    create: { username: 'alex', passwordHash: hash, role: 'user' },
  });

  await prisma.venue.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'a1b2c3d4-0001-0001-0001-000000000001',
        name: 'Madison Square Garden',
        address: '4 Pennsylvania Plaza',
        city: 'New York',
        capacity: 20000,
      },
      {
        id: 'a1b2c3d4-0002-0002-0002-000000000002',
        name: 'The O2 Arena',
        address: 'Peninsula Square',
        city: 'London',
        capacity: 20000,
      },
      {
        id: 'a1b2c3d4-0003-0003-0003-000000000003',
        name: 'Sydney Opera House',
        address: 'Bennelong Point',
        city: 'Sydney',
        capacity: 5738,
      },
      {
        id: 'a1b2c3d4-0004-0004-0004-000000000004',
        name: 'Red Rocks Amphitheatre',
        address: '18300 W Alameda Pkwy',
        city: 'Morrison',
        capacity: 9525,
      },
      {
        id: 'a1b2c3d4-0005-0005-0005-000000000005',
        name: 'Staples Center',
        address: '1111 S Figueroa St',
        city: 'Los Angeles',
        capacity: 21000,
      },
    ],
  });

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });

  const events = [
    {
      id: 'evt-0001-0001-0001-000000000001',
      venueId: 'a1b2c3d4-0001-0001-0001-000000000001',
      organizerId: admin.id,
      title: 'Summer Music Festival',
      startTime: new Date('2026-07-15T18:00:00Z'),
      endTime: new Date('2026-07-15T23:00:00Z'),
      status: 'PUBLISHED' as const,
      category: 'Music',
      description: 'The biggest summer music festival of the year.',
      coverColor1: '#FF6B6B',
      coverColor2: '#FFE66D',
    },
    {
      id: 'evt-0002-0002-0002-000000000002',
      venueId: 'a1b2c3d4-0004-0004-0004-000000000004',
      organizerId: admin.id,
      title: 'Comedy Night Live',
      startTime: new Date('2026-08-20T20:00:00Z'),
      endTime: new Date('2026-08-20T22:30:00Z'),
      status: 'PUBLISHED' as const,
      category: 'Comedy',
      description: 'A night of stand-up comedy under the stars.',
      coverColor1: '#4ECDC4',
      coverColor2: '#45B7D1',
    },
    {
      id: 'evt-0003-0003-0003-000000000003',
      venueId: 'a1b2c3d4-0002-0002-0002-000000000002',
      organizerId: admin.id,
      title: 'Tech Conference 2026',
      startTime: new Date('2026-09-10T09:00:00Z'),
      endTime: new Date('2026-09-10T18:00:00Z'),
      status: 'DRAFT' as const,
      category: 'Technology',
      description: 'Annual technology conference featuring industry leaders.',
      coverColor1: '#A8E6CF',
      coverColor2: '#3D5A80',
    },
  ];

  await prisma.event.createMany({ skipDuplicates: true, data: events });

  // Stadium layout must match frontend constants.ts STADIUM sections (index order matters)
  const SECTIONS = [
    { id: 'A', tierKey: 'vip',      rows: 4, perRow: 12, color: '#a78bfa' },
    { id: 'B', tierKey: 'premium',  rows: 5, perRow: 14, color: '#60a5fa' },
    { id: 'C', tierKey: 'standard', rows: 5, perRow: 16, color: '#34d399' },
    { id: 'D', tierKey: 'general',  rows: 4, perRow: 12, color: '#fbbf24' },
  ];

  const TIER_NAMES: Record<string, { name: string; price: number }[]> = {
    'evt-0001-0001-0001-000000000001': [
      { name: 'VIP',      price: 18000 },
      { name: 'Premium',  price: 12000 },
      { name: 'Standard', price: 8000  },
      { name: 'General',  price: 4500  },
    ],
    'evt-0002-0002-0002-000000000002': [
      { name: 'VIP',      price: 12000 },
      { name: 'Premium',  price: 8000  },
      { name: 'Standard', price: 5000  },
      { name: 'General',  price: 3500  },
    ],
    'evt-0003-0003-0003-000000000003': [
      { name: 'VIP',      price: 25000 },
      { name: 'Premium',  price: 18000 },
      { name: 'Standard', price: 10000 },
      { name: 'General',  price: 8000  },
    ],
  };

  const tiers = events.flatMap((ev, evIdx) =>
    SECTIONS.map((sec, secIdx) => ({
      id: `tier-${String(evIdx + 1).padStart(4, '0')}-${String(secIdx + 1).padStart(4, '0')}-0001-${String(evIdx * 4 + secIdx + 1).padStart(12, '0')}`,
      eventId: ev.id,
      name: TIER_NAMES[ev.id][secIdx].name,
      price: TIER_NAMES[ev.id][secIdx].price,
      quantity: sec.rows * sec.perRow,
      color: sec.color,
      tierKey: sec.tierKey,
    })),
  );

  await prisma.ticketTier.createMany({ skipDuplicates: true, data: tiers });

  for (const tier of tiers) {
    const existing = await prisma.ticket.count({ where: { tierId: tier.id } });
    if (existing > 0) continue;

    const sec = SECTIONS.find((s) => s.tierKey === tier.tierKey)!;
    const seats: { tierId: string; seatLabel: string; status: 'AVAILABLE' }[] = [];
    for (let r = 1; r <= sec.rows; r++) {
      for (let c = 1; c <= sec.perRow; c++) {
        seats.push({ tierId: tier.id, seatLabel: `${sec.id}-${r}-${c}`, status: 'AVAILABLE' });
      }
    }
    await prisma.ticket.createMany({ data: seats });
  }

  console.log('Seeded: admin, alex, 5 venues, 3 events, 12 tiers, tickets with stadium seat labels');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
