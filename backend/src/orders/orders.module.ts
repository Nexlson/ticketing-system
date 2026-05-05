import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRepository } from './domain/order.repository';
import { PrismaOrderRepository } from './infrastructure/prisma-order.repository';
import { TicketsModule } from '../tickets/tickets.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [TicketsModule, CacheModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: OrderRepository, useClass: PrismaOrderRepository },
  ],
})
export class OrdersModule {}
