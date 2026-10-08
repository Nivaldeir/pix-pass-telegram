import type { PaymentRepository } from "../../payments/domain/payment-repository.js";
import type { ActivateMonthlySubscription } from "../../subscriptions/application/activate-monthly-subscription.js";
import type { GroupAccessService, GrantAccessResult } from "../domain/group-access-service.js";

export type ConfirmPaymentAndGrantAccessResult = GrantAccessResult & {
  telegramChatId: number;
  productType: "vip" | "game";
  gameTitle?: string;
  gameTelegramGroupId?: number;
  expiresAt?: Date;
  alreadyConfirmed: boolean;
};

export class ConfirmPaymentAndGrantAccess {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly activateMonthlySubscription: ActivateMonthlySubscription,
    private readonly groupAccess: GroupAccessService
  ) {}

  async execute(paymentId: string): Promise<ConfirmPaymentAndGrantAccessResult> {
    const payment = await this.payments.findById(paymentId);

    if (!payment) {
      throw new Error("Pagamento nao encontrado.");
    }

    if (payment.status === "confirmed") {
      return {
        telegramChatId: payment.telegramChatId,
        productType: payment.productType,
        gameTitle: payment.gameTitle,
        gameTelegramGroupId: payment.gameTelegramGroupId,
        inviteLink: "",
        expiresAt: payment.confirmedAt ?? new Date(),
        alreadyConfirmed: true
      };
    }

    payment.status = "confirmed";
    payment.confirmedAt = new Date();

    await this.payments.save(payment);

    const access = await this.groupAccess.grantAccess(
      payment.telegramUserId,
      payment.productType === "game" ? payment.gameTelegramGroupId : undefined
    );

    if (payment.productType === "game") {
      return {
        ...access,
        telegramChatId: payment.telegramChatId,
        productType: payment.productType,
        gameTitle: payment.gameTitle,
        gameTelegramGroupId: payment.gameTelegramGroupId,
        alreadyConfirmed: false
      };
    }

    const subscription = await this.activateMonthlySubscription.execute({
      telegramUserId: payment.telegramUserId,
      paidAt: payment.confirmedAt
    });

    return {
      ...access,
      telegramChatId: payment.telegramChatId,
      productType: payment.productType,
      gameTitle: payment.gameTitle,
      gameTelegramGroupId: payment.gameTelegramGroupId,
      expiresAt: subscription.expiresAt,
      alreadyConfirmed: false
    };
  }
}
