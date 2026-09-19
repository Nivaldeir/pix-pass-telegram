import { isSubscriptionActive, type Subscription } from "../domain/subscription.js";
import type { SubscriptionRepository } from "../domain/subscription-repository.js";

export type SubscriptionStatusView = {
  subscription: Subscription | null;
  isActive: boolean;
};

export class GetSubscriptionStatus {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(telegramUserId: number): Promise<SubscriptionStatusView> {
    const subscription = await this.subscriptions.findByTelegramUserId(telegramUserId);

    return {
      subscription,
      isActive: subscription ? isSubscriptionActive(subscription) : false
    };
  }
}
