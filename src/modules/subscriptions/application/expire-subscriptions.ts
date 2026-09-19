import type { GroupAccessService } from "../../access/domain/group-access-service.js";
import type { SubscriptionRepository } from "../domain/subscription-repository.js";

export class ExpireSubscriptions {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly groupAccess: GroupAccessService
  ) {}

  async execute(now = new Date()): Promise<number> {
    const expiredSubscriptions = await this.subscriptions.findExpired(now);

    for (const subscription of expiredSubscriptions) {
      await this.groupAccess.revokeAccess(subscription.telegramUserId);
      subscription.status = "expired";
      subscription.updatedAt = now;
      await this.subscriptions.save(subscription);
    }

    return expiredSubscriptions.length;
  }
}
