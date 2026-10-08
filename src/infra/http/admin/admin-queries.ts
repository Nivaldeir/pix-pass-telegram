import type { Pool } from "pg";

export type AdminStats = {
  confirmedRevenueCents: number;
  confirmedPayments: number;
  pendingPayments: number;
  activeSubscriptions: number;
  activeGames: number;
  buyers: number;
};

export type AdminPayment = {
  id: string;
  telegramUserId: number;
  status: "pending" | "confirmed";
  productType: "vip" | "game";
  amountCents: number;
  gameTitle?: string;
  createdAt: Date;
  confirmedAt?: Date;
};

export type AdminUser = {
  telegramUserId: number;
  paidCount: number;
  totalCents: number;
  lastActivityAt: Date;
  subscriptionExpiresAt?: Date;
  subscriptionActive: boolean;
};

export class AdminQueries {
  constructor(private readonly pool: Pool) {}

  async stats(): Promise<AdminStats> {
    const result = await this.pool.query(`
      select
        (select coalesce(sum(amount_cents), 0) from payments where status = 'confirmed') as revenue,
        (select count(*) from payments where status = 'confirmed') as confirmed,
        (select count(*) from payments where status = 'pending') as pending,
        (select count(*) from subscriptions where status = 'active' and expires_at > now()) as subs,
        (select count(*) from games where is_active = true) as games,
        (select count(distinct telegram_user_id) from payments where status = 'confirmed') as buyers
    `);
    const row = result.rows[0];

    return {
      confirmedRevenueCents: Number(row.revenue),
      confirmedPayments: Number(row.confirmed),
      pendingPayments: Number(row.pending),
      activeSubscriptions: Number(row.subs),
      activeGames: Number(row.games),
      buyers: Number(row.buyers)
    };
  }

  async payments(limit = 200): Promise<AdminPayment[]> {
    const result = await this.pool.query(
      `select id, telegram_user_id, status, product_type, amount_cents, game_title, created_at, confirmed_at
       from payments order by created_at desc limit $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      telegramUserId: Number(row.telegram_user_id),
      status: row.status,
      productType: row.product_type,
      amountCents: row.amount_cents,
      gameTitle: row.game_title ?? undefined,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at ?? undefined
    }));
  }

  async users(limit = 200): Promise<AdminUser[]> {
    const result = await this.pool.query(
      `select p.telegram_user_id,
              count(*) filter (where p.status = 'confirmed') as paid_count,
              coalesce(sum(p.amount_cents) filter (where p.status = 'confirmed'), 0) as total_cents,
              max(p.created_at) as last_activity_at,
              s.expires_at, s.status as sub_status
       from payments p
       left join subscriptions s on s.telegram_user_id = p.telegram_user_id
       group by p.telegram_user_id, s.expires_at, s.status
       order by last_activity_at desc
       limit $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      telegramUserId: Number(row.telegram_user_id),
      paidCount: Number(row.paid_count),
      totalCents: Number(row.total_cents),
      lastActivityAt: row.last_activity_at,
      subscriptionExpiresAt: row.expires_at ?? undefined,
      subscriptionActive: row.sub_status === "active" && !!row.expires_at && new Date(row.expires_at) > new Date()
    }));
  }
}
