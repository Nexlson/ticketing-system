import { OrderEntity } from './order.entity';

export abstract class OrderRepository {
  abstract findById(id: string): Promise<OrderEntity | null>;
  abstract findByUserId(userId: string): Promise<OrderEntity[]>;
  abstract create(data: Pick<OrderEntity, 'userId' | 'totalAmount' | 'paymentReferenceId'>): Promise<OrderEntity>;
  abstract updateStatus(id: string, status: OrderEntity['status']): Promise<OrderEntity>;
}
