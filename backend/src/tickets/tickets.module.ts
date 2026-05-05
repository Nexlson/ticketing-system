import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketRepository } from './domain/ticket.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { TicketTierRepository } from './domain/ticket-tier.repository';
import { PrismaTicketTierRepository } from './infrastructure/prisma-ticket-tier.repository';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    { provide: TicketRepository, useClass: PrismaTicketRepository },
    { provide: TicketTierRepository, useClass: PrismaTicketTierRepository },
  ],
  exports: [TicketRepository, TicketTierRepository],
})
export class TicketsModule {}
