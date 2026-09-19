import type { PaymentCheckout } from "../../payments/domain/payment-gateway.js";
import type { Subscription } from "../../subscriptions/domain/subscription.js";

export interface RenewalNotificationService {
  sendRenewalReminder(subscription: Subscription, checkout: PaymentCheckout): Promise<void>;
}
