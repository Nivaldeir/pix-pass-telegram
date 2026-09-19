import type { Telegraf } from "telegraf";
import type { GroupAccessService, GrantAccessResult } from "../domain/group-access-service.js";
import { ApplicationError } from "../../../shared/errors/application-error.js";

export class TelegramGroupAccessService implements GroupAccessService {
  constructor(
    private readonly bot: Telegraf,
    private readonly groupId: number
  ) {}

  async grantAccess(_telegramUserId: number): Promise<GrantAccessResult> {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const invite = await this.createInviteLink(expiresAt);

    return { inviteLink: invite.invite_link };
  }

  async revokeAccess(telegramUserId: number): Promise<void> {
    await this.bot.telegram.banChatMember(this.groupId, telegramUserId);
    await this.bot.telegram.unbanChatMember(this.groupId, telegramUserId, {
      only_if_banned: true
    });
  }

  private async createInviteLink(expiresAt: number): Promise<{ invite_link: string }> {
    try {
      return await this.bot.telegram.createChatInviteLink(this.groupId, {
        member_limit: 1,
        expire_date: expiresAt,
        creates_join_request: false
      });
    } catch (error) {
      if (isTelegramChatNotFoundError(error)) {
        throw new ApplicationError(
          "Grupo do Telegram nao encontrado. Confira TELEGRAM_GROUP_ID no .env e se o bot e admin do grupo.",
          502
        );
      }

      throw error;
    }
  }
}

function isTelegramChatNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "description" in error.response &&
    error.response.description === "Bad Request: chat not found"
  );
}
