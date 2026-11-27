import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { updatableColumns } from "../columns";
import { UpdatableRepository } from "../repository";
import type { Database } from "../types";

const items = pgTable("items", updatableColumns("itm"));

function setup() {
  const logged: string[] = [];
  const db = drizzle.mock({
    logger: { logQuery: (q, p) => void logged.push(`${q} -- ${JSON.stringify(p, (_, v) => (typeof v === "bigint" ? `${v}n` : v))}`) },
  }) as unknown as Database;
  const repo = new UpdatableRepository(db, items, items.publicId, items.id);
  // Mock client cannot execute; the logger fires before execution, so swallow the failure.
  const run = async (fn: () => Promise<unknown>) => {
    await fn().catch(() => undefined);
    return logged.splice(0);
  };
  return { repo, run };
}

describe("pg repository SQL", () => {
  it("create", async () => {
    const { repo, run } = setup();
    expect(await run(() => repo.create({ publicId: "itm_1", createdAt: 1, updatedAt: 1 }, 7n))).toMatchSnapshot();
  });
  it("findByPublicId", async () => {
    const { repo, run } = setup();
    expect(await run(() => repo.findByPublicId("itm_1"))).toMatchSnapshot();
  });
  it("findById", async () => {
    const { repo, run } = setup();
    expect(await run(() => repo.findById(5n))).toMatchSnapshot();
  });
  it("findMany with like + sort", async () => {
    const { repo, run } = setup();
    const out = await run(() =>
      repo.findMany(
        { type: "filter", field: "publicId", operator: "like", value: "%a%" },
        { page: 1, size: 10, sort: { field: "createdAt", dir: "desc" } },
      ),
    );
    expect(out).toMatchSnapshot();
  });
  it("updateByPublicId", async () => {
    const { repo, run } = setup();
    expect(await run(() => repo.updateByPublicId("itm_1", { updatedAt: 2 }, 7n))).toMatchSnapshot();
  });
  it("deleteByPublicId", async () => {
    const { repo, run } = setup();
    expect(await run(() => repo.deleteByPublicId("itm_1"))).toMatchSnapshot();
  });
});
