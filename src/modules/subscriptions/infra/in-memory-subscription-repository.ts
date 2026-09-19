import type { Subscription } from "../domain/subscription.js";
import type { SubscriptionRepository } from "../domain/subscription-repository.js";

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptions = new Map<number, Subscription>();

  async findByTelegramUserId(telegramUserId: number): Promise<Subscription | null> {
    return this.subscriptions.get(telegramUserId) ?? null;
  }

  async findExpiringBetween(startsAt: Date, endsAt: Date): Promise<Subscription[]> {
    return [...this.subscriptions.values()].filter((subscription) => {
      const expiresAt = subscription.expiresAt.getTime();

      return (
        subscription.status === "active" &&
        !subscription.renewalReminderSentAt &&
        expiresAt > startsAt.getTime() &&
        expiresAt <= endsAt.getTime()
      );
    });
  }

  async findExpired(now: Date): Promise<Subscription[]> {
    return [...this.subscriptions.values()].filter(
      (subscription) => subscription.status === "active" && subscription.expiresAt.getTime() <= now.getTime()
    );
  }

  async save(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.telegramUserId, subscription);
  }
}
