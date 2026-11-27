import type { Condition, Page, PageRequest } from "@foundry/commons";
import { NotFoundError } from "@foundry/commons";
import { stripManaged } from "./managed-fields";
import type { BaseRepository, UpdatableRepository } from "./repository";
import type { AnyDatabase, AnyTable, Database } from "./types";

export class BaseService<
  TTable extends AnyTable,
  TDb extends AnyDatabase = Database,
  TActorId extends bigint | string = bigint,
> {
  constructor(protected readonly repo: BaseRepository<TTable, TDb, TActorId>) {}

  protected async currentUserId(): Promise<TActorId | null> {
    return null;
  }

  async create(values: Record<string, unknown>): Promise<TTable["$inferSelect"]> {
    return this.repo.create(stripManaged(values), await this.currentUserId());
  }

  async read(publicId: string): Promise<TTable["$inferSelect"]> {
    const row = await this.repo.findByPublicId(publicId);
    if (!row) throw new NotFoundError(`Not found: ${publicId}`);
    return row;
  }

  async list(condition?: Condition, page?: PageRequest): Promise<Page<TTable["$inferSelect"]>> {
    return this.repo.findMany(condition, page);
  }

  async delete(publicId: string): Promise<number> {
    return this.repo.deleteByPublicId(publicId);
  }
}

export class UpdatableService<
  TTable extends AnyTable,
  TDb extends AnyDatabase = Database,
  TActorId extends bigint | string = bigint,
> extends BaseService<TTable, TDb, TActorId> {
  constructor(protected readonly repo: UpdatableRepository<TTable, TDb, TActorId>) {
    super(repo);
  }

  async update(publicId: string, patch: Record<string, unknown>): Promise<TTable["$inferSelect"]> {
    const row = await this.repo.updateByPublicId(publicId, stripManaged(patch), await this.currentUserId());
    if (!row) throw new NotFoundError(`Not found: ${publicId}`);
    return row;
  }
}
