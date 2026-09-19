import type { Payment } from "./payment.js";

export type PaymentCheckout = {
  paymentId: string;
  checkoutUrl: string;
  qrCode?: string;
};

export interface PaymentGateway {
  createCheckout(payment: Payment): Promise<PaymentCheckout>;
}
