import type { Pool } from "pg";
import type { Game } from "../domain/game.js";
import type { GameRepository } from "../domain/game-repository.js";

type GameRow = {
  id: string;
  title: string;
  starts_at: Date | null;
  amount_cents: number;
  telegram_group_id: string;
  stream_server_url: string | null;
  stream_key: string | null;
  telegram_access_hash: string | null;
  auto_created_group: boolean;
  delete_at: Date | null;
  group_deleted_at: Date | null;
  home_logo_url: string | null;
  away_logo_url: string | null;
  is_active: boolean;
  created_at: Date;
};

export class PostgresGameRepository implements GameRepository {
  constructor(private readonly pool: Pool) {}

  async create(game: Game): Promise<void> {
    await this.pool.query(
      `
        insert into games (id, title, starts_at, amount_cents, telegram_group_id, stream_server_url, stream_key, home_logo_url, away_logo_url, telegram_access_hash, auto_created_group, delete_at, is_active, created_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        game.id,
        game.title,
        game.startsAt ?? null,
        game.amountCents,
        game.telegramGroupId,
        game.streamServerUrl ?? null,
        game.streamKey ?? null,
        game.homeLogoUrl ?? null,
        game.awayLogoUrl ?? null,
        game.telegramAccessHash ?? null,
        game.autoCreatedGroup,
        game.deleteAt ?? null,
        game.isActive,
        game.createdAt
      ]
    );
  }

  async findById(gameId: string): Promise<Game | null> {
    const result = await this.pool.query<GameRow>(
      `
        select *
        from games
        where id = $1
        limit 1
      `,
      [gameId]
    );

    return result.rows[0] ? toGame(result.rows[0]) : null;
  }

  async listActive(): Promise<Game[]> {
    const result = await this.pool.query<GameRow>(`
      select *
      from games
      where is_active = true
      order by starts_at nulls last, created_at desc
    `);

    return result.rows.map(toGame);
  }

  async listGroupsDueForDeletion(now: Date): Promise<Game[]> {
    const result = await this.pool.query<GameRow>(
      `
        select *
        from games
        where auto_created_group = true
          and group_deleted_at is null
          and delete_at is not null
          and delete_at <= $1
      `,
      [now]
    );

    return result.rows.map(toGame);
  }

  async markGroupDeleted(gameId: string, deletedAt: Date): Promise<void> {
    await this.pool.query(
      "update games set group_deleted_at = $2, is_active = false where id = $1",
      [gameId, deletedAt]
    );
  }

  async deactivate(gameId: string): Promise<void> {
    await this.pool.query("update games set is_active = false where id = $1", [gameId]);
  }

  async removeIfUnused(gameId: string): Promise<boolean> {
    const result = await this.pool.query(
      "delete from games g where g.id = $1 and not exists (select 1 from payments p where p.game_id = g.id)",
      [gameId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listAll(): Promise<Game[]> {
    const result = await this.pool.query<GameRow>(`
      select *
      from games
      order by created_at desc
    `);

    return result.rows.map(toGame);
  }
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at ?? undefined,
    amountCents: row.amount_cents,
    telegramGroupId: Number(row.telegram_group_id) || 0,
    streamServerUrl: row.stream_server_url ?? undefined,
    streamKey: row.stream_key ?? undefined,
    telegramAccessHash: row.telegram_access_hash ?? undefined,
    autoCreatedGroup: row.auto_created_group,
    deleteAt: row.delete_at ?? undefined,
    groupDeletedAt: row.group_deleted_at ?? undefined,
    homeLogoUrl: row.home_logo_url ?? undefined,
    awayLogoUrl: row.away_logo_url ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}
