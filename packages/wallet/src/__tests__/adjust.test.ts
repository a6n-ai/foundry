import { describe, expect, it } from "vitest";
import { adjustCoins } from "../service";

const USERS = { __lock: "user-lock", id: 1 };

function fakeTx(balance: number, calls: string[]) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (q: any) => {
      const tag = (q?.queryChunks ?? []).map((c: { __lock?: string }) => c?.__lock).filter(Boolean)[0];
      calls.push(tag ?? "unknown-lock");
    },
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: (v: unknown) => void) => {
            calls.push("balance-read");
            resolve([{ bal: balance }]);
          },
        }),
      }),
    }),
    insert: () => ({
      values: async (v: { direction: string; coins: number; memo: string; createdBy: bigint | null }) => {
        calls.push(`write:${v.direction}:${v.coins}:${v.memo}:${v.createdBy}`);
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const base = {
  userId: 1n,
  memo: "Raffle",
  actorId: 9n,
  eventType: "manual_adjustment",
  maxBalance: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletLedger: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: USERS as any,
};

describe("adjustCoins", () => {
  it("locks the user, reads the balance, then writes one credit", async () => {
    const calls: string[] = [];
    const r = await adjustCoins(fakeTx(10, calls), { ...base, coins: 5 });
    expect(calls).toEqual(["user-lock", "balance-read", "write:credit:5:Raffle:9"]);
    expect(r.balance).toBe(15);
  });

  it("writes a debit for a negative amount", async () => {
    const calls: string[] = [];
    const r = await adjustCoins(fakeTx(10, calls), { ...base, coins: -4 });
    expect(calls.at(-1)).toBe("write:debit:4:Raffle:9");
    expect(r.balance).toBe(6);
  });

  it("refuses to take the balance below zero", async () => {
    await expect(adjustCoins(fakeTx(3, []), { ...base, coins: -4 })).rejects.toThrow(/below zero/);
  });

  it("refuses to go over the wallet cap", async () => {
    await expect(adjustCoins(fakeTx(95, []), { ...base, coins: 10, maxBalance: 100 })).rejects.toThrow(/cap/);
  });

  it("requires a whole non-zero amount and a reason", async () => {
    await expect(adjustCoins(fakeTx(0, []), { ...base, coins: 0 })).rejects.toThrow(/whole number/);
    await expect(adjustCoins(fakeTx(0, []), { ...base, coins: 1.5 })).rejects.toThrow(/whole number/);
    await expect(adjustCoins(fakeTx(0, []), { ...base, coins: 1, memo: " " })).rejects.toThrow(/reason/);
  });
});
