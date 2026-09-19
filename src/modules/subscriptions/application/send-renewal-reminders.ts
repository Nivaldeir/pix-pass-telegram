import type { CreatePayment } from "../../payments/application/create-payment.js";
import type { RenewalNotificationService } from "../../notifications/domain/renewal-notification-service.js";
import type { SubscriptionRepository } from "../domain/subscription-repository.js";

type Input = {
  amountCents: number;
  daysBeforeExpiration: number;
};

export class SendRenewalReminders {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly createPayment: CreatePayment,
    private readonly notifications: RenewalNotificationService
  ) {}

  async execute(input: Input): Promise<number> {
    const now = new Date();
    const reminderLimit = addDays(now, input.daysBeforeExpiration);
    const subscriptions = await this.subscriptions.findExpiringBetween(now, reminderLimit);

    for (const subscription of subscriptions) {
      const checkout = await this.createPayment.execute({
        telegramUserId: subscription.telegramUserId,
        telegramChatId: subscription.telegramUserId,
        amountCents: input.amountCents
      });

      await this.notifications.sendRenewalReminder(subscription, checkout);

      subscription.renewalReminderSentAt = now;
      subscription.updatedAt = now;
      await this.subscriptions.save(subscription);
    }

    return subscriptions.length;
  }
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}
