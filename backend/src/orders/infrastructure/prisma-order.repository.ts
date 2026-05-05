import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from '../domain/order.repository';
import { OrderEntity } from '../domain/order.entity';

@Injectable()
export class PrismaOrderRepository extends OrderRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<OrderEntity | null> {
    return this.prisma.order.findUnique({ where: { id } }) as Promise<OrderEntity | null>;
  }

  async findByUserId(userId: string): Promise<OrderEntity[]> {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<OrderEntity[]>;
  }

  async create(data: Pick<OrderEntity, 'userId' | 'totalAmount' | 'paymentReferenceId'>): Promise<OrderEntity> {
    return this.prisma.order.create({ data }) as Promise<OrderEntity>;
  }

  async updateStatus(id: string, status: OrderEntity['status']): Promise<OrderEntity> {
    return this.prisma.order.update({ where: { id }, data: { status } }) as Promise<OrderEntity>;
  }
}
