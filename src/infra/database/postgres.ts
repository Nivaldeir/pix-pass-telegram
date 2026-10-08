import pg from "pg";
import { env } from "../../shared/config/env.js";

const { Pool } = pg;

export const postgresPool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function setupPostgres(): Promise<void> {
  await postgresPool.query(`
    create table if not exists games (
      id uuid primary key,
      title text not null,
      starts_at timestamptz,
      amount_cents integer not null,
      telegram_group_id bigint not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null
    );

    alter table games add column if not exists telegram_group_id bigint not null default 0;
    alter table games add column if not exists stream_server_url text;
    alter table games add column if not exists stream_key text;
    alter table games add column if not exists home_logo_url text;
    alter table games add column if not exists telegram_access_hash text;
    alter table games add column if not exists auto_created_group boolean not null default false;
    alter table games add column if not exists delete_at timestamptz;
    alter table games add column if not exists group_deleted_at timestamptz;
    alter table games add column if not exists away_logo_url text;

    create index if not exists idx_games_active_starts
      on games (is_active, starts_at, created_at desc);

    create table if not exists payments (
      id uuid primary key,
      telegram_user_id bigint not null,
      telegram_chat_id bigint not null,
      status text not null check (status in ('pending', 'confirmed')),
      product_type text not null default 'vip' check (product_type in ('vip', 'game')),
      amount_cents integer not null,
      game_id uuid references games(id),
      game_title text,
      game_telegram_group_id bigint,
      checkout_url text,
      qr_code text,
      created_at timestamptz not null,
      confirmed_at timestamptz
    );

    alter table payments add column if not exists product_type text not null default 'vip';
    alter table payments add column if not exists game_id uuid references games(id);
    alter table payments add column if not exists game_title text;
    alter table payments add column if not exists game_telegram_group_id bigint;

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
