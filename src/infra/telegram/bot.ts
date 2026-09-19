import { Markup, Telegraf } from "telegraf";
import { env } from "../../shared/config/env.js";
import type { CreatePayment } from "../../modules/payments/application/create-payment.js";
import type { GetSubscriptionStatus } from "../../modules/subscriptions/application/get-subscription-status.js";
import { replyReplacingPrevious, trackIncomingMessage } from "./chat-message-cleanup.js";
import type { Context } from "telegraf";

type Dependencies = {
  createPayment: CreatePayment;
  getSubscriptionStatus: GetSubscriptionStatus;
};

export function createTelegramBot(dependencies: Dependencies): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    await trackIncomingMessage(ctx);
    await next();
  });

  bot.start(async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await sendEntryMessage(ctx, dependencies);
  });

  bot.command("help", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await replyReplacingPrevious(ctx, getHelpMessage(), {
      parse_mode: "HTML",
      ...getMainMenu()
    });
  });

  bot.command("comprar", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await sendCheckout(ctx, dependencies);
  });

  bot.command("assinatura", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await sendSubscriptionStatus(ctx, dependencies);
  });

  bot.action("buy", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await ctx.answerCbQuery("Gerando pagamento...");
    await sendCheckout(ctx, dependencies);
  });

  bot.action("subscription", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await ctx.answerCbQuery("Consultando assinatura...");
    await sendSubscriptionStatus(ctx, dependencies);
  });

  bot.action("help", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await ctx.answerCbQuery();

    await replyReplacingPrevious(ctx, getHelpMessage(), {
      parse_mode: "HTML",
      ...getMainMenu()
    });
  });

  bot.action("start_chat", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await ctx.answerCbQuery();

    await replyReplacingPrevious(ctx, getHelpMessage(), {
      parse_mode: "HTML",
      ...getMainMenu()
    });
  });

  bot.on("message", async (ctx) => {
    if (!isPrivateChat(ctx)) {
      return;
    }

    if (isCommandMessage(ctx)) {
      return;
    }

    await sendEntryMessage(ctx, dependencies);
  });

  bot.catch((error) => {
    console.error("Erro no bot:", error);
  });

  return bot;
}

async function sendEntryMessage(ctx: Context, dependencies: Dependencies): Promise<void> {
  if (!ctx.from) {
    await replyReplacingPrevious(ctx, getHelpMessage(), {
      parse_mode: "HTML",
      ...getMainMenu()
    });
    return;
  }

  const status = await dependencies.getSubscriptionStatus.execute(ctx.from.id);

  if (!status.isActive) {
    await replyReplacingPrevious(ctx, getHelpMessage(), {
      parse_mode: "HTML",
      ...getMainMenu()
    });
    return;
  }

  await replyReplacingPrevious(ctx, getHelpMessage(), {
    parse_mode: "HTML",
    ...getMainMenu()
  });
}

async function sendCheckout(ctx: Context, dependencies: Dependencies): Promise<void> {
  if (!ctx.from || !ctx.chat) {
    await replyReplacingPrevious(ctx, "Nao consegui identificar esta conversa. Tente novamente pelo chat do bot.");
    return;
  }

  const checkout = await dependencies.createPayment.execute({
    telegramUserId: ctx.from.id,
    telegramChatId: ctx.chat.id,
    amountCents: env.PAYMENT_AMOUNT_CENTS
  });
  const canUseUrlButton = isPublicHttpUrl(checkout.checkoutUrl);
  const paymentInstructions = checkout.qrCode
    ? ["Use o Pix copia e cola abaixo:", "", `<code>${escapeHtml(checkout.qrCode)}</code>`]
    : [
      canUseUrlButton
        ? "Toque no botao abaixo para abrir o pagamento simulado."
        : `Link simulado: ${checkout.checkoutUrl}`
    ];

  await replyReplacingPrevious(
    ctx,
    [
      "<b>Pagamento gerado com sucesso.</b>",
      "",
      `Valor: <b>R$ ${(env.PAYMENT_AMOUNT_CENTS / 100).toFixed(2)}</b>`,
      "",
      ...paymentInstructions,
      "",
      "Depois da confirmacao, eu libero seu acesso ao grupo automaticamente."
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...getCheckoutMenu(checkout)
    }
  );
}

async function sendSubscriptionStatus(ctx: Context, dependencies: Dependencies): Promise<void> {
  if (!ctx.from) {
    await replyReplacingPrevious(ctx, "Nao consegui identificar seu usuario. Tente novamente pelo chat do bot.");
    return;
  }

  const status = await dependencies.getSubscriptionStatus.execute(ctx.from.id);

  if (!status.subscription) {
    await replyReplacingPrevious(ctx, "Voce ainda nao tem uma assinatura ativa.", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Assinar agora", "buy")],
        [Markup.button.callback("Ajuda", "help")]
      ])
    });
    return;
  }

  const expiresAt = formatDate(status.subscription.expiresAt);
  const message = status.isActive
    ? `<b>Sua assinatura esta ativa.</b>\n\nAcesso liberado ate <b>${expiresAt}</b>.`
    : `<b>Sua assinatura expirou.</b>\n\nEla venceu em <b>${expiresAt}</b>. Voce pode renovar quando quiser.`;

  await replyReplacingPrevious(ctx, message, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback(status.isActive ? "Renovar assinatura" : "Renovar agora", "buy")],
      [Markup.button.callback("Ajuda", "help")]
    ])
  });
}

function getHelpMessage(): string {
  return [
    "<b>Central da transmissao ao vivo</b>",
    "",
    "Escolha uma opcao abaixo:"
  ].join("\n");
}

function isCommandMessage(ctx: Context): boolean {
  const message = ctx.message;

  return !!message && "text" in message && typeof message.text === "string" && message.text.startsWith("/");
}

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

async function ensurePrivateChat(ctx: Context): Promise<boolean> {
  if (isPrivateChat(ctx)) {
    return true;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("Me chama no privado para continuar.");
    return false;
  }

  await ctx.reply("Me chama no privado para comprar ou consultar sua assinatura.");
  return false;
}

function getMainMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Assinar agora", "buy")],
    [Markup.button.callback("Ver assinatura", "subscription"), Markup.button.callback("Ajuda", "help")]
  ]);
}

function getCheckoutMenu(checkout: { checkoutUrl: string; qrCode?: string }): Parameters<Context["reply"]>[1] {
  const navigationButtons = [
    { text: "Ver assinatura", callback_data: "subscription" },
    { text: "Ajuda", callback_data: "help" }
  ];

  if (checkout.qrCode) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Copiar Pix", copy_text: { text: checkout.qrCode } }],
          navigationButtons
        ]
      }
    } as unknown as Parameters<Context["reply"]>[1];
  }

  if (!isPublicHttpUrl(checkout.checkoutUrl)) {
    return {
      reply_markup: {
        inline_keyboard: [navigationButtons]
      }
    };
  }

  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Abrir pagamento", url: checkout.checkoutUrl }],
        navigationButtons
      ]
    }
  };
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}
