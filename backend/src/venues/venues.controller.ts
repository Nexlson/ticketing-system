import { Body, Controller, Get, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VenueRepository } from './domain/venue.repository';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@UseGuards(JwtAuthGuard)
@Controller('venues')
export class VenuesController {
  constructor(private readonly venueRepo: VenueRepository) {}

  @Get()
  findAll() {
    return this.venueRepo.findAll();
  }

  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.venueRepo.create({ ...dto, city: dto.city ?? null });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    const venue = await this.venueRepo.update(id, dto);
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }
}
