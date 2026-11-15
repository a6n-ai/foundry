import { describe, expect, it } from "vitest";
import { chipState, type ChipContext } from "../role-chips";

const base: ChipContext = {
  self: false,
  targetAboveViewer: false,
  roleCount: 2,
  lastOwnerRole: "owner",
  aboveViewer: ["admin"],
};

describe("chipState", () => {
  it("allows an ordinary add or remove", () => {
    expect(chipState("cashier", "add", base)).toBeNull();
    expect(chipState("cashier", "remove", base)).toBeNull();
  });

  it("blocks changes to your own row", () => {
    expect(chipState("cashier", "add", { ...base, self: true })).toMatch(/own roles/);
    expect(chipState("cashier", "remove", { ...base, self: true })).toMatch(/own roles/);
  });

  it("blocks removing the last role", () => {
    expect(chipState("cashier", "remove", { ...base, roleCount: 1 })).toMatch(/at least one role/);
    expect(chipState("cashier", "add", { ...base, roleCount: 1 })).toBeNull();
  });

  it("blocks removing the role that holds the last owner", () => {
    expect(chipState("owner", "remove", base)).toMatch(/last owner/);
    expect(chipState("owner", "add", base)).toBeNull();
  });

  it("blocks adding or removing a role above the viewer", () => {
    expect(chipState("admin", "add", base)).toMatch(/above yours/);
    expect(chipState("admin", "remove", base)).toMatch(/above yours/);
  });

  it("blocks changes to a person above the viewer, even with an ordinary role", () => {
    const above = { ...base, targetAboveViewer: true };
    expect(chipState("cashier", "add", above)).toMatch(/above you/);
    expect(chipState("cashier", "remove", above)).toMatch(/above you/);
  });
});
