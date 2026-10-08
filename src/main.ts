import { ConfirmPaymentAndGrantAccess } from "./modules/access/application/confirm-payment-and-grant-access.js";
import { TelegramGroupAccessService } from "./modules/access/infra/telegram-group-access-service.js";
import { postgresPool, setupPostgres } from "./infra/database/postgres.js";
import { GramjsGameChannelProvisioner } from "./modules/games/infra/gramjs-game-channel-provisioner.js";
import { DeleteGame } from "./modules/games/application/delete-game.js";
import { DeleteExpiredGameGroups } from "./modules/games/application/delete-expired-game-groups.js";
import { CreateGame } from "./modules/games/application/create-game.js";
import { ListGames } from "./modules/games/application/list-games.js";
import { PostgresGameRepository } from "./modules/games/infra/postgres-game-repository.js";
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
import { AdminQueries } from "./infra/http/admin/admin-queries.js";
import { createHttpServer } from "./infra/http/server.js";
import { startSubscriptionJobs } from "./infra/queue/subscription-jobs.js";
import { createTelegramBot } from "./infra/telegram/bot.js";
import { env } from "./shared/config/env.js";

async function main(): Promise<void> {
  await setupPostgres();

  const gameRepository = new PostgresGameRepository(postgresPool);
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
  const listGames = new ListGames(gameRepository);
  const activateMonthlySubscription = new ActivateMonthlySubscription(subscriptionRepository);
  const getSubscriptionStatus = new GetSubscriptionStatus(subscriptionRepository);

  const bot = createTelegramBot({ createPayment, getSubscriptionStatus, listGames });
  const groupAccess = new TelegramGroupAccessService(bot, env.TELEGRAM_GROUP_ID);
  const confirmPaymentAndGrantAccess = new ConfirmPaymentAndGrantAccess(
    paymentRepository,
    activateMonthlySubscription,
    groupAccess
  );
  const expireSubscriptions = new ExpireSubscriptions(subscriptionRepository, groupAccess);
  const renewalNotifications = new TelegramRenewalNotificationService(bot);
  const sendRenewalReminders = new SendRenewalReminders(
    subscriptionRepository,
    createPayment,
    renewalNotifications
  );

  const me = await bot.telegram.getMe();
  const provisioner = env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH && env.TELEGRAM_USER_SESSION && me.username
    ? new GramjsGameChannelProvisioner({
      apiId: env.TELEGRAM_API_ID,
      apiHash: env.TELEGRAM_API_HASH,
      session: env.TELEGRAM_USER_SESSION,
      botUsername: me.username
    })
    : undefined;
  const createGame = new CreateGame(gameRepository, provisioner);
  const server = createHttpServer({
    bot,
    confirmPaymentAndGrantAccess,
    createGame,
    deleteGame: new DeleteGame(gameRepository, provisioner),
    listGames,
    adminQueries: new AdminQueries(postgresPool)
  });

  server.listen(env.PORT, () => {
    console.log(`HTTP ouvindo em ${env.APP_BASE_URL}`);
    console.log(`Bot @${me.username} iniciado em modo polling.`);
  });

  const deleteExpiredGameGroups = provisioner ? new DeleteExpiredGameGroups(gameRepository, provisioner) : undefined;
  const groupCleanupTimer = deleteExpiredGameGroups
    ? setInterval(() => void deleteExpiredGameGroups.execute().catch((error) => console.error("Erro na limpeza de grupos:", error)), 60_000)
    : undefined;

  await bot.launch();
  const closeSubscriptionJobs = await startSubscriptionJobs({ sendRenewalReminders, expireSubscriptions });

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  function shutdown(signal: string): void {
    bot.stop(signal);
    if (groupCleanupTimer) {
      clearInterval(groupCleanupTimer);
    }
    server.close();
    void closeSubscriptionJobs();
    void postgresPool.end();
  }
}

main().catch((error) => {
  console.error("Falha ao iniciar aplicacao:", error);
  process.exitCode = 1;
});
