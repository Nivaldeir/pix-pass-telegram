import type { Pool } from "pg";
import type { Subscription, SubscriptionStatus } from "../domain/subscription.js";
import type { SubscriptionRepository } from "../domain/subscription-repository.js";

type SubscriptionRow = {
  id: string;
  telegram_user_id: string;
  status: SubscriptionStatus;
  starts_at: Date;
  expires_at: Date;
  renewal_reminder_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly pool: Pool) {}

  async findByTelegramUserId(telegramUserId: number): Promise<Subscription | null> {
    const result = await this.pool.query<SubscriptionRow>(
      `
        select *
        from subscriptions
        where telegram_user_id = $1
        limit 1
      `,
      [telegramUserId]
    );

    return result.rows[0] ? toSubscription(result.rows[0]) : null;
  }

  async findExpiringBetween(startsAt: Date, endsAt: Date): Promise<Subscription[]> {
    const result = await this.pool.query<SubscriptionRow>(
      `
        select *
        from subscriptions
        where status = 'active'
          and renewal_reminder_sent_at is null
          and expires_at > $1
          and expires_at <= $2
        order by expires_at asc
      `,
      [startsAt, endsAt]
    );

    return result.rows.map(toSubscription);
  }

  async findExpired(now: Date): Promise<Subscription[]> {
    const result = await this.pool.query<SubscriptionRow>(
      `
        select *
        from subscriptions
        where status = 'active'
          and expires_at <= $1
        order by expires_at asc
      `,
      [now]
    );

    return result.rows.map(toSubscription);
  }

  async save(subscription: Subscription): Promise<void> {
    await this.pool.query(
      `
        insert into subscriptions (
          id,
          telegram_user_id,
          status,
          starts_at,
          expires_at,
          renewal_reminder_sent_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (telegram_user_id) do update set
          id = excluded.id,
          status = excluded.status,
          starts_at = excluded.starts_at,
          expires_at = excluded.expires_at,
          renewal_reminder_sent_at = excluded.renewal_reminder_sent_at,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        subscription.id,
        subscription.telegramUserId,
        subscription.status,
        subscription.startsAt,
        subscription.expiresAt,
        subscription.renewalReminderSentAt ?? null,
        subscription.createdAt,
        subscription.updatedAt
      ]
    );
  }
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    status: row.status,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    renewalReminderSentAt: row.renewal_reminder_sent_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
