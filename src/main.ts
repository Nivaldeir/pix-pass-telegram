import { ConfirmPaymentAndGrantAccess } from "./modules/access/application/confirm-payment-and-grant-access.js";
import { TelegramGroupAccessService } from "./modules/access/infra/telegram-group-access-service.js";
import { postgresPool, setupPostgres } from "./infra/database/postgres.js";
import { CreatePayment } from "./modules/payments/application/create-payment.js";
import { MonkeyPayPaymentGateway } from "./modules/payments/infra/monkeypay-payment-gateway.js";
import { PostgresPaymentRepository } from "./modules/payments/infra/postgres-payment-repository.js";
import { SimulatedPaymentGateway } from "./modules/payments/infra/simulated-payment-gateway.js";
import { TelegramRenewalNotificationService } from "./modules/notifications/infra/telegram-renewal-notification-service.js";
import { ActivateMonthlySubscription } from "./modules/subscriptions/application/activate-monthly-subscription.js";
import { ExpireSubscriptions } from "./modules/subscriptions/application/expire-subscriptions.js";
import { GetSubscriptionStatus } from "./modules/subscriptions/application/get-subscription-status.js";
import { SendRenewalReminders } from "./modules/subscriptions/application/send-renewal-reminders.js";
import { PostgresSubscriptionRepository } from "./modules/subscriptions/infra/postgres-subscription-repository.js";
import { createHttpServer } from "./infra/http/server.js";
import { startSubscriptionJobs } from "./infra/queue/subscription-jobs.js";
import { createTelegramBot } from "./infra/telegram/bot.js";
import { env } from "./shared/config/env.js";

async function main(): Promise<void> {
  await setupPostgres();

  const paymentRepository = new PostgresPaymentRepository(postgresPool);
  const subscriptionRepository = new PostgresSubscriptionRepository(postgresPool);
  const paymentGateway = env.MONKEYPAY_CLIENT_ID && env.MONKEYPAY_CLIENT_SECRET && env.MONKEYPAY_WALLET_ID
    ? new MonkeyPayPaymentGateway({
      apiBaseUrl: env.MONKEYPAY_API_BASE_URL,
      clientId: env.MONKEYPAY_CLIENT_ID,
      clientSecret: env.MONKEYPAY_CLIENT_SECRET,
      walletId: env.MONKEYPAY_WALLET_ID,
      customerId: env.MONKEYPAY_CUSTOMER_ID,
      payerDocument: env.MONKEYPAY_PAYER_DOCUMENT,
      payerName: env.MONKEYPAY_PAYER_NAME,
      payerEmail: env.MONKEYPAY_PAYER_EMAIL
    })
    : new SimulatedPaymentGateway(env.APP_BASE_URL);
  const createPayment = new CreatePayment(paymentRepository, paymentGateway);
  const activateMonthlySubscription = new ActivateMonthlySubscription(subscriptionRepository);
  const getSubscriptionStatus = new GetSubscriptionStatus(subscriptionRepository);

  const bot = createTelegramBot({ createPayment, getSubscriptionStatus });
  const groupAccess = new TelegramGroupAccessService(bot, env.TELEGRAM_GROUP_ID);
  const confirmPaymentAndGrantAccess = new ConfirmPaymentAndGrantAccess(
    paymentRepository,
    activateMonthlySubscription,
    groupAccess
  );
  const expireSubscriptions = new ExpireSubscriptions(subscriptionRepository, groupAccess);
  const server = createHttpServer({ bot, confirmPaymentAndGrantAccess });
  const renewalNotifications = new TelegramRenewalNotificationService(bot);
  const sendRenewalReminders = new SendRenewalReminders(
    subscriptionRepository,
    createPayment,
    renewalNotifications
  );

  const me = await bot.telegram.getMe();

  server.listen(env.PORT, () => {
    console.log(`HTTP ouvindo em ${env.APP_BASE_URL}`);
    console.log(`Bot @${me.username} iniciado em modo polling.`);
  });

  await bot.launch();
  const closeSubscriptionJobs = await startSubscriptionJobs({ sendRenewalReminders, expireSubscriptions });

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  function shutdown(signal: string): void {
    bot.stop(signal);
    server.close();
    void closeSubscriptionJobs();
    void postgresPool.end();
  }
}

main().catch((error) => {
  console.error("Falha ao iniciar aplicacao:", error);
  process.exitCode = 1;
});
