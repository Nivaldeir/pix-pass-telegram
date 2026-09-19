export type PaymentStatus = "pending" | "confirmed";

export type Payment = {
  id: string;
  telegramUserId: number;
  telegramChatId: number;
  status: PaymentStatus;
  amountCents: number;
  checkoutUrl?: string;
  qrCode?: string;
  createdAt: Date;
  confirmedAt?: Date;
};
