import {
  Injectable, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { OrderRepository } from './domain/order.repository';
import { OrderEntity } from './domain/order.entity';
import { TicketRepository } from '../tickets/domain/ticket.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly cacheService: CacheService,
  ) {}

  async findById(orderId: string, userId: string): Promise<OrderEntity> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    return order;
  }

  async findByCurrentUser(user: JwtPayload): Promise<OrderEntity[]> {
    return this.orderRepo.findByUserId(user.sub);
  }

  async create(dto: CreateOrderDto, user: JwtPayload): Promise<OrderEntity> {
    const tickets = await this.ticketRepo.findManyByIds(dto.ticket_ids);

    if (tickets.length !== dto.ticket_ids.length) {
      throw new NotFoundException('One or more tickets not found');
    }

    for (const ticket of tickets) {
      const holder = await this.cacheService.getHold(ticket.id);
      if (!holder) {
        throw new UnprocessableEntityException(`Hold on ticket ${ticket.id} has expired`);
      }
      if (holder !== user.sub) {
        throw new UnprocessableEntityException(`Ticket ${ticket.id} not held by you`);
      }
    }

    const totalAmount = this.computeTotal(tickets.map((t) => t.tierPrice ?? 0));

    const order = await this.orderRepo.create({
      userId: user.sub,
      totalAmount,
      paymentReferenceId: dto.payment_token,
    });
    await this.ticketRepo.markSold(dto.ticket_ids, order.id);

    // Release Redis holds after successful purchase
    await Promise.all(dto.ticket_ids.map((id) => this.cacheService.deleteHold(id)));

    return this.orderRepo.updateStatus(order.id, 'PAID');
  }

  private computeTotal(tierPrices: number[]): number {
    const subtotal = tierPrices.reduce((sum, p) => sum + p, 0);
    return subtotal + Math.round(subtotal * 0.08);
  }
}
