import type { Payment } from "../domain/payment.js";
import type { PaymentCheckout, PaymentGateway } from "../domain/payment-gateway.js";

export class SimulatedPaymentGateway implements PaymentGateway {
  constructor(private readonly appBaseUrl: string) {}

  async createCheckout(payment: Payment): Promise<PaymentCheckout> {
    return {
      paymentId: payment.id,
      checkoutUrl: `${this.appBaseUrl}/payments/simulate/${payment.id}`
    };
  }
}
