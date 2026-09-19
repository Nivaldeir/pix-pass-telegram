import type { Payment } from "../domain/payment.js";
import type { PaymentRepository } from "../domain/payment-repository.js";

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();

  async create(payment: Payment): Promise<void> {
    this.payments.set(payment.id, payment);
  }

  async findById(paymentId: string): Promise<Payment | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async findLatestPendingByTelegramUserId(telegramUserId: number): Promise<Payment | null> {
    const payments = [...this.payments.values()]
      .filter((payment) => payment.telegramUserId === telegramUserId && payment.status === "pending")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return payments[0] ?? null;
  }

  async save(payment: Payment): Promise<void> {
    this.payments.set(payment.id, payment);
  }
}
