import { ApplicationError } from "../../../shared/errors/application-error.js";
import type { GameChannelProvisioner } from "../domain/game-channel-provisioner.js";
import type { GameRepository } from "../domain/game-repository.js";

export class DeleteGame {
  constructor(
    private readonly games: GameRepository,
    private readonly provisioner?: GameChannelProvisioner
  ) {}

  async execute(gameId: string): Promise<{ removed: boolean }> {
    const game = await this.games.findById(gameId);

    if (!game) {
      throw new ApplicationError("Jogo nao encontrado.", 404);
    }

    if (game.autoCreatedGroup && !game.groupDeletedAt && game.telegramAccessHash) {
      if (!this.provisioner) {
        throw new ApplicationError("Sessao de usuario do Telegram nao configurada para excluir o grupo.", 500);
      }

      await this.provisioner.deleteGroup(game.telegramGroupId, game.telegramAccessHash);
      await this.games.markGroupDeleted(game.id, new Date());
    } else {
      await this.games.deactivate(game.id);
    }

    // Jogos com pagamentos ficam no historico, apenas inativos.
    return { removed: await this.games.removeIfUnused(game.id) };
  }
}
