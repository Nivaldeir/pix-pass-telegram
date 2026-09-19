import { randomUUID } from "node:crypto";
import type { Subscription } from "../domain/subscription.js";
import type { SubscriptionRepository } from "../domain/subscription-repository.js";

const MONTH_IN_DAYS = 30;

type Input = {
  telegramUserId: number;
  paidAt?: Date;
};

export class ActivateMonthlySubscription {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: Input): Promise<Subscription> {
    const paidAt = input.paidAt ?? new Date();
    const current = await this.subscriptions.findByTelegramUserId(input.telegramUserId);
    const startsAt = paidAt;
    const expiresAt = addDays(startsAt, MONTH_IN_DAYS);

    const subscription: Subscription = {
      id: current?.id ?? randomUUID(),
      telegramUserId: input.telegramUserId,
      status: "active",
      startsAt: current?.startsAt ?? paidAt,
      expiresAt,
      createdAt: current?.createdAt ?? paidAt,
      updatedAt: paidAt
    };

    await this.subscriptions.save(subscription);

    return subscription;
  }
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
