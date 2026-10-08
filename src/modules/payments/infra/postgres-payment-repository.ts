import type { Pool } from "pg";
import type { Payment, PaymentProductType, PaymentStatus } from "../domain/payment.js";
import type { PaymentRepository } from "../domain/payment-repository.js";

type PaymentRow = {
  id: string;
  telegram_user_id: string;
  telegram_chat_id: string;
  status: PaymentStatus;
  product_type: PaymentProductType;
  amount_cents: number;
  game_id: string | null;
  game_title: string | null;
  game_telegram_group_id: string | null;
  checkout_url: string | null;
  qr_code: string | null;
  created_at: Date;
  confirmed_at: Date | null;
};

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly pool: Pool) {}

  async create(payment: Payment): Promise<void> {
    await this.save(payment);
  }

  async findById(paymentId: string): Promise<Payment | null> {
    const result = await this.pool.query<PaymentRow>(
      `
        select *
        from payments
        where id = $1
        limit 1
      `,
      [paymentId]
    );

    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async findLatestPendingByTelegramUserId(telegramUserId: number): Promise<Payment | null> {
    const result = await this.pool.query<PaymentRow>(
      `
        select *
        from payments
        where telegram_user_id = $1
          and status = 'pending'
          and game_id is null
          and product_type = 'vip'
        order by created_at desc
        limit 1
      `,
      [telegramUserId]
    );

    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async findLatestPendingByTelegramUserIdAndGameId(telegramUserId: number, gameId: string): Promise<Payment | null> {
    const result = await this.pool.query<PaymentRow>(
      `
        select *
        from payments
        where telegram_user_id = $1
          and game_id = $2
          and status = 'pending'
        order by created_at desc
        limit 1
      `,
      [telegramUserId, gameId]
    );

    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async save(payment: Payment): Promise<void> {
    await this.pool.query(
      `
        insert into payments (
          id,
          telegram_user_id,
          telegram_chat_id,
          status,
          product_type,
          amount_cents,
          game_id,
          game_title,
          game_telegram_group_id,
          checkout_url,
          qr_code,
          created_at,
          confirmed_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        on conflict (id) do update set
          telegram_user_id = excluded.telegram_user_id,
          telegram_chat_id = excluded.telegram_chat_id,
          status = excluded.status,
          product_type = excluded.product_type,
          amount_cents = excluded.amount_cents,
          game_id = excluded.game_id,
          game_title = excluded.game_title,
          game_telegram_group_id = excluded.game_telegram_group_id,
          checkout_url = excluded.checkout_url,
          qr_code = excluded.qr_code,
          created_at = excluded.created_at,
          confirmed_at = excluded.confirmed_at
      `,
      [
        payment.id,
        payment.telegramUserId,
        payment.telegramChatId,
        payment.status,
        payment.productType,
        payment.amountCents,
        payment.gameId ?? null,
        payment.gameTitle ?? null,
        payment.gameTelegramGroupId ?? null,
        payment.checkoutUrl ?? null,
        payment.qrCode ?? null,
        payment.createdAt,
        payment.confirmedAt ?? null
      ]
    );
  }
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    telegramChatId: Number(row.telegram_chat_id),
    status: row.status,
    productType: row.product_type,
    amountCents: row.amount_cents,
    gameId: row.game_id ?? undefined,
    gameTitle: row.game_title ?? undefined,
    gameTelegramGroupId: row.game_telegram_group_id ? Number(row.game_telegram_group_id) : undefined,
    checkoutUrl: row.checkout_url ?? undefined,
    qrCode: row.qr_code ?? undefined,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined
  };
}
