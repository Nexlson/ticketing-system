import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { VenueRepository } from './domain/venue.repository';
import { VenueEntity } from './domain/venue.entity';

const mockVenue: VenueEntity = {
  id: 'venue-1',
  name: 'Grand Arena',
  address: '123 Main St',
  city: 'KL',
  capacity: 5000,
};

describe('VenuesController', () => {
  let controller: VenuesController;
  let venueRepo: jest.Mocked<VenueRepository>;

  beforeEach(async () => {
    venueRepo = {
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([mockVenue]),
      create: jest.fn().mockResolvedValue(mockVenue),
      update: jest.fn().mockResolvedValue(mockVenue),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [{ provide: VenueRepository, useValue: venueRepo }],
    }).compile();

    controller = module.get<VenuesController>(VenuesController);
  });

  describe('findAll()', () => {
    it('should return all venues from repository', async () => {
      const result = await controller.findAll();

      expect(result).toEqual([mockVenue]);
      expect(venueRepo.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('create()', () => {
    it('should call repository.create() with dto and null city fallback', async () => {
      const dto = { name: 'Stadium', address: '1 Sport Ave', capacity: 3000 };

      await controller.create(dto as any);

      expect(venueRepo.create).toHaveBeenCalledWith({
        name: 'Stadium',
        address: '1 Sport Ave',
        capacity: 3000,
        city: null,
      });
    });

    it('should preserve city when provided in DTO', async () => {
      const dto = { name: 'Arena', address: '2 Main St', city: 'PJ', capacity: 1000 };

      await controller.create(dto as any);

      expect(venueRepo.create).toHaveBeenCalledWith({
        name: 'Arena',
        address: '2 Main St',
        city: 'PJ',
        capacity: 1000,
      });
    });

    it('should return created venue from repository', async () => {
      const result = await controller.create({
        name: 'New Venue',
        address: '5 Road',
        capacity: 500,
      } as any);

      expect(result).toEqual(mockVenue);
    });
  });

  describe('update()', () => {
    it('should call repository.update() with id and dto', async () => {
      const dto = { name: 'Renamed Arena' };

      await controller.update('venue-1', dto as any);

      expect(venueRepo.update).toHaveBeenCalledWith('venue-1', dto);
    });

    it('should return updated venue from repository', async () => {
      const result = await controller.update('venue-1', { name: 'Updated' } as any);

      expect(result).toEqual(mockVenue);
    });

    it('should throw NotFoundException when repository returns null', async () => {
      venueRepo.update.mockResolvedValue(null);

      await expect(controller.update('venue-x', { name: 'Ghost' } as any))
        .rejects.toThrow(NotFoundException);
    });
  });
});
