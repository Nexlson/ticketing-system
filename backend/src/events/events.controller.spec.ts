import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const mockUser: JwtPayload = { sub: 'user-1', username: 'admin', role: 'ADMIN' };

const mockEventResponse = {
  id: 'evt-1',
  venue_id: 'venue-1',
  venue_name: 'Grand Arena',
  venue_city: 'KL',
  organizer_id: 'user-1',
  title: 'Test Concert',
  start_time: new Date('2025-06-01T18:00:00Z'),
  end_time: new Date('2025-06-01T21:00:00Z'),
  status: 'PUBLISHED',
  category: 'Music',
  description: null,
  cover_color_1: null,
  cover_color_2: null,
};

describe('EventsController', () => {
  let controller: EventsController;
  let eventsService: jest.Mocked<EventsService>;

  beforeEach(async () => {
    eventsService = {
      findAll: jest.fn().mockResolvedValue([mockEventResponse]),
      getTiers: jest.fn().mockResolvedValue([]),
      getOccupiedSeats: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(mockEventResponse),
      update: jest.fn().mockResolvedValue(mockEventResponse),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: eventsService }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  describe('findAll()', () => {
    it('should call eventsService.findAll() without venueId by default', async () => {
      await controller.findAll(undefined);

      expect(eventsService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should pass venueId filter to eventsService.findAll()', async () => {
      await controller.findAll('venue-1');

      expect(eventsService.findAll).toHaveBeenCalledWith('venue-1');
    });

    it('should return events from service', async () => {
      const result = await controller.findAll(undefined);

      expect(result).toEqual([mockEventResponse]);
    });
  });

  describe('getTiers()', () => {
    it('should call eventsService.getTiers() with the eventId param', async () => {
      await controller.getTiers('evt-1');

      expect(eventsService.getTiers).toHaveBeenCalledWith('evt-1');
    });
  });

  describe('getOccupiedSeats()', () => {
    it('should call eventsService.getOccupiedSeats() with the eventId param', async () => {
      await controller.getOccupiedSeats('evt-1');

      expect(eventsService.getOccupiedSeats).toHaveBeenCalledWith('evt-1');
    });
  });

  describe('create()', () => {
    it('should call eventsService.create() with DTO and current user', async () => {
      const dto = {
        venue_id: 'venue-1',
        title: 'New Concert',
        start_time: '2025-07-01T18:00:00Z',
        end_time: '2025-07-01T21:00:00Z',
      } as any;

      await controller.create(dto, mockUser);

      expect(eventsService.create).toHaveBeenCalledWith(dto, mockUser);
    });

    it('should return created event from service', async () => {
      const result = await controller.create({} as any, mockUser);

      expect(result).toEqual(mockEventResponse);
    });
  });

  describe('update()', () => {
    it('should call eventsService.update() with id and DTO', async () => {
      const dto = { title: 'Updated Concert' } as any;

      await controller.update('evt-1', dto);

      expect(eventsService.update).toHaveBeenCalledWith('evt-1', dto);
    });

    it('should return updated event from service', async () => {
      const result = await controller.update('evt-1', {} as any);

      expect(result).toEqual(mockEventResponse);
    });
  });
});
