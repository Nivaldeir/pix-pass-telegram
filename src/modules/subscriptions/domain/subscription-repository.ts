import type { Subscription } from "./subscription.js";

export interface SubscriptionRepository {
  findByTelegramUserId(telegramUserId: number): Promise<Subscription | null>;
  findExpiringBetween(startsAt: Date, endsAt: Date): Promise<Subscription[]>;
  findExpired(now: Date): Promise<Subscription[]>;
  save(subscription: Subscription): Promise<void>;
}
