import type { Payment } from "./payment.js";

export interface PaymentRepository {
  create(payment: Payment): Promise<void>;
  findById(paymentId: string): Promise<Payment | null>;
  findLatestPendingByTelegramUserId(telegramUserId: number): Promise<Payment | null>;
  save(payment: Payment): Promise<void>;
}
