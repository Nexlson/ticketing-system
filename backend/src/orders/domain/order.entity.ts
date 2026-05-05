export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export class OrderEntity {
  id: string;
  userId: string;
  totalAmount: number;
  status: OrderStatus;
  paymentReferenceId: string | null;
  createdAt: Date;
}
