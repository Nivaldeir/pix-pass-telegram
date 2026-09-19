import pg from "pg";
import { env } from "../../shared/config/env.js";

const { Pool } = pg;

export const postgresPool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function setupPostgres(): Promise<void> {
  await postgresPool.query(`
    create table if not exists payments (
      id uuid primary key,
      telegram_user_id bigint not null,
      telegram_chat_id bigint not null,
      status text not null check (status in ('pending', 'confirmed')),
      amount_cents integer not null,
      checkout_url text,
      qr_code text,
      created_at timestamptz not null,
      confirmed_at timestamptz
    );

    create index if not exists idx_payments_user_pending_created
      on payments (telegram_user_id, status, created_at desc);

    create table if not exists subscriptions (
      id uuid primary key,
      telegram_user_id bigint not null unique,
      status text not null check (status in ('active', 'expired')),
      starts_at timestamptz not null,
      expires_at timestamptz not null,
      renewal_reminder_sent_at timestamptz,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );

    create index if not exists idx_subscriptions_expiring
      on subscriptions (status, renewal_reminder_sent_at, expires_at);

    create index if not exists idx_subscriptions_expired
      on subscriptions (status, expires_at);
  `);
}
