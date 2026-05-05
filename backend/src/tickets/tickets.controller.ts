import {
  Controller, Get, Post, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { LockTicketDto } from './dto/lock-ticket.dto';
import { HoldTierDto } from './dto/hold-tier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('tickets/:ticketId')
  findById(@Param('ticketId') ticketId: string) {
    return this.ticketsService.findById(ticketId);
  }

  @Post('tickets/:ticketId/lock')
  lock(
    @Param('ticketId') ticketId: string,
    @Body() dto: LockTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.lock(ticketId, dto, user);
  }

  @Delete('tickets/:ticketId/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlock(@Param('ticketId') ticketId: string, @CurrentUser() user: JwtPayload) {
    return this.ticketsService.unlock(ticketId, user);
  }

  @Post('tiers/:tierId/hold')
  holdTicket(
    @Param('tierId') tierId: string,
    @Body() dto: HoldTierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.holdTicket(tierId, dto, user);
  }

  @Post('tiers/:tierId/queue')
  joinQueue(@Param('tierId') tierId: string) {
    return this.ticketsService.joinQueue(tierId);
  }

  @Get('tiers/:tierId/queue/status')
  getQueueStatus(@Param('tierId') tierId: string, @Query('token') token: string) {
    return this.ticketsService.getQueueStatus(tierId, token);
  }

  @Delete('tiers/:tierId/queue')
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveQueue(@Param('tierId') tierId: string, @Query('token') token: string) {
    return this.ticketsService.leaveQueue(tierId, token);
  }
}
