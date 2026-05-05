import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaTicketRepository } from './prisma-ticket.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketEntity } from '../domain/ticket.entity';

const mockPrisma = {
  ticket: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockTicket: TicketEntity = {
  id: 'ticket-1',
  tierId: 'tier-1',
  seatLabel: 'A-1-1',
  status: 'AVAILABLE',
  orderId: null,
  version: 0,
};

describe('PrismaTicketRepository', () => {
  let repo: PrismaTicketRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTicketRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PrismaTicketRepository>(PrismaTicketRepository);
  });

  describe('findById()', () => {
    it('should return null when ticket does not exist', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      const result = await repo.findById('ticket-x');

      expect(result).toBeNull();
    });

    it('should return ticket when found', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket);

      const result = await repo.findById('ticket-1');

      expect(result).toEqual(mockTicket);
    });
  });

  describe('findByTierId()', () => {
    it('should return all tickets for a tier', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([mockTicket]);

      const result = await repo.findByTierId('tier-1');

      expect(result).toEqual([mockTicket]);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({ where: { tierId: 'tier-1' } });
    });
  });

  describe('lock()', () => {
    it('should update ticket to LOCKED status with incremented version', async () => {
      const lockedTicket = { ...mockTicket, status: 'LOCKED', version: 1 };
      mockPrisma.ticket.update.mockResolvedValue(lockedTicket);

      const result = await repo.lock('ticket-1', 0);

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1', version: 0, status: 'AVAILABLE' },
        data: { status: 'LOCKED', version: { increment: 1 } },
      });
      expect(result.status).toBe('LOCKED');
    });

    it('should throw ConflictException when Prisma update fails (ticket locked or version mismatch)', async () => {
      mockPrisma.ticket.update.mockRejectedValue(new Error('Record not found'));

      await expect(repo.lock('ticket-1', 0)).rejects.toThrow(ConflictException);
    });
  });

  describe('unlock()', () => {
    it('should update ticket back to AVAILABLE status with incremented version', async () => {
      const unlockedTicket = { ...mockTicket, status: 'AVAILABLE', version: 2 };
      mockPrisma.ticket.update.mockResolvedValue(unlockedTicket);

      const result = await repo.unlock('ticket-1');

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1', status: 'LOCKED' },
        data: { status: 'AVAILABLE', version: { increment: 1 } },
      });
      expect(result.status).toBe('AVAILABLE');
    });
  });

  describe('findAvailableByTierId()', () => {
    it('should return all AVAILABLE tickets for the tier', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([mockTicket]);

      const result = await repo.findAvailableByTierId('tier-1');

      expect(result).toEqual([mockTicket]);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: { tierId: 'tier-1', status: 'AVAILABLE' },
      });
    });
  });

  describe('findByTierIdAndSeatLabels()', () => {
    it('should return only AVAILABLE tickets matching the seat labels', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([mockTicket]);

      const result = await repo.findByTierIdAndSeatLabels('tier-1', ['A-1-1', 'A-1-2']);

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          tierId: 'tier-1',
          seatLabel: { in: ['A-1-1', 'A-1-2'] },
          status: 'AVAILABLE',
        },
      });
      expect(result).toEqual([mockTicket]);
    });
  });

  describe('findManyByIds()', () => {
    it('should return tickets with tierPrice mapped from tier.price', async () => {
      const prismRow = { ...mockTicket, tier: { price: 5000 } };
      mockPrisma.ticket.findMany.mockResolvedValue([prismRow]);

      const result = await repo.findManyByIds(['ticket-1']);

      expect(result[0]).toMatchObject({ id: 'ticket-1', tierPrice: 5000 });
    });

    it('should query with id in clause and include tier price', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await repo.findManyByIds(['ticket-1', 'ticket-2']);

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['ticket-1', 'ticket-2'] } },
        include: { tier: { select: { price: true } } },
      });
    });
  });

  describe('markSold()', () => {
    it('should update all specified tickets to SOLD with the orderId', async () => {
      mockPrisma.ticket.updateMany.mockResolvedValue({ count: 2 });

      await repo.markSold(['ticket-1', 'ticket-2'], 'order-1');

      expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ticket-1', 'ticket-2'] } },
        data: { status: 'SOLD', orderId: 'order-1' },
      });
    });
  });
});
