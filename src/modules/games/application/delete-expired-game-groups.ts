import type { GameChannelProvisioner } from "../domain/game-channel-provisioner.js";
import type { GameRepository } from "../domain/game-repository.js";

export class DeleteExpiredGameGroups {
  constructor(
    private readonly games: GameRepository,
    private readonly provisioner: GameChannelProvisioner
  ) {}

  async execute(now = new Date()): Promise<number> {
    const due = await this.games.listGroupsDueForDeletion(now);
    let deleted = 0;

    for (const game of due) {
      if (!game.telegramAccessHash) {
        continue;
      }

      try {
        await this.provisioner.deleteGroup(game.telegramGroupId, game.telegramAccessHash);
        await this.games.markGroupDeleted(game.id, new Date());
        deleted += 1;
      } catch (error) {
        console.error(`Falha ao excluir grupo do jogo ${game.id}:`, error);
      }
    }

    return deleted;
  }
}
