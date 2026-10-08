import type { Game } from "../domain/game.js";
import type { GameRepository } from "../domain/game-repository.js";

export class ListGames {
  constructor(private readonly games: GameRepository) {}

  async active(): Promise<Game[]> {
    return this.games.listActive();
  }

  async all(): Promise<Game[]> {
    return this.games.listAll();
  }
}
