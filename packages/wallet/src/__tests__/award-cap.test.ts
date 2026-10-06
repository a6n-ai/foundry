import { describe, expect, it } from "vitest";
import { createWalletService } from "../service";

const USERS = { __lock: "user-lock", id: 1 };

/** Fake db: the payout config read is on `db`; everything after it must run on the tx. */
function fakeDb(balance: number, calls: string[]) {
  const tx = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (q: any) => {
      const tag = (q?.queryChunks ?? []).map((c: { __lock?: string }) => c?.__lock).filter(Boolean)[0];
      calls.push(`tx:${tag ?? "unknown-lock"}`);
    },
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: (v: unknown) => void) => {
            calls.push("tx:balance-read");
            resolve([{ bal: balance }]);
          },
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            calls.push("tx:write");
            return [{ id: 1 }];
          },
        }),
      }),
    }),
  };
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            calls.push("db:payout-config");
            return [{ enabled: true, coins: 10 }];
          },
        }),
      }),
    }),
    transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    insert: () => {
      throw new Error("award must write inside the transaction");
    },
  };
}

function service(balance: number, cap: number | null, calls: string[]) {
  return createWalletService({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: fakeDb(balance, calls) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tables: { walletLedger: {}, eventPayout: {}, coinRate: {} } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    users: USERS as any,
    recordRedemptionDiscount: async () => {},
    maxBalance: async () => cap,
  });
}

describe("award under a wallet cap", () => {
  it("checks the balance under the user lock, in the same transaction as the write", async () => {
    const calls: string[] = [];
    expect(await service(50, 100, calls).award(1n, "signup" as never, { type: "user", id: "u1" })).toBe(true);
    expect(calls).toEqual(["db:payout-config", "tx:user-lock", "tx:balance-read", "tx:write"]);
  });

  it("skips an award that would cross the cap", async () => {
    const calls: string[] = [];
    expect(await service(95, 100, calls).award(1n, "signup" as never, { type: "user", id: "u1" })).toBe(false);
    expect(calls).not.toContain("tx:write");
  });

  it("takes no lock when there is no cap", async () => {
    const calls: string[] = [];
    expect(await service(95, null, calls).award(1n, "signup" as never, { type: "user", id: "u1" })).toBe(true);
    expect(calls).toEqual(["db:payout-config", "tx:write"]);
  });
});
