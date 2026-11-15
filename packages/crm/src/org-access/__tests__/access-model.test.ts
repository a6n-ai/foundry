import { describe, expect, it } from "vitest";
import { accessLevel, whoCan, type AccessRow } from "../access-model";
import type { ResourceLabel } from "../../org-roles/permission-map";

const resources: ResourceLabel[] = [
  {
    resource: "finance",
    label: "Finance",
    actions: [
      { action: "read", label: "View" },
      { action: "refund", label: "Refund" },
    ],
  },
  {
    resource: "order",
    label: "Orders",
    actions: [
      { action: "read", label: "View" },
      { action: "update", label: "Edit" },
      { action: "cancel", label: "Edit cancellations" },
    ],
  },
];

const rows: AccessRow[] = [
  {
    id: "a",
    name: "Ann",
    email: null,
    roles: ["cashier", "manager"],
    permissions: { finance: ["read", "refund"], order: ["read", "update"] },
    grants: {
      finance: { read: ["cashier"], refund: ["manager"] },
      order: { read: ["cashier"], update: ["manager"], cancel: ["manager"] },
    },
  },
  {
    id: "b",
    name: "Bo",
    email: "bo@example.com",
    roles: ["cashier"],
    permissions: { order: ["read"] },
    grants: {
      finance: { read: ["cashier"], refund: ["manager"] },
      order: { read: ["cashier"], update: ["manager"], cancel: ["manager"] },
    },
  },
];

describe("accessLevel", () => {
  it("classifies held actions against an area", () => {
    expect(accessLevel([], ["read", "write"])).toBe("none");
    expect(accessLevel(["read"], ["read", "write"])).toBe("view");
    expect(accessLevel(["read", "write"], ["read", "write"])).toBe("full");
    expect(accessLevel(["write"], ["read", "write", "cancel"])).toBe("edit");
  });
});

describe("whoCan", () => {
  it("returns the action with exactly the holders and their granting roles", () => {
    const hits = whoCan(rows, resources, "refund");
    expect(hits).toEqual([
      {
        resource: "finance",
        action: "refund",
        label: "Refund",
        holders: [{ rowId: "a", roles: ["manager"] }],
      },
    ]);
  });

  it("matches several actions by label and lists each one's holders", () => {
    const hits = whoCan(rows, resources, "edit");
    expect(hits.map((h) => `${h.resource}/${h.action}`)).toEqual(["order/update", "order/cancel"]);
    expect(hits[0].holders).toEqual([{ rowId: "a", roles: ["manager"] }]);
  });

  it("matches the resource label case-insensitively", () => {
    const hits = whoCan(rows, resources, "  FINANCE ");
    expect(hits.every((h) => h.resource === "finance")).toBe(true);
    expect(hits).toHaveLength(2);
  });

  it("returns nothing for an empty query", () => {
    expect(whoCan(rows, resources, "")).toEqual([]);
    expect(whoCan(rows, resources, "   ")).toEqual([]);
  });
});
