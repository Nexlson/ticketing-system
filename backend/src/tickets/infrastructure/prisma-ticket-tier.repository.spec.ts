import { Test, TestingModule } from '@nestjs/testing';
import { PrismaTicketTierRepository } from './prisma-ticket-tier.repository';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  ticketTier: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  ticket: {
    findMany: jest.fn(),
  },
};

const prismaTierRow = {
  id: 'tier-1',
  eventId: 'evt-1',
  name: 'VIP',
  price: 10000,
  quantity: 48,
  color: '#ff0000',
  tierKey: 'vip',
  _count: { tickets: 30 },
};

describe('PrismaTicketTierRepository', () => {
  let repo: PrismaTicketTierRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTicketTierRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PrismaTicketTierRepository>(PrismaTicketTierRepository);
  });

  describe('findByEventId()', () => {
    it('should return tiers with availableCount mapped from _count.tickets', async () => {
      mockPrisma.ticketTier.findMany.mockResolvedValue([prismaTierRow]);

      const result = await repo.findByEventId('evt-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'tier-1',
        eventId: 'evt-1',
        availableCount: 30,
        color: '#ff0000',
        tierKey: 'vip',
      });
    });

    it('should query with eventId where clause and AVAILABLE ticket count', async () => {
      mockPrisma.ticketTier.findMany.mockResolvedValue([]);

      await repo.findByEventId('evt-1');

      expect(mockPrisma.ticketTier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: 'evt-1' } }),
      );
    });

    it('should map null color and tierKey to null', async () => {
      const rowWithNulls = { ...prismaTierRow, color: null, tierKey: null };
      mockPrisma.ticketTier.findMany.mockResolvedValue([rowWithNulls]);

      const result = await repo.findByEventId('evt-1');

      expect(result[0].color).toBeNull();
      expect(result[0].tierKey).toBeNull();
    });
  });

  describe('findById()', () => {
    it('should return null when tier does not exist', async () => {
      mockPrisma.ticketTier.findUnique.mockResolvedValue(null);

      const result = await repo.findById('tier-x');

      expect(result).toBeNull();
    });

    it('should return tier with availableCount mapped from _count.tickets', async () => {
      mockPrisma.ticketTier.findUnique.mockResolvedValue(prismaTierRow);

      const result = await repo.findById('tier-1');

      expect(result).toMatchObject({
        id: 'tier-1',
        availableCount: 30,
      });
    });
  });

  describe('findAvailableTicketsByTierId()', () => {
    it('should return available tickets up to the specified quantity', async () => {
      const tickets = [
        { id: 'ticket-1', tierId: 'tier-1', seatLabel: 'A-1-1', status: 'AVAILABLE', orderId: null, version: 0 },
        { id: 'ticket-2', tierId: 'tier-1', seatLabel: 'A-1-2', status: 'AVAILABLE', orderId: null, version: 0 },
      ];
      mockPrisma.ticket.findMany.mockResolvedValue(tickets);

      const result = await repo.findAvailableTicketsByTierId('tier-1', 2);

      expect(result).toHaveLength(2);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: { tierId: 'tier-1', status: 'AVAILABLE' },
        take: 2,
      });
    });
  });
});
