import type { Condition, Page, PageRequest } from "@foundry/commons";
import { DEFAULT_PAGE } from "@foundry/commons";
import { eq, getTableName, sql, type SQL } from "drizzle-orm";
import { resolveColumn, toDrizzleWhere } from "./condition";
import { dialectOf, supportsReturning } from "./dialect";
import { stripCreateOnly } from "./managed-fields";
import { pageOrder } from "./order";
import type { AnyColumn, AnyDatabase, AnyTable, Database, Dialect } from "./types";

const COUNT_SQL: Record<Dialect, SQL<number>> = {
  pg: sql<number>`cast(count(*) as int)`,
  sqlite: sql<number>`cast(count(*) as integer)`,
  mysql: sql<number>`count(*)`,
};

// Drizzle's per-dialect builders share no common type, so the dialect-agnostic
// paths below go through an untyped view of the same db/table/columns.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Loose = any;

export class BaseRepository<
  TTable extends AnyTable,
  TDb extends AnyDatabase = Database,
  TActorId extends bigint | string = bigint,
> {
  private dialectCache?: Dialect;

  constructor(
    protected readonly db: TDb,
    protected readonly table: TTable,
    protected readonly publicIdColumn: AnyColumn,
    protected readonly internalIdColumn: AnyColumn,
  ) {}

  protected get dialect(): Dialect {
    return (this.dialectCache ??= dialectOf(this.db));
  }

  protected get q(): Loose {
    return this.db;
  }

  protected get t(): Loose {
    return this.table;
  }

  get tableName(): string {
    return getTableName(this.table);
  }

  private selectByPublicId(publicId: string): Promise<TTable["$inferSelect"] | null> {
    return this.findByPublicId(publicId);
  }

  private withPublicId(values: Record<string, unknown>): Record<string, unknown> {
    if (values.publicId !== undefined) return values;
    const generate = (this.publicIdColumn as Loose).defaultFn as (() => unknown) | undefined;
    return generate ? { ...values, publicId: generate() } : values;
  }

  async create(values: Record<string, unknown>, actorId?: TActorId | null): Promise<TTable["$inferSelect"]> {
    const withActor = actorId ? { ...values, createdBy: actorId } : values;
    if (supportsReturning(this.dialect)) {
      const [row] = await this.q.insert(this.t).values(withActor as never).returning();
      return row as TTable["$inferSelect"];
    }
    const toInsert = this.withPublicId(withActor);
    await this.q.insert(this.t).values(toInsert as never);
    return (await this.selectByPublicId(toInsert.publicId as string)) as TTable["$inferSelect"];
  }

  async findByPublicId(publicId: string): Promise<TTable["$inferSelect"] | null> {
    const [row] = await this.q.select().from(this.t).where(eq(this.publicIdColumn, publicId)).limit(1);
    return (row as TTable["$inferSelect"]) ?? null;
  }

  async findById(internalId: bigint | string): Promise<TTable["$inferSelect"] | null> {
    const [row] = await this.q.select().from(this.t).where(eq(this.internalIdColumn, internalId)).limit(1);
    return (row as TTable["$inferSelect"]) ?? null;
  }

  async findMany(condition?: Condition, page: PageRequest = DEFAULT_PAGE): Promise<Page<TTable["$inferSelect"]>> {
    const where = toDrizzleWhere(this.table, condition, this.dialect);
    const orderColumn = page.sort ? resolveColumn(this.table, page.sort.field) : this.internalIdColumn;

    const [rows, [{ count }]] = await Promise.all([
      this.q
        .select()
        .from(this.t)
        .where(where)
        .orderBy(...pageOrder(page.sort?.dir === "desc" ? "desc" : "asc", orderColumn, this.internalIdColumn))
        .limit(page.size)
        .offset(page.page * page.size),
      this.q.select({ count: COUNT_SQL[this.dialect] }).from(this.t).where(where),
    ]);

    return { items: rows as TTable["$inferSelect"][], page: page.page, size: page.size, total: Number(count) };
  }

  async deleteByPublicId(publicId: string): Promise<number> {
    const del = this.q.delete(this.t).where(eq(this.publicIdColumn, publicId));
    if (this.dialect === "mysql") {
      const [header] = await del;
      return header.affectedRows as number;
    }
    const result = await del.returning({ id: this.internalIdColumn });
    return result.length;
  }
}

export class UpdatableRepository<
  TTable extends AnyTable,
  TDb extends AnyDatabase = Database,
  TActorId extends bigint | string = bigint,
> extends BaseRepository<TTable, TDb, TActorId> {
  async updateByPublicId(
    publicId: string,
    patch: Record<string, unknown>,
    actorId?: TActorId | null,
  ): Promise<TTable["$inferSelect"] | null> {
    const safePatch = stripCreateOnly(patch);
    const toSet = actorId ? { ...safePatch, updatedBy: actorId } : safePatch;
    const upd = this.q.update(this.t).set(toSet as never).where(eq(this.publicIdColumn, publicId));
    if (this.dialect === "mysql") {
      await upd;
      return this.findByPublicId(publicId);
    }
    const [row] = await upd.returning();
    return (row as TTable["$inferSelect"]) ?? null;
  }
}
