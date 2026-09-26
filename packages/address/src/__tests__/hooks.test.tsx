// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAddressBook, useAddressPicker } from "../hooks";
import type { SavedAddress } from "../rules";

const addr = (publicId: string, isDefault = false): SavedAddress => ({
  publicId, label: publicId, fullName: null, addressLine: "1 A St", addressUnit: null, city: "T",
  province: null, postalCode: "M5V 2T6", deliveryInstructions: null, isDefault, lat: null, lng: null,
});

describe("useAddressBook", () => {
  it("setDefault flips the badge immediately and rolls back on failure", async () => {
    const actions = {
      create: vi.fn(), update: vi.fn(), archive: vi.fn(),
      setDefault: vi.fn().mockRejectedValue(new Error("nope")),
    };
    const { result } = renderHook(() => useAddressBook({ initial: [addr("home", true), addr("work")], actions }));
    let ok = true;
    await act(async () => { ok = await result.current.setDefault("work"); });
    expect(ok).toBe(false);
    expect(result.current.addresses.find((a) => a.isDefault)?.publicId).toBe("home");
    expect(result.current.error).toBe("nope");
  });

  it("archive removes the row after the server confirms", async () => {
    const actions = { create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), archive: vi.fn().mockResolvedValue({ movedToDefault: true }) };
    const { result } = renderHook(() => useAddressBook({ initial: [addr("home", true), addr("work")], actions }));
    await act(async () => { await result.current.archive("work"); });
    expect(result.current.addresses.map((a) => a.publicId)).toEqual(["home"]);
  });
});

describe("useAddressPicker", () => {
  it("preselects the default, else starts a new address", () => {
    const withDefault = renderHook(() => useAddressPicker({ addresses: [addr("work"), addr("home", true)] }));
    expect(withDefault.result.current.pick).toEqual({ kind: "saved", publicId: "home" });
    const empty = renderHook(() => useAddressPicker({ addresses: [] }));
    expect(empty.result.current.pick.kind).toBe("new");
  });
});
