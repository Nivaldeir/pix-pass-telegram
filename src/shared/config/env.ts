import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN e obrigatorio"),
  TELEGRAM_GROUP_ID: z.coerce.number().int(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),
  PAYMENT_AMOUNT_CENTS: z.coerce.number().int().positive().default(1990),
  MONKEYPAY_API_BASE_URL: z.string().url().default("https://api.monkeypay.app"),
  MONKEYPAY_CLIENT_ID: z.string().optional(),
  MONKEYPAY_CLIENT_SECRET: z.string().optional(),
  MONKEYPAY_WALLET_ID: z.string().optional(),
  MONKEYPAY_CUSTOMER_ID: z.string().optional(),
  MONKEYPAY_PAYER_DOCUMENT: z.string().optional(),
  MONKEYPAY_PAYER_NAME: z.string().optional(),
  MONKEYPAY_PAYER_EMAIL: z.string().optional(),
  MONKEYPAY_WEBHOOK_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  RENEWAL_REMINDER_DAYS_BEFORE: z.coerce.number().int().positive().default(3)
});

export const env = envSchema.parse({
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_GROUP_ID: process.env.TELEGRAM_GROUP_ID,
  APP_BASE_URL: process.env.APP_BASE_URL || undefined,
  PORT: process.env.PORT || undefined,
  PAYMENT_AMOUNT_CENTS: process.env.PAYMENT_AMOUNT_CENTS || undefined,
  MONKEYPAY_API_BASE_URL: process.env.MONKEYPAY_API_BASE_URL || undefined,
  MONKEYPAY_CLIENT_ID: process.env.MONKEYPAY_CLIENT_ID || undefined,
  MONKEYPAY_CLIENT_SECRET: process.env.MONKEYPAY_CLIENT_SECRET || undefined,
  MONKEYPAY_WALLET_ID: process.env.MONKEYPAY_WALLET_ID || undefined,
  MONKEYPAY_CUSTOMER_ID: process.env.MONKEYPAY_CUSTOMER_ID || undefined,
  MONKEYPAY_PAYER_DOCUMENT: process.env.MONKEYPAY_PAYER_DOCUMENT || undefined,
  MONKEYPAY_PAYER_NAME: process.env.MONKEYPAY_PAYER_NAME || undefined,
  MONKEYPAY_PAYER_EMAIL: process.env.MONKEYPAY_PAYER_EMAIL || undefined,
  MONKEYPAY_WEBHOOK_SECRET: process.env.MONKEYPAY_WEBHOOK_SECRET || undefined,
  REDIS_URL: process.env.REDIS_URL || undefined,
  RENEWAL_REMINDER_DAYS_BEFORE: process.env.RENEWAL_REMINDER_DAYS_BEFORE || undefined
});
