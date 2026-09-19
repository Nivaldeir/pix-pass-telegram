import { Markup, type Telegraf } from "telegraf";
import type { PaymentCheckout } from "../../payments/domain/payment-gateway.js";
import type { Subscription } from "../../subscriptions/domain/subscription.js";
import type { RenewalNotificationService } from "../domain/renewal-notification-service.js";

export class TelegramRenewalNotificationService implements RenewalNotificationService {
  constructor(private readonly bot: Telegraf) {}

  async sendRenewalReminder(subscription: Subscription, checkout: PaymentCheckout): Promise<void> {
    const expiresAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(subscription.expiresAt);

    const message = [
      "<b>Sua assinatura esta perto de vencer.</b>",
      "",
      `Ela vence em <b>${expiresAt}</b>.`,
      "Para continuar no grupo da transmissao ao vivo sem interrupcao, renove pelo botao abaixo.",
      "",
      "Assim que o pagamento for confirmado, eu atualizo sua assinatura automaticamente."
    ].join("\n");

    await this.bot.telegram.sendMessage(subscription.telegramUserId, message, {
      parse_mode: "HTML",
      ...getRenewalMenu(checkout.checkoutUrl)
    });
  }
}

function getRenewalMenu(checkoutUrl: string): ReturnType<typeof Markup.inlineKeyboard> {
  if (!isPublicHttpUrl(checkoutUrl)) {
    return Markup.inlineKeyboard([[Markup.button.callback("Gerar pagamento", "buy")]]);
  }

  return Markup.inlineKeyboard([
    [Markup.button.url("Renovar agora", checkoutUrl)],
    [Markup.button.callback("Ver assinatura", "subscription")]
  ]);
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}
