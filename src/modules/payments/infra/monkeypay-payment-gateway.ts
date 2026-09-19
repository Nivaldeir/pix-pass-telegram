import type { Payment } from "../domain/payment.js";
import type { PaymentCheckout, PaymentGateway } from "../domain/payment-gateway.js";

type MonkeyPayGatewayConfig = {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  walletId: string;
  customerId?: string;
  payerDocument?: string;
  payerName?: string;
  payerEmail?: string;
};

type TokenResponse = {
  error: boolean;
  message?: string;
  data?: {
    accessToken?: string;
    tokenType?: string;
    expiresIn?: number;
  };
};

type PixQrCodeResponse = {
  error: boolean;
  message?: string;
  data?: {
    payload?: {
      qrCode?: string;
    };
  };
};

export class MonkeyPayPaymentGateway implements PaymentGateway {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly config: MonkeyPayGatewayConfig) {}

  async createCheckout(payment: Payment): Promise<PaymentCheckout> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.apiBaseUrl}/api/v2/payment/pix/qrcode`, {
      method: "POST",
      headers: this.getPixHeaders(token),
      body: JSON.stringify({
        walletId: this.config.walletId,
        amount: payment.amountCents / 100,
        description: "",
        info: {
          payerDocument: this.config.payerDocument ?? null,
          payerName: this.config.payerName ?? `Telegram ${payment.telegramUserId}`,
          payerEmail: this.config.payerEmail ?? null
        },
        externalId: payment.id
      })
    });
    const body = await this.parseJson<PixQrCodeResponse>(response);
    const qrCode = body.data?.payload?.qrCode;

    if (!response.ok || body.error || !qrCode) {
      throw new Error(body.message ?? "Nao foi possivel gerar o QR Code Pix na MonkeyPay.");
    }

    return {
      paymentId: payment.id,
      checkoutUrl: qrCode,
      qrCode
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && this.accessTokenExpiresAt > now + 30_000) {
      return this.accessToken;
    }

    const response = await fetch(`${this.config.apiBaseUrl}/api/v2/resource/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret
      })
    });
    const body = await this.parseJson<TokenResponse>(response);
    const accessToken = body.data?.accessToken;

    if (!response.ok || body.error || !accessToken) {
      throw new Error(body.message ?? "Nao foi possivel autenticar na MonkeyPay.");
    }

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = now + ((body.data?.expiresIn ?? 1800) * 1000);

    return accessToken;
  }

  private getPixHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };

    if (this.config.customerId) {
      headers["x-customer-id"] = this.config.customerId;
    }

    return headers;
  }

  private async parseJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new Error("A MonkeyPay retornou uma resposta invalida.");
    }
  }
}
