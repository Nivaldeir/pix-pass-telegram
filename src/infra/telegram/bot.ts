import { Markup, Telegraf } from "telegraf";
import { env } from "../../shared/config/env.js";
import type { ListGames } from "../../modules/games/application/list-games.js";
import type { Game } from "../../modules/games/domain/game.js";
import type { CreatePayment } from "../../modules/payments/application/create-payment.js";
import type { GetSubscriptionStatus } from "../../modules/subscriptions/application/get-subscription-status.js";
import { replyReplacingPrevious, trackIncomingMessage } from "./chat-message-cleanup.js";
import type { Context } from "telegraf";

type Dependencies = {
  createPayment: CreatePayment;
  getSubscriptionStatus: GetSubscriptionStatus;
  listGames: ListGames;
};

export function createTelegramBot(dependencies: Dependencies): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    if (isGroupUpdate(ctx)) {
      console.log("Update de grupo ignorado.", {
        chatId: getChatId(ctx),
        chatType: getChatType(ctx),
        updateType: ctx.updateType
      });

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery("Me chama no privado para continuar.");
      }

      await deleteCallbackMessage(ctx);
      return;
    }

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

    await sendPurchaseOptions(ctx);
  });

  bot.command("jogos", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await sendGames(ctx, dependencies);
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

    await ctx.answerCbQuery();
    await sendPurchaseOptions(ctx);
  });

  bot.action("games", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await ctx.answerCbQuery("Buscando jogos...");
    await sendGames(ctx, dependencies);
  });

  bot.action("vip", async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    await ctx.answerCbQuery("Gerando pagamento VIP...");
    await sendCheckout(ctx, dependencies, { productType: "vip" });
  });

  bot.action(/^game:(.+)$/, async (ctx) => {
    if (!(await ensurePrivateChat(ctx))) {
      return;
    }

    const gameId = ctx.match[1];

    await ctx.answerCbQuery("Gerando pagamento...");
    await sendCheckout(ctx, dependencies, { productType: "game", gameId });
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
  if (!isPrivateChat(ctx)) {
    return;
  }

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

async function sendGames(ctx: Context, dependencies: Dependencies): Promise<void> {
  if (!isPrivateChat(ctx)) {
    return;
  }

  const games = await dependencies.listGames.active();

  if (games.length === 0) {
    await replyReplacingPrevious(ctx, "Nenhum jogo disponivel no momento.", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Inicio", "start_chat")],
        [Markup.button.callback("Ver jogos", "games")],
        [Markup.button.callback("Assinar VIP", "vip")],
        [Markup.button.callback("Ver assinatura VIP", "subscription")],
        [Markup.button.callback("Ajuda", "help")]
      ])
    });
    return;
  }

  await replyReplacingPrevious(ctx, getGamesMessage(games), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      ...games.map((game) => [Markup.button.callback(game.title, `game:${game.id}`)]),
      [Markup.button.callback("Assinar VIP", "vip")],
      [Markup.button.callback("Inicio", "start_chat")],
      [Markup.button.callback("Ver assinatura VIP", "subscription"), Markup.button.callback("Ajuda", "help")]
    ])
  });
}

async function sendPurchaseOptions(ctx: Context): Promise<void> {
  await replyReplacingPrevious(ctx, "<b>O que voce quer comprar?</b>", {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Ver jogos", "games")],
      [Markup.button.callback("Assinar VIP", "vip")],
      [Markup.button.callback("Inicio", "start_chat")],
      [Markup.button.callback("Ver assinatura VIP", "subscription"), Markup.button.callback("Ajuda", "help")]
    ])
  });
}

type CheckoutOptions = {
  productType: "vip" | "game";
  gameId?: string;
};

async function sendCheckout(ctx: Context, dependencies: Dependencies, options: CheckoutOptions): Promise<void> {
  if (!isPrivateChat(ctx)) {
    return;
  }

  if (!ctx.from || !ctx.chat) {
    await replyReplacingPrevious(ctx, "Nao consegui identificar esta conversa. Tente novamente pelo chat do bot.");
    return;
  }

  const game = options.gameId
    ? (await dependencies.listGames.active()).find((activeGame) => activeGame.id === options.gameId)
    : undefined;

  if (options.gameId && !game) {
    await replyReplacingPrevious(ctx, "Este jogo nao esta mais disponivel.", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Ver jogos", "games")],
        [Markup.button.callback("Inicio", "start_chat")]
      ])
    });
    return;
  }

  const amountCents = game?.amountCents ?? env.PAYMENT_AMOUNT_CENTS;
  const checkout = await dependencies.createPayment.execute({
    telegramUserId: ctx.from.id,
    telegramChatId: ctx.chat.id,
    amountCents,
    productType: options.productType,
    gameId: game?.id,
    gameTitle: game?.title,
    gameTelegramGroupId: game?.telegramGroupId || undefined
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
      ...(game
        ? [`Jogo avulso: <b>${escapeHtml(game.title)}</b>`, ""]
        : ["Plano: <b>VIP mensal</b>", ""]),
      `Valor: <b>${formatMoney(amountCents)}</b>`,
      "",
      ...paymentInstructions,
      "",
      options.productType === "vip"
        ? "Depois da confirmacao, eu libero seu acesso VIP por 30 dias automaticamente."
        : "Depois da confirmacao, eu envio o link de acesso para assistir este jogo."
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...getCheckoutMenu(checkout)
    }
  );
}

async function sendSubscriptionStatus(ctx: Context, dependencies: Dependencies): Promise<void> {
  if (!isPrivateChat(ctx)) {
    return;
  }

  if (!ctx.from) {
    await replyReplacingPrevious(ctx, "Nao consegui identificar seu usuario. Tente novamente pelo chat do bot.");
    return;
  }

  const status = await dependencies.getSubscriptionStatus.execute(ctx.from.id);

  if (!status.subscription) {
    await replyReplacingPrevious(ctx, "Voce ainda nao tem uma assinatura ativa.", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Assinar VIP", "vip")],
        [Markup.button.callback("Ver jogos", "games")],
        [Markup.button.callback("Inicio", "start_chat")],
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
      [Markup.button.callback(status.isActive ? "Renovar VIP" : "Assinar VIP", "vip")],
      [Markup.button.callback("Ver jogos", "games")],
      [Markup.button.callback("Inicio", "start_chat")],
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

function getGamesMessage(games: Game[]): string {
  return [
    "<b>Jogos disponiveis</b>",
    "",
    ...games.map((game) => {
      const startsAt = game.startsAt ? ` - ${formatDate(game.startsAt)}` : "";

      return `${escapeHtml(game.title)}${startsAt}\nValor: <b>${formatMoney(game.amountCents)}</b>`;
    }),
    "",
    "Escolha o jogo para gerar o pagamento."
  ].join("\n\n");
}

function isCommandMessage(ctx: Context): boolean {
  const message = ctx.message;

  return !!message && "text" in message && typeof message.text === "string" && message.text.startsWith("/");
}

function isPrivateChat(ctx: Context): boolean {
  return getChatType(ctx) === "private";
}

function isGroupUpdate(ctx: Context): boolean {
  const chatType = getChatType(ctx);

  return chatType === "group" || chatType === "supergroup" || chatType === "channel";
}

function getChatType(ctx: Context): string | undefined {
  if (ctx.chat?.type) {
    return ctx.chat.type;
  }

  const callbackQuery = ctx.callbackQuery;

  if (callbackQuery && "message" in callbackQuery && callbackQuery.message?.chat.type) {
    return callbackQuery.message.chat.type;
  }

  return undefined;
}

function getChatId(ctx: Context): number | undefined {
  if (ctx.chat?.id) {
    return ctx.chat.id;
  }

  const callbackQuery = ctx.callbackQuery;

  if (callbackQuery && "message" in callbackQuery && callbackQuery.message?.chat.id) {
    return callbackQuery.message.chat.id;
  }

  return undefined;
}

async function deleteCallbackMessage(ctx: Context): Promise<void> {
  const callbackQuery = ctx.callbackQuery;

  if (!callbackQuery || !("message" in callbackQuery) || !callbackQuery.message) {
    return;
  }

  try {
    await ctx.telegram.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
  } catch {
    // The message may be too old or already deleted.
  }
}

async function ensurePrivateChat(ctx: Context): Promise<boolean> {
  if (isPrivateChat(ctx)) {
    return true;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("Me chama no privado para continuar.");
  }

  return false;
}

function getMainMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Ver jogos", "games")],
    [Markup.button.callback("Assinar VIP", "vip")],
    [Markup.button.callback("Inicio", "start_chat")],
    [Markup.button.callback("Ver assinatura VIP", "subscription"), Markup.button.callback("Ajuda", "help")]
  ]);
}

function getCheckoutMenu(checkout: { checkoutUrl: string; qrCode?: string }): Parameters<Context["reply"]>[1] {
  const navigationButtons = [
    { text: "Inicio", callback_data: "start_chat" },
    { text: "Ver jogos", callback_data: "games" },
    { text: "VIP", callback_data: "vip" },
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

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amountCents / 100);
}
