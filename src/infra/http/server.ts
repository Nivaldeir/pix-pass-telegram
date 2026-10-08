import http from "node:http";
import type { Telegraf } from "telegraf";
import type { ConfirmPaymentAndGrantAccess } from "../../modules/access/application/confirm-payment-and-grant-access.js";
import type { CreateGame } from "../../modules/games/application/create-game.js";
import type { ListGames } from "../../modules/games/application/list-games.js";
import { timingSafeEqual } from "node:crypto";
import type { DeleteGame } from "../../modules/games/application/delete-game.js";
import type { AdminQueries } from "./admin/admin-queries.js";
import { renderGames, renderInvite, renderPayments, renderUsers } from "./admin/admin-pages.js";
import { env } from "../../shared/config/env.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { sendMessageReplacingPrevious } from "../telegram/chat-message-cleanup.js";

type Dependencies = {
  bot: Telegraf;
  confirmPaymentAndGrantAccess: ConfirmPaymentAndGrantAccess;
  createGame: CreateGame;
  listGames: ListGames;
  adminQueries: AdminQueries;
  deleteGame: DeleteGame;
};

export function createHttpServer(dependencies: Dependencies): http.Server {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (url.pathname === "/" || url.pathname.startsWith("/admin")) {
        if (!isAdminAuthorized(request)) {
          response.writeHead(401, { "www-authenticate": 'Basic realm="Painel"' });
          response.end("Autenticacao necessaria.");
          return;
        }
      }

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/admin" || url.pathname === "/admin/jogos")) {
        sendHtml(response, renderGames(await dependencies.listGames.all(), await dependencies.adminQueries.stats()));
        return;
      }

      if (request.method === "GET" && url.pathname === "/admin/pagamentos") {
        sendHtml(response, renderPayments(await dependencies.adminQueries.payments(), await dependencies.adminQueries.stats()));
        return;
      }

      if (request.method === "GET" && url.pathname === "/admin/usuarios") {
        const users = await dependencies.adminQueries.users();
        const named = await Promise.all(users.map(async (user) => {
          try {
            const chat = await dependencies.bot.telegram.getChat(user.telegramUserId);
            const name = "first_name" in chat
              ? [chat.first_name, "last_name" in chat ? chat.last_name : undefined].filter(Boolean).join(" ")
              : undefined;
            const username = "username" in chat && chat.username ? ` (@${chat.username})` : "";

            return { ...user, name: name ? name + username : undefined };
          } catch {
            return user;
          }
        }));

        sendHtml(response, renderUsers(named, await dependencies.adminQueries.stats()));
        return;
      }

      if (request.method === "POST" && url.pathname === "/admin/jogos") {
        const form = await readFormBody(request);
        const title = form.get("title")?.toString() ?? "";
        const amountCents = parseMoneyToCents(form.get("amount")?.toString() ?? "");
        const rawGroupId = form.get("telegramGroupId")?.toString() ?? "";
        const telegramGroupId = rawGroupId.trim() ? parseTelegramGroupId(rawGroupId) : undefined;
        const startsAt = parseOptionalDate(form.get("startsAt")?.toString() ?? "");
        const deleteAt = parseOptionalDate(form.get("deleteAt")?.toString() ?? "");
        const homeLogoUrl = parseOptionalHttpUrl(form.get("homeLogoUrl")?.toString() ?? "");
        const awayLogoUrl = parseOptionalHttpUrl(form.get("awayLogoUrl")?.toString() ?? "");

        await dependencies.createGame.execute({ title, amountCents, telegramGroupId, startsAt, homeLogoUrl, awayLogoUrl, deleteAt });
        redirect(response, "/admin/jogos");
        return;
      }

      if (request.method === "POST" && /^\/admin\/jogos\/[^/]+\/excluir$/.test(url.pathname)) {
        await dependencies.deleteGame.execute(url.pathname.split("/")[3] ?? "");
        redirect(response, "/admin/jogos");
        return;
      }

      if (request.method === "POST" && /^\/admin\/jogos\/[^/]+\/convite$/.test(url.pathname)) {
        const gameId = url.pathname.split("/")[3];
        const game = (await dependencies.listGames.all()).find((item) => item.id === gameId);

        if (!game || !game.telegramGroupId) {
          throw new ApplicationError("Jogo ou grupo nao encontrado.", 404);
        }

        const invite = await dependencies.bot.telegram.createChatInviteLink(game.telegramGroupId, {
          name: "Amigos",
          expire_date: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        });

        sendHtml(response, renderInvite(game, invite.invite_link));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/payments/simulate/")) {
        const paymentId = url.pathname.split("/").at(-1);

        if (!paymentId) {
          sendText(response, 400, "Pagamento invalido.");
          return;
        }

        sendHtml(
          response,
          [
            "<h1>Pagamento simulado</h1>",
            `<p>Pagamento <strong>${paymentId}</strong> pronto para confirmacao.</p>`,
            `<form method="POST" action="/webhooks/payments/${paymentId}/confirm">`,
            "<button type=\"submit\">Confirmar pagamento</button>",
            "</form>"
          ].join("")
        );
        return;
      }

      if (request.method === "POST" && url.pathname.startsWith("/webhooks/payments/")) {
        const [, , , paymentId, action] = url.pathname.split("/");

        if (!paymentId || action !== "confirm") {
          sendText(response, 404, "Webhook nao encontrado.");
          return;
        }

        const access = await dependencies.confirmPaymentAndGrantAccess.execute(paymentId);

        if (access.alreadyConfirmed) {
          sendText(response, 200, "Pagamento ja confirmado.");
          return;
        }

        await sendPaymentConfirmedMessage(
          dependencies.bot,
          access.telegramChatId,
          access.inviteLink,
          access.expiresAt,
          access.productType,
          access.gameTitle
        );

        sendText(
          response,
          200,
          getPaymentConfirmedText(access)
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/webhooks/monkeypay") {
        if (!isAuthorizedMonkeyPayWebhook(request)) {
          sendText(response, 401, "Webhook nao autorizado.");
          return;
        }

        const payload = await readJsonBody(request);
        const paymentId = getStringFromPaths(payload, [
          ["externalId"],
          ["external_id"],
          ["data", "externalId"],
          ["data", "external_id"],
          ["data", "payload", "externalId"],
          ["data", "payload", "external_id"],
          ["payload", "externalId"],
          ["payload", "external_id"],
          ["payment", "externalId"],
          ["payment", "external_id"]
        ]);

        if (!paymentId) {
          sendText(response, 400, "externalId nao encontrado no webhook.");
          return;
        }

        const status = getStringFromPaths(payload, [
          ["status"],
          ["event"],
          ["type"],
          ["data", "status"],
          ["data", "event"],
          ["data", "type"],
          ["data", "payload", "status"],
          ["payload", "status"],
          ["payment", "status"]
        ]);

        if (status && !isPaidStatus(status)) {
          sendText(response, 202, `Webhook recebido sem confirmacao de pagamento: ${status}.`);
          return;
        }

        const access = await dependencies.confirmPaymentAndGrantAccess.execute(paymentId);

        if (!access.alreadyConfirmed) {
          await sendPaymentConfirmedMessage(
            dependencies.bot,
            access.telegramChatId,
            access.inviteLink,
            access.expiresAt,
            access.productType,
            access.gameTitle
          );
        }

        sendText(response, 200, access.alreadyConfirmed ? "Pagamento ja confirmado." : "Pagamento confirmado.");
        return;
      }

      sendText(response, 404, "Rota nao encontrada.");
    } catch (error) {
      console.error("Erro HTTP:", error);
      if (error instanceof ApplicationError) {
        sendText(response, error.statusCode, error.message);
        return;
      }

      sendText(response, 500, "Erro interno.");
    }
  });
}

function isAdminAuthorized(request: http.IncomingMessage): boolean {
  if (!env.ADMIN_PASSWORD) {
    return true;
  }

  const header = request.headers.authorization ?? "";
  const received = Buffer.from(header.replace(/^Basic /, ""), "base64");
  const expected = Buffer.from(`${env.ADMIN_USER}:${env.ADMIN_PASSWORD}`);

  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseOptionalHttpUrl(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ApplicationError("URL do logo invalida.", 400);
  }

  return trimmed;
}

function isAuthorizedMonkeyPayWebhook(request: http.IncomingMessage): boolean {
  if (!env.MONKEYPAY_WEBHOOK_SECRET) {
    return true;
  }

  const receivedSecret = request.headers["x-webhook-secret"] ?? request.headers["x-monkeypay-webhook-secret"];

  return receivedSecret === env.MONKEYPAY_WEBHOOK_SECRET;
}

async function readFormBody(request: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApplicationError("JSON invalido.", 400);
  }
}

function getStringFromPaths(payload: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = getPath(payload, path);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getPath(payload: unknown, path: string[]): unknown {
  let current = payload;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function isPaidStatus(status: string): boolean {
  return ["paid", "confirmed", "approved", "completed", "settled", "success", "payment.paid", "pix.paid"]
    .includes(status.toLowerCase());
}

async function sendPaymentConfirmedMessage(
  bot: Telegraf,
  telegramChatId: number,
  inviteLink: string,
  expiresAt?: Date,
  productType: "vip" | "game" = "vip",
  gameTitle?: string
): Promise<void> {
  const lines = productType === "vip"
    ? [
      "<b>Pagamento VIP confirmado.</b>",
      "",
      "Seu acesso VIP esta liberado.",
      `Assinatura valida ate <b>${expiresAt?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.`,
      "",
      "Toque no botao abaixo para entrar."
    ]
    : [
      "<b>Pagamento do jogo confirmado.</b>",
      "",
      gameTitle ? `Jogo: <b>${escapeHtml(gameTitle)}</b>` : "Seu acesso ao jogo esta liberado.",
      "",
      "Toque no botao abaixo para entrar."
    ];

  await sendMessageReplacingPrevious(
    bot,
    telegramChatId,
    lines.join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Entrar no grupo", url: inviteLink }]]
      }
    }
  );
}

function getPaymentConfirmedText(access: {
  inviteLink: string;
  productType: "vip" | "game";
  gameTitle?: string;
  expiresAt?: Date;
}): string {
  if (access.productType === "game") {
    return [
      "Pagamento do jogo confirmado.",
      access.gameTitle ? `Jogo: ${access.gameTitle}` : null,
      `Link do grupo: ${access.inviteLink}`
    ].filter(Boolean).join("\n");
  }

  return [
    "Pagamento VIP confirmado.",
    `Link do grupo: ${access.inviteLink}`,
    access.expiresAt
      ? `Assinatura valida ate: ${access.expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
      : null
  ].filter(Boolean).join("\n");
}

function sendText(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function sendHtml(response: http.ServerResponse, body: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  const document = body.trimStart().startsWith("<head")
    ? body
    : `<body>${body}</body>`;

  response.end(`<!doctype html><html lang="pt-BR">${document}</html>`);
}

function redirect(response: http.ServerResponse, location: string): void {
  response.writeHead(303, { location });
  response.end();
}

function parseMoneyToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApplicationError("Valor invalido.", 400);
  }

  return Math.round(amount * 100);
}

function parseTelegramGroupId(value: string): number {
  const groupId = Number(value.trim());

  if (!Number.isInteger(groupId)) {
    throw new ApplicationError("ID do grupo invalido.", 400);
  }

  return groupId;
}

function parseOptionalDate(value: string): Date | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApplicationError("Data invalida.", 400);
  }

  return date;
}

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amountCents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
