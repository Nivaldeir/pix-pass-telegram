import type { Game } from "./game.js";

export interface GameRepository {
  create(game: Game): Promise<void>;
  findById(gameId: string): Promise<Game | null>;
  listActive(): Promise<Game[]>;
  listAll(): Promise<Game[]>;
  listGroupsDueForDeletion(now: Date): Promise<Game[]>;
  deactivate(gameId: string): Promise<void>;
  removeIfUnused(gameId: string): Promise<boolean>;
  markGroupDeleted(gameId: string, deletedAt: Date): Promise<void>;
}
