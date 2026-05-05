import { Test, TestingModule } from '@nestjs/testing';
import { PrismaVenueRepository } from './prisma-venue.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { VenueEntity } from '../domain/venue.entity';

const mockPrisma = {
  venue: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const prismaVenueRow = {
  id: 'venue-1',
  name: 'Grand Arena',
  address: '123 Main St',
  city: 'KL',
  capacity: 5000,
};

describe('PrismaVenueRepository', () => {
  let repo: PrismaVenueRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaVenueRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PrismaVenueRepository>(PrismaVenueRepository);
  });

  describe('findById()', () => {
    it('should return null when venue does not exist', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue(null);

      const result = await repo.findById('venue-x');

      expect(result).toBeNull();
    });

    it('should return venue with city mapped to null when Prisma returns null city', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({ ...prismaVenueRow, city: null });

      const result = await repo.findById('venue-1');

      expect(result!.city).toBeNull();
    });

    it('should return venue with city preserved when present', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue(prismaVenueRow);

      const result = await repo.findById('venue-1');

      expect(result!.city).toBe('KL');
    });
  });

  describe('findAll()', () => {
    it('should return all venues with city null-coalesced', async () => {
      mockPrisma.venue.findMany.mockResolvedValue([
        prismaVenueRow,
        { ...prismaVenueRow, id: 'venue-2', city: null },
      ]);

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].city).toBe('KL');
      expect(result[1].city).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create venue and return entity with null city coalesced', async () => {
      const row = { ...prismaVenueRow, city: null };
      mockPrisma.venue.create.mockResolvedValue(row);

      const data: Omit<VenueEntity, 'id'> = {
        name: 'New Arena',
        address: '1 New St',
        city: null,
        capacity: 1000,
      };

      const result = await repo.create(data);

      expect(result.city).toBeNull();
      expect(mockPrisma.venue.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('update()', () => {
    it('should update venue and return entity', async () => {
      const updatedRow = { ...prismaVenueRow, name: 'Renamed Arena' };
      mockPrisma.venue.update.mockResolvedValue(updatedRow);

      const result = await repo.update('venue-1', { name: 'Renamed Arena' });

      expect(result!.name).toBe('Renamed Arena');
      expect(mockPrisma.venue.update).toHaveBeenCalledWith({
        where: { id: 'venue-1' },
        data: { name: 'Renamed Arena' },
      });
    });

    it('should return null when Prisma throws (venue not found)', async () => {
      mockPrisma.venue.update.mockRejectedValue(new Error('Record not found'));

      const result = await repo.update('venue-x', { name: 'Ghost' });

      expect(result).toBeNull();
    });
  });
});
