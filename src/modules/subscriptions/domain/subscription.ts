export type SubscriptionStatus = "active" | "expired";

export type Subscription = {
  id: string;
  telegramUserId: number;
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  renewalReminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export function isSubscriptionActive(subscription: Subscription, now = new Date()): boolean {
  return subscription.status === "active" && subscription.expiresAt.getTime() > now.getTime();
}
