import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventRepository } from './domain/event.repository';
import { PrismaEventRepository } from './infrastructure/prisma-event.repository';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [TicketsModule],
  controllers: [EventsController],
  providers: [
    EventsService,
    { provide: EventRepository, useClass: PrismaEventRepository },
  ],
  exports: [EventRepository],
})
export class EventsModule {}
