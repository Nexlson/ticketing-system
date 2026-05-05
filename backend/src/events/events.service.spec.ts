import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventRepository } from './domain/event.repository';
import { EventEntity } from './domain/event.entity';
import { TicketTierRepository } from '../tickets/domain/ticket-tier.repository';
import { TicketTierEntity } from '../tickets/domain/ticket-tier.entity';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const mockUser: JwtPayload = { sub: 'user-1', username: 'admin', role: 'ADMIN' };

const mockEvent: EventEntity = {
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
  venueName: 'Grand Arena',
  venueCity: 'KL',
};

const mockTier: TicketTierEntity = {
  id: 'tier-1',
  eventId: 'evt-1',
  name: 'VIP',
  price: 10000,
  quantity: 48,
  availableCount: 48,
  color: '#ff0000',
  tierKey: 'vip',
};

describe('EventsService', () => {
  let service: EventsService;
  let eventRepo: jest.Mocked<EventRepository>;
  let tierRepo: jest.Mocked<TicketTierRepository>;
  let prisma: any;

  beforeEach(async () => {
    eventRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    tierRepo = {
      findByEventId: jest.fn(),
      findById: jest.fn(),
      findAvailableTicketsByTierId: jest.fn(),
    } as any;

    prisma = {
      $transaction: jest.fn(),
      ticket: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: EventRepository, useValue: eventRepo },
        { provide: TicketTierRepository, useValue: tierRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('findAll()', () => {
    it('should return all events mapped to snake_case response shape', async () => {
      eventRepo.findAll.mockResolvedValue([mockEvent]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'evt-1',
        venue_id: 'venue-1',
        venue_name: 'Grand Arena',
        venue_city: 'KL',
        organizer_id: 'user-1',
        title: 'Test Concert',
        status: 'PUBLISHED',
      });
    });

    it('should pass venueId filter to repository', async () => {
      eventRepo.findAll.mockResolvedValue([]);

      await service.findAll('venue-1');

      expect(eventRepo.findAll).toHaveBeenCalledWith('venue-1');
    });

    it('should return empty array when no events exist', async () => {
      eventRepo.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should map null venue fields correctly', async () => {
      const eventWithoutVenue = { ...mockEvent, venueName: null, venueCity: null };
      eventRepo.findAll.mockResolvedValue([eventWithoutVenue]);

      const result = await service.findAll();

      expect(result[0].venue_name).toBeNull();
      expect(result[0].venue_city).toBeNull();
    });
  });

  describe('getTiers()', () => {
    it('should throw NotFoundException when event does not exist', async () => {
      eventRepo.findById.mockResolvedValue(null);

      await expect(service.getTiers('evt-unknown')).rejects.toThrow(NotFoundException);
    });

    it('should return tiers for an existing event', async () => {
      eventRepo.findById.mockResolvedValue(mockEvent);
      tierRepo.findByEventId.mockResolvedValue([mockTier]);

      const result = await service.getTiers('evt-1');

      expect(result).toEqual([mockTier]);
      expect(tierRepo.findByEventId).toHaveBeenCalledWith('evt-1');
    });
  });

  describe('getOccupiedSeats()', () => {
    it('should return seat labels of SOLD tickets for the event', async () => {
      tierRepo.findByEventId.mockResolvedValue([mockTier]);
      prisma.ticket.findMany.mockResolvedValue([
        { seatLabel: 'A-1-1' },
        { seatLabel: 'A-1-2' },
      ]);

      const result = await service.getOccupiedSeats('evt-1');

      expect(result).toEqual(['A-1-1', 'A-1-2']);
    });

    it('should return empty array when no seats are sold', async () => {
      tierRepo.findByEventId.mockResolvedValue([mockTier]);
      prisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.getOccupiedSeats('evt-1');

      expect(result).toEqual([]);
    });
  });

  describe('create()', () => {
    it('should throw UnprocessableEntityException when end_time is before start_time', async () => {
      const dto = {
        venue_id: 'venue-1',
        title: 'Bad Event',
        start_time: '2025-06-01T21:00:00Z',
        end_time: '2025-06-01T18:00:00Z',
      };

      await expect(service.create(dto as any, mockUser))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when end_time equals start_time', async () => {
      const dto = {
        venue_id: 'venue-1',
        title: 'Bad Event',
        start_time: '2025-06-01T18:00:00Z',
        end_time: '2025-06-01T18:00:00Z',
      };

      await expect(service.create(dto as any, mockUser))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('should create event via Prisma transaction and return response shape', async () => {
      const createdEvent = { ...mockEvent, id: 'evt-new' };
      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          event: { create: jest.fn().mockResolvedValue(createdEvent) },
          ticketTier: { create: jest.fn().mockResolvedValue(mockTier) },
          ticket: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return fn(tx);
      });

      const dto = {
        venue_id: 'venue-1',
        title: 'Good Event',
        start_time: '2025-06-01T18:00:00Z',
        end_time: '2025-06-01T21:00:00Z',
        tiers: [],
      };

      const result = await service.create(dto as any, mockUser);

      expect(result.id).toBe('evt-new');
      expect(result.title).toBe('Test Concert');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should default status to DRAFT when not provided', async () => {
      let capturedData: any;
      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          event: {
            create: jest.fn().mockImplementation(({ data }) => {
              capturedData = data;
              return Promise.resolve({ ...mockEvent, id: 'evt-new', ...data });
            }),
          },
          ticketTier: { create: jest.fn() },
          ticket: { createMany: jest.fn() },
        };
        return fn(tx);
      });

      await service.create({
        venue_id: 'venue-1',
        title: 'No Status Event',
        start_time: '2025-06-01T18:00:00Z',
        end_time: '2025-06-01T21:00:00Z',
      } as any, mockUser);

      expect(capturedData.status).toBe('DRAFT');
    });
  });

  describe('update()', () => {
    it('should throw NotFoundException when event does not exist', async () => {
      eventRepo.findById.mockResolvedValue(null);

      await expect(service.update('evt-unknown', { title: 'New Title' } as any))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException when both times provided and end <= start', async () => {
      eventRepo.findById.mockResolvedValue(mockEvent);

      await expect(service.update('evt-1', {
        start_time: '2025-06-01T21:00:00Z',
        end_time: '2025-06-01T18:00:00Z',
      } as any)).rejects.toThrow(UnprocessableEntityException);
    });

    it('should update event and return response shape', async () => {
      const updatedEvent = { ...mockEvent, title: 'Updated Title' };
      eventRepo.findById.mockResolvedValue(mockEvent);
      eventRepo.update.mockResolvedValue(updatedEvent);

      const result = await service.update('evt-1', { title: 'Updated Title' } as any);

      expect(result.title).toBe('Updated Title');
      expect(eventRepo.update).toHaveBeenCalledWith('evt-1', { title: 'Updated Title' });
    });

    it('should not validate times when only one time field is updated', async () => {
      const updatedEvent = { ...mockEvent };
      eventRepo.findById.mockResolvedValue(mockEvent);
      eventRepo.update.mockResolvedValue(updatedEvent);

      await expect(service.update('evt-1', { title: 'Solo Update' } as any))
        .resolves.not.toThrow();
    });
  });
});
