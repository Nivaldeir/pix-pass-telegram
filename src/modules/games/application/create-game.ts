import { randomUUID } from "node:crypto";
import { env } from "../../../shared/config/env.js";
import type { Game } from "../domain/game.js";
import type { GameChannelProvisioner } from "../domain/game-channel-provisioner.js";
import type { GameRepository } from "../domain/game-repository.js";

type Input = {
  title: string;
  startsAt?: Date;
  amountCents: number;
  telegramGroupId?: number;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  deleteAt?: Date;
};

export class CreateGame {
  constructor(
    private readonly games: GameRepository,
    private readonly provisioner?: GameChannelProvisioner
  ) {}

  private defaultDeleteAt(startsAt?: Date): Date {
    return new Date((startsAt ?? new Date()).getTime() + env.GAME_GROUP_TTL_HOURS * 60 * 60 * 1000);
  }

  async execute(input: Input): Promise<Game> {
    const title = input.title.trim();

    if (!title) {
      throw new Error("Informe o nome do jogo.");
    }

    let telegramGroupId = input.telegramGroupId;
    let streamServerUrl: string | undefined;
    let streamKey: string | undefined;
    let telegramAccessHash: string | undefined;
    let autoCreatedGroup = false;

    if (telegramGroupId === undefined) {
      if (!this.provisioner) {
        throw new Error("Informe o ID do grupo do jogo ou configure TELEGRAM_API_ID, TELEGRAM_API_HASH e TELEGRAM_USER_SESSION.");
      }

      const channel = await this.provisioner.provision(title);

      telegramGroupId = channel.telegramGroupId;
      streamServerUrl = channel.streamServerUrl;
      streamKey = channel.streamKey;
      telegramAccessHash = channel.accessHash;
      autoCreatedGroup = true;
    } else if (!Number.isInteger(telegramGroupId)) {
      throw new Error("Informe o ID do grupo do jogo.");
    }

    const game: Game = {
      id: randomUUID(),
      title,
      startsAt: input.startsAt,
      amountCents: input.amountCents,
      telegramGroupId,
      streamServerUrl,
      streamKey,
      telegramAccessHash,
      autoCreatedGroup,
      deleteAt: autoCreatedGroup ? input.deleteAt ?? this.defaultDeleteAt(input.startsAt) : undefined,
      homeLogoUrl: input.homeLogoUrl,
      awayLogoUrl: input.awayLogoUrl,
      isActive: true,
      createdAt: new Date()
    };

    await this.games.create(game);

    return game;
  }
}
