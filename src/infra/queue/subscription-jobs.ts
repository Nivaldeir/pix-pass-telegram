import { Queue, Worker, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import type { ExpireSubscriptions } from "../../modules/subscriptions/application/expire-subscriptions.js";
import type { SendRenewalReminders } from "../../modules/subscriptions/application/send-renewal-reminders.js";
import { env } from "../../shared/config/env.js";

const QUEUE_NAME = "subscription-renewal";
const SEND_RENEWAL_REMINDERS = "send-renewal-reminders";
const EXPIRE_SUBSCRIPTIONS = "expire-subscriptions";

type Dependencies = {
  sendRenewalReminders: SendRenewalReminders;
  expireSubscriptions: ExpireSubscriptions;
};

export async function startSubscriptionJobs(dependencies: Dependencies): Promise<() => Promise<void>> {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });
  const queue = new Queue(QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === SEND_RENEWAL_REMINDERS) {
        const sentCount = await dependencies.sendRenewalReminders.execute({
          amountCents: env.PAYMENT_AMOUNT_CENTS,
          daysBeforeExpiration: env.RENEWAL_REMINDER_DAYS_BEFORE
        });

        if (sentCount > 0) {
          console.log(`${sentCount} lembrete(s) de renovacao enviado(s).`);
        }

        return;
      }

      if (job.name === EXPIRE_SUBSCRIPTIONS) {
        const expiredCount = await dependencies.expireSubscriptions.execute();

        if (expiredCount > 0) {
          console.log(`${expiredCount} assinatura(s) expirada(s) removida(s) do grupo.`);
        }
      }
    },
    { connection }
  );

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.name ?? "desconhecido"} falhou:`, error);
  });

  await scheduleRecurringJob(queue, SEND_RENEWAL_REMINDERS, "*/30 * * * *");
  await scheduleRecurringJob(queue, EXPIRE_SUBSCRIPTIONS, "0 * * * *");

  return async () => {
    await worker.close();
    await queue.close();
    await connection.quit();
  };
}

async function scheduleRecurringJob(queue: Queue, name: string, pattern: string): Promise<void> {
  const options: JobsOptions = {
    repeat: { pattern },
    removeOnComplete: true,
    removeOnFail: 100
  };

  await queue.add(name, {}, options);
}
