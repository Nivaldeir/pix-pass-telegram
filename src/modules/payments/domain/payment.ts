export type PaymentStatus = "pending" | "confirmed";
export type PaymentProductType = "vip" | "game";

export type Payment = {
  id: string;
  telegramUserId: number;
  telegramChatId: number;
  status: PaymentStatus;
  productType: PaymentProductType;
  amountCents: number;
  gameId?: string;
  gameTitle?: string;
  gameTelegramGroupId?: number;
  checkoutUrl?: string;
  qrCode?: string;
  createdAt: Date;
  confirmedAt?: Date;
};
