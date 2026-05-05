import { Controller, Get, Post, Put, Body, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Query('venue_id') venueId?: string) {
    return this.eventsService.findAll(venueId);
  }

  @Get(':eventId/tiers')
  getTiers(@Param('eventId') eventId: string) {
    return this.eventsService.getTiers(eventId);
  }

  @Get(':eventId/occupied-seats')
  getOccupiedSeats(@Param('eventId') eventId: string) {
    return this.eventsService.getOccupiedSeats(eventId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.create(dto, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }
}
