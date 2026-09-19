import http from "node:http";
import type { Telegraf } from "telegraf";
import type { ConfirmPaymentAndGrantAccess } from "../../modules/access/application/confirm-payment-and-grant-access.js";
import { env } from "../../shared/config/env.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { sendMessageReplacingPrevious } from "../telegram/chat-message-cleanup.js";

type Dependencies = {
  bot: Telegraf;
  confirmPaymentAndGrantAccess: ConfirmPaymentAndGrantAccess;
};

export function createHttpServer(dependencies: Dependencies): http.Server {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");

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

        await sendPaymentConfirmedMessage(dependencies.bot, access.telegramChatId, access.inviteLink, access.expiresAt);

        sendText(
          response,
          200,
          [
            "Pagamento confirmado.",
            `Link do grupo: ${access.inviteLink}`,
            `Assinatura valida ate: ${access.expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
          ].join("\n")
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
          await sendPaymentConfirmedMessage(dependencies.bot, access.telegramChatId, access.inviteLink, access.expiresAt);
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

function isAuthorizedMonkeyPayWebhook(request: http.IncomingMessage): boolean {
  if (!env.MONKEYPAY_WEBHOOK_SECRET) {
    return true;
  }

  const receivedSecret = request.headers["x-webhook-secret"] ?? request.headers["x-monkeypay-webhook-secret"];

  return receivedSecret === env.MONKEYPAY_WEBHOOK_SECRET;
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
  expiresAt: Date
): Promise<void> {
  await sendMessageReplacingPrevious(
    bot,
    telegramChatId,
    [
      "<b>Pagamento confirmado.</b>",
      "",
      "Seu acesso ao grupo esta liberado.",
      `Assinatura valida ate <b>${expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</b>.`,
      "",
      "Toque no botao abaixo para entrar."
    ].join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Entrar no grupo", url: inviteLink }]]
      }
    }
  );
}

function sendText(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function sendHtml(response: http.ServerResponse, body: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="pt-BR"><body>${body}</body></html>`);
}
