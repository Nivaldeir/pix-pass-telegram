import type { Context, Telegraf } from "telegraf";

const lastBotMessageByChat = new Map<number, number>();
const trackedMessagesByChat = new Map<number, Set<number>>();
const cleanupTimersByChat = new Map<number, ReturnType<typeof setTimeout>>();
const INACTIVITY_CLEANUP_MS = 15 * 60 * 1000;

type ReplyOptions = Parameters<Context["reply"]>[1];
type SendMessageOptions = Parameters<Telegraf["telegram"]["sendMessage"]>[2];

export async function trackIncomingMessage(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.message) {
    return;
  }

  await deleteTrackedMessages(ctx.telegram, ctx.chat.id);
  rememberMessage(ctx.chat.id, ctx.message.message_id);
  scheduleInactivityCleanup(ctx.telegram, ctx.chat.id);
}

export async function replyReplacingPrevious(ctx: Context, text: string, options?: ReplyOptions): Promise<void> {
  if (!ctx.chat) {
    await ctx.reply(text, options);
    return;
  }

  await deletePreviousBotMessage(ctx.telegram, ctx.chat.id);
  const message = await ctx.reply(text, options);
  rememberBotMessage(ctx.chat.id, message.message_id);
  scheduleInactivityCleanup(ctx.telegram, ctx.chat.id);
}

export async function sendMessageReplacingPrevious(
  bot: Telegraf,
  chatId: number,
  text: string,
  options?: SendMessageOptions
): Promise<void> {
  await deletePreviousBotMessage(bot.telegram, chatId);
  const message = await bot.telegram.sendMessage(chatId, text, options);
  rememberBotMessage(chatId, message.message_id);
  scheduleInactivityCleanup(bot.telegram, chatId);
}

async function deletePreviousBotMessage(telegram: Telegraf["telegram"], chatId: number): Promise<void> {
  const previousMessageId = lastBotMessageByChat.get(chatId);

  if (!previousMessageId) {
    return;
  }

  try {
    await telegram.deleteMessage(chatId, previousMessageId);
  } catch {
    // The message may already be gone or too old to delete.
  }

  lastBotMessageByChat.delete(chatId);
  forgetMessage(chatId, previousMessageId);
}

async function deleteTrackedMessages(telegram: Telegraf["telegram"], chatId: number): Promise<void> {
  const messageIds = trackedMessagesByChat.get(chatId);

  if (!messageIds) {
    return;
  }

  for (const messageId of messageIds) {
    try {
      await telegram.deleteMessage(chatId, messageId);
    } catch {
      // The message may already be gone or too old to delete.
    }
  }

  trackedMessagesByChat.delete(chatId);
  lastBotMessageByChat.delete(chatId);
}

function rememberBotMessage(chatId: number, messageId: number): void {
  lastBotMessageByChat.set(chatId, messageId);
  rememberMessage(chatId, messageId);
}

function rememberMessage(chatId: number, messageId: number): void {
  const messageIds = trackedMessagesByChat.get(chatId) ?? new Set<number>();
  messageIds.add(messageId);
  trackedMessagesByChat.set(chatId, messageIds);
}

function forgetMessage(chatId: number, messageId: number): void {
  const messageIds = trackedMessagesByChat.get(chatId);

  if (!messageIds) {
    return;
  }

  messageIds.delete(messageId);

  if (messageIds.size === 0) {
    trackedMessagesByChat.delete(chatId);
  }
}

function scheduleInactivityCleanup(telegram: Telegraf["telegram"], chatId: number): void {
  const currentTimer = cleanupTimersByChat.get(chatId);

  if (currentTimer) {
    clearTimeout(currentTimer);
  }

  const nextTimer = setTimeout(() => {
    cleanupTimersByChat.delete(chatId);
    void deleteTrackedMessages(telegram, chatId);
  }, INACTIVITY_CLEANUP_MS);

  cleanupTimersByChat.set(chatId, nextTimer);
}
