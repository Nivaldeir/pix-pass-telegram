import { randomUUID } from "node:crypto";
import type { Payment } from "../domain/payment.js";
import type { PaymentGateway, PaymentCheckout } from "../domain/payment-gateway.js";
import type { PaymentRepository } from "../domain/payment-repository.js";

type Input = {
  telegramUserId: number;
  telegramChatId: number;
  amountCents: number;
};

export class CreatePayment {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly gateway: PaymentGateway
  ) {}

  async execute(input: Input): Promise<PaymentCheckout> {
    const pendingPayment = await this.payments.findLatestPendingByTelegramUserId(input.telegramUserId);

    if (pendingPayment) {
      if (pendingPayment.checkoutUrl) {
        return {
          paymentId: pendingPayment.id,
          checkoutUrl: pendingPayment.checkoutUrl,
          qrCode: pendingPayment.qrCode
        };
      }

      const checkout = await this.gateway.createCheckout(pendingPayment);
      pendingPayment.checkoutUrl = checkout.checkoutUrl;
      pendingPayment.qrCode = checkout.qrCode;
      await this.payments.save(pendingPayment);

      return checkout;
    }

    const payment: Payment = {
      id: randomUUID(),
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
      status: "pending" as const,
      amountCents: input.amountCents,
      createdAt: new Date()
    };

    await this.payments.create(payment);

    const checkout = await this.gateway.createCheckout(payment);
    payment.checkoutUrl = checkout.checkoutUrl;
    payment.qrCode = checkout.qrCode;
    await this.payments.save(payment);

    return checkout;
  }
}
