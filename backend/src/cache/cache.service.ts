import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const HOLD_KEY     = (ticketId: string) => `hold:${ticketId}`;
const QUEUE_KEY    = (tierId: string)   => `queue:${tierId}`;
const WINDOW_KEY   = (tierId: string, token: string) => `queue:window:${tierId}:${token}`;
const INFLIGHT_KEY = (eventId: string)  => `hold:inflight:${eventId}`;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(url);
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Atomically reserve a ticket hold for userId.
   * Uses SET NX EX so only one caller wins per ticket.
   * Returns true if the hold was set, false if already held.
   */
  async setHold(ticketId: string, userId: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(HOLD_KEY(ticketId), userId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async getHold(ticketId: string): Promise<string | null> {
    return this.client.get(HOLD_KEY(ticketId));
  }

  async deleteHold(ticketId: string): Promise<void> {
    await this.client.del(HOLD_KEY(ticketId));
  }

  // ── Virtual queue ────────────────────────────────────────────────────────────

  /** Add token to FIFO queue. Returns 0-indexed rank. */
  async joinQueue(tierId: string, token: string): Promise<number> {
    const score = Date.now();
    await this.client.zadd(QUEUE_KEY(tierId), 'NX', score, token);
    return (await this.client.zrank(QUEUE_KEY(tierId), token)) ?? 0;
  }

  async leaveQueue(tierId: string, token: string): Promise<void> {
    await this.client.zrem(QUEUE_KEY(tierId), token);
  }

  /** Returns 0-indexed rank, or null if not in queue. */
  async getQueueRank(tierId: string, token: string): Promise<number | null> {
    const rank = await this.client.zrank(QUEUE_KEY(tierId), token);
    return rank ?? null;
  }

  async getQueueLength(tierId: string): Promise<number> {
    return this.client.zcard(QUEUE_KEY(tierId));
  }

  /** Atomically claim an active window. Returns true if claimed, false if already set. */
  async setQueueWindow(tierId: string, token: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(WINDOW_KEY(tierId, token), '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async isQueueWindowActive(tierId: string, token: string): Promise<boolean> {
    return (await this.client.exists(WINDOW_KEY(tierId, token))) === 1;
  }

  async getQueueWindowTtl(tierId: string, token: string): Promise<number> {
    return this.client.ttl(WINDOW_KEY(tierId, token));
  }

  async deleteQueueWindow(tierId: string, token: string): Promise<void> {
    await this.client.del(WINDOW_KEY(tierId, token));
  }

  /** How many of these ticket IDs have no active Redis hold. */
  async countFreeTickets(ticketIds: string[]): Promise<number> {
    if (ticketIds.length === 0) return 0;
    const held = await this.client.exists(...ticketIds.map(HOLD_KEY));
    return ticketIds.length - held;
  }

  /** Returns in-flight count after increment. Safety TTL prevents stuck counters on crash. */
  async enterHoldInflight(tierId: string): Promise<number> {
    const key = INFLIGHT_KEY(tierId);
    const count = await this.client.incr(key);
    // hold if more than 1 request
    if (count === 1) await this.client.expire(key, 30);
    return count;
  }

  async exitHoldInflight(tierId: string): Promise<void> {
    const key = INFLIGHT_KEY(tierId);
    const val = await this.client.decr(key);
    if (val <= 0) await this.client.del(key);
  }
}
