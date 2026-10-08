import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  throw new Error("Defina TELEGRAM_API_ID e TELEGRAM_API_HASH no .env (my.telegram.org).");
}

const rl = readline.createInterface({ input, output });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });

await client.start({
  phoneNumber: () => rl.question("Telefone (+55...): "),
  phoneCode: () => rl.question("Codigo recebido: "),
  password: () => rl.question("Senha 2FA (se houver): "),
  onError: (error) => console.error(error)
});

console.log("\nTELEGRAM_USER_SESSION=" + client.session.save());
rl.close();
await client.disconnect();
process.exit(0);
