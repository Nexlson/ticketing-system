import { Test, TestingModule } from '@nestjs/testing';
import { PrismaEventRepository } from './prisma-event.repository';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const prismRow = {
  id: 'evt-1',
  venueId: 'venue-1',
  organizerId: 'user-1',
  title: 'Test Concert',
  startTime: new Date('2025-06-01T18:00:00Z'),
  endTime: new Date('2025-06-01T21:00:00Z'),
  status: 'PUBLISHED',
  category: 'Music',
  description: null,
  coverColor1: null,
  coverColor2: null,
  venue: { name: 'Grand Arena', city: 'KL' },
};

describe('PrismaEventRepository', () => {
  let repo: PrismaEventRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaEventRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PrismaEventRepository>(PrismaEventRepository);
  });

  describe('findAll()', () => {
    it('should return all events with mapped venue name and city', async () => {
      mockPrisma.event.findMany.mockResolvedValue([prismRow]);

      const result = await repo.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'evt-1',
        venueName: 'Grand Arena',
        venueCity: 'KL',
      });
    });

    it('should apply venueId filter when provided', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);

      await repo.findAll('venue-1');

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { venueId: 'venue-1' } }),
      );
    });

    it('should not apply where clause when venueId is undefined', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);

      await repo.findAll(undefined);

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('should map null venue to null venue name and city', async () => {
      mockPrisma.event.findMany.mockResolvedValue([{ ...prismRow, venue: null }]);

      const result = await repo.findAll();

      expect(result[0].venueName).toBeNull();
      expect(result[0].venueCity).toBeNull();
    });
  });

  describe('findById()', () => {
    it('should return null when event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const result = await repo.findById('evt-unknown');

      expect(result).toBeNull();
    });

    it('should return event with mapped venue fields when found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(prismRow);

      const result = await repo.findById('evt-1');

      expect(result).toMatchObject({
        id: 'evt-1',
        venueName: 'Grand Arena',
        venueCity: 'KL',
      });
      expect(mockPrisma.event.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'evt-1' } }),
      );
    });
  });

  describe('update()', () => {
    it('should call prisma.event.update with correct where and data', async () => {
      const updated = { ...prismRow, title: 'Renamed Concert' };
      mockPrisma.event.update.mockResolvedValue(updated);

      const result = await repo.update('evt-1', { title: 'Renamed Concert' });

      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: { title: 'Renamed Concert' },
      });
      expect(result.title).toBe('Renamed Concert');
    });
  });
});
