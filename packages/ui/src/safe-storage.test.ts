// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { localStore, safeStorage } from "./safe-storage";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("safeStorage", () => {
  it("round-trips strings and JSON, with fallbacks for missing keys", () => {
    localStore.set("a", "1");
    localStore.setJson("j", { x: 1 });
    expect(localStore.get("a")).toBe("1");
    expect(localStore.getJson("j", null)).toEqual({ x: 1 });
    expect(localStore.getJson("missing", 7)).toBe(7);
    localStore.remove("a");
    expect(localStore.get("a")).toBeNull();
  });

  it("never throws when the storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const s = safeStorage("session");
    expect(s.get("k", "fb")).toBe("fb");
    expect(() => s.set("k", "v")).not.toThrow();
    expect(s.getJson("k", 3)).toBe(3);
  });
});
