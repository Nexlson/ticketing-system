import { Module } from '@nestjs/common';
import { VenueRepository } from './domain/venue.repository';
import { PrismaVenueRepository } from './infrastructure/prisma-venue.repository';
import { VenuesController } from './venues.controller';

@Module({
  controllers: [VenuesController],
  providers: [{ provide: VenueRepository, useClass: PrismaVenueRepository }],
  exports: [VenueRepository],
})
export class VenuesModule {}
