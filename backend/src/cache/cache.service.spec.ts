import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

const mockRedisClient = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  zadd: jest.fn(),
  zrank: jest.fn(),
  zrem: jest.fn(),
  zcard: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  exists: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  default: jest.fn(() => mockRedisClient),
  __esModule: true,
}));

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisClient.quit.mockResolvedValue('OK');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('redis://localhost:6379') },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('setHold()', () => {
    it('should return true when Redis SET NX succeeds', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.setHold('ticket-1', 'user-1', 600);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'hold:ticket-1', 'user-1', 'EX', 600, 'NX',
      );
    });

    it('should return false when key is already set (NX rejected)', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const result = await service.setHold('ticket-1', 'user-1', 600);

      expect(result).toBe(false);
    });
  });

  describe('getHold()', () => {
    it('should return userId when hold exists', async () => {
      mockRedisClient.get.mockResolvedValue('user-1');

      const result = await service.getHold('ticket-1');

      expect(result).toBe('user-1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('hold:ticket-1');
    });

    it('should return null when no hold exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getHold('ticket-1');

      expect(result).toBeNull();
    });
  });

  describe('deleteHold()', () => {
    it('should delete the hold key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.deleteHold('ticket-1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('hold:ticket-1');
    });
  });

  describe('joinQueue()', () => {
    it('should add token to sorted set with NX flag and return 0-indexed rank', async () => {
      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zrank.mockResolvedValue(2);

      const rank = await service.joinQueue('tier-1', 'tok-abc');

      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        'queue:tier-1', 'NX', expect.any(Number), 'tok-abc',
      );
      expect(rank).toBe(2);
    });

    it('should return 0 when zrank returns null', async () => {
      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.zrank.mockResolvedValue(null);

      const rank = await service.joinQueue('tier-1', 'tok-abc');

      expect(rank).toBe(0);
    });
  });

  describe('leaveQueue()', () => {
    it('should remove token from sorted set', async () => {
      mockRedisClient.zrem.mockResolvedValue(1);

      await service.leaveQueue('tier-1', 'tok-abc');

      expect(mockRedisClient.zrem).toHaveBeenCalledWith('queue:tier-1', 'tok-abc');
    });
  });

  describe('getQueueRank()', () => {
    it('should return 0-indexed rank when token is in queue', async () => {
      mockRedisClient.zrank.mockResolvedValue(3);

      const rank = await service.getQueueRank('tier-1', 'tok-abc');

      expect(rank).toBe(3);
      expect(mockRedisClient.zrank).toHaveBeenCalledWith('queue:tier-1', 'tok-abc');
    });

    it('should return null when token is not in queue', async () => {
      mockRedisClient.zrank.mockResolvedValue(null);

      const rank = await service.getQueueRank('tier-1', 'tok-unknown');

      expect(rank).toBeNull();
    });
  });

  describe('getQueueLength()', () => {
    it('should return sorted set cardinality', async () => {
      mockRedisClient.zcard.mockResolvedValue(42);

      const len = await service.getQueueLength('tier-1');

      expect(len).toBe(42);
      expect(mockRedisClient.zcard).toHaveBeenCalledWith('queue:tier-1');
    });
  });

  describe('setQueueWindow()', () => {
    it('should return true when window key is set successfully', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.setQueueWindow('tier-1', 'tok-abc', 600);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'queue:window:tier-1:tok-abc', '1', 'EX', 600, 'NX',
      );
    });

    it('should return false when window key already exists', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const result = await service.setQueueWindow('tier-1', 'tok-abc', 600);

      expect(result).toBe(false);
    });
  });

  describe('isQueueWindowActive()', () => {
    it('should return true when window key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.isQueueWindowActive('tier-1', 'tok-abc');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('queue:window:tier-1:tok-abc');
    });

    it('should return false when window key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.isQueueWindowActive('tier-1', 'tok-abc');

      expect(result).toBe(false);
    });
  });

  describe('getQueueWindowTtl()', () => {
    it('should return TTL for the window key', async () => {
      mockRedisClient.ttl.mockResolvedValue(300);

      const result = await service.getQueueWindowTtl('tier-1', 'tok-abc');

      expect(result).toBe(300);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('queue:window:tier-1:tok-abc');
    });
  });

  describe('deleteQueueWindow()', () => {
    it('should delete the window key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.deleteQueueWindow('tier-1', 'tok-abc');

      expect(mockRedisClient.del).toHaveBeenCalledWith('queue:window:tier-1:tok-abc');
    });
  });

  describe('enterHoldInflight()', () => {
    it('should increment inflight counter and return new count', async () => {
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);

      const count = await service.enterHoldInflight('evt-1');

      expect(count).toBe(1);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('hold:inflight:evt-1');
    });

    it('should set 30-second safety TTL on first request (count === 1)', async () => {
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);

      await service.enterHoldInflight('evt-1');

      expect(mockRedisClient.expire).toHaveBeenCalledWith('hold:inflight:evt-1', 30);
    });

    it('should not set TTL on subsequent requests (count > 1)', async () => {
      mockRedisClient.incr.mockResolvedValue(2);

      await service.enterHoldInflight('evt-1');

      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });
  });

  describe('countFreeTickets()', () => {
    it('should return 0 when ticketIds array is empty', async () => {
      const result = await service.countFreeTickets([]);
      expect(result).toBe(0);
    });

    it('should return count of tickets not held in Redis', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.countFreeTickets(['ticket-1', 'ticket-2', 'ticket-3']);

      expect(result).toBe(2);
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        'hold:ticket-1', 'hold:ticket-2', 'hold:ticket-3',
      );
    });
  });

  describe('exitHoldInflight()', () => {
    it('should decrement inflight counter', async () => {
      mockRedisClient.decr.mockResolvedValue(1);

      await service.exitHoldInflight('evt-1');

      expect(mockRedisClient.decr).toHaveBeenCalledWith('hold:inflight:evt-1');
    });

    it('should delete the inflight key when counter reaches zero', async () => {
      mockRedisClient.decr.mockResolvedValue(0);
      mockRedisClient.del.mockResolvedValue(1);

      await service.exitHoldInflight('evt-1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('hold:inflight:evt-1');
    });

    it('should delete the inflight key when counter goes negative', async () => {
      mockRedisClient.decr.mockResolvedValue(-1);
      mockRedisClient.del.mockResolvedValue(1);

      await service.exitHoldInflight('evt-1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('hold:inflight:evt-1');
    });

    it('should not delete the inflight key when counter is still positive', async () => {
      mockRedisClient.decr.mockResolvedValue(2);

      await service.exitHoldInflight('evt-1');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});
