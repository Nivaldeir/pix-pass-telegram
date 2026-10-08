import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";
import qrcode from "qrcode-terminal";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  throw new Error("Defina TELEGRAM_API_ID e TELEGRAM_API_HASH no .env (my.telegram.org).");
}

const rl = readline.createInterface({ input, output });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });

await client.connect();

await client.signInUserWithQrCode(
  { apiId, apiHash },
  {
    qrCode: async (code) => {
      const url = `tg://login?token=${code.token.toString("base64url")}`;

      console.log("\nNo celular: Telegram > Configuracoes > Dispositivos > Conectar dispositivo, e escaneie:\n");
      qrcode.generate(url, { small: true });
    },
    password: async () => rl.question("Senha 2FA: "),
    onError: async (error) => {
      console.error(error);
      return false;
    }
  }
);

console.log("\nTELEGRAM_USER_SESSION=" + client.session.save());
rl.close();
await client.disconnect();
process.exit(0);
