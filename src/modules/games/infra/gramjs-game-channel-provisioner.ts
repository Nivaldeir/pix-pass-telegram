import { randomBytes } from "node:crypto";
import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { ApplicationError } from "../../../shared/errors/application-error.js";
import type {
  GameChannelProvisioner,
  ProvisionedGameChannel
} from "../domain/game-channel-provisioner.js";

type Options = {
  apiId: number;
  apiHash: string;
  session: string;
  botUsername: string;
};

export class GramjsGameChannelProvisioner implements GameChannelProvisioner {
  private client?: TelegramClient;

  constructor(private readonly options: Options) {}

  async provision(title: string): Promise<ProvisionedGameChannel> {
    const client = await this.getClient();

    const created = await client.invoke(
      new Api.channels.CreateChannel({
        title: `Jogo: ${title}`.slice(0, 128),
        about: `Transmissao ao vivo - ${title}`.slice(0, 255),
        megagroup: true
      })
    );
    const channel = findChannel(created);
    const inputChannel = new Api.InputChannel({ channelId: channel.id, accessHash: channel.accessHash ?? bigInt(0) });

    await this.addBotAsAdmin(client, inputChannel);

    // Membros comuns nao podem adicionar ninguem nem alterar o grupo; so admins.
    await client.invoke(
      new Api.messages.EditChatDefaultBannedRights({
        peer: new Api.InputPeerChannel({ channelId: channel.id, accessHash: channel.accessHash ?? bigInt(0) }),
        bannedRights: new Api.ChatBannedRights({
          untilDate: 0,
          inviteUsers: true,
          pinMessages: true,
          changeInfo: true
        })
      })
    );

    const peer = new Api.InputPeerChannel({ channelId: channel.id, accessHash: channel.accessHash ?? bigInt(0) });

    await client.invoke(
      new Api.phone.CreateGroupCall({
        peer,
        rtmpStream: true,
        title: title.slice(0, 64),
        randomId: randomBytes(4).readInt32LE()
      })
    );

    const rtmp = await client.invoke(new Api.phone.GetGroupCallStreamRtmpUrl({ peer, revoke: false }));

    return {
      telegramGroupId: Number(`-100${channel.id.toString()}`),
      streamServerUrl: rtmp.url,
      streamKey: rtmp.key,
      accessHash: (channel.accessHash ?? bigInt(0)).toString()
    };
  }

  async deleteGroup(telegramGroupId: number, accessHash: string): Promise<void> {
    const client = await this.getClient();
    const channelId = bigInt(String(telegramGroupId).replace(/^-100/, ""));

    await client.invoke(
      new Api.channels.DeleteChannel({
        channel: new Api.InputChannel({ channelId, accessHash: bigInt(accessHash) })
      })
    );
  }

  private async addBotAsAdmin(client: TelegramClient, channel: Api.InputChannel): Promise<void> {
    const bot = await client.getInputEntity(this.options.botUsername);

    await client.invoke(
      new Api.channels.EditAdmin({
        channel,
        userId: bot,
        rank: "bot",
        adminRights: new Api.ChatAdminRights({
          inviteUsers: true,
          banUsers: true,
          deleteMessages: true,
          manageCall: true,
          changeInfo: true,
          pinMessages: true
        })
      })
    );
  }

  private async getClient(): Promise<TelegramClient> {
    if (this.client) {
      return this.client;
    }

    const client = new TelegramClient(
      new StringSession(this.options.session),
      this.options.apiId,
      this.options.apiHash,
      { connectionRetries: 5 }
    );

    await client.connect();

    if (!(await client.checkAuthorization())) {
      throw new ApplicationError(
        "Sessao de usuario do Telegram invalida. Rode `pnpm telegram:login` e atualize TELEGRAM_USER_SESSION.",
        500
      );
    }

    this.client = client;
    return client;
  }
}

function findChannel(updates: Api.TypeUpdates): Api.Channel {
  const chats = "chats" in updates ? updates.chats : [];
  const channel = chats.find((chat): chat is Api.Channel => chat instanceof Api.Channel);

  if (!channel) {
    throw new ApplicationError("Telegram nao retornou o grupo criado.", 502);
  }

  return channel;
}
