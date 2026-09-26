import { describe, expect, it } from "vitest";
import { bigint, getTableConfig, pgTable, text } from "drizzle-orm/pg-core";
import { makeAddressTables } from "../schema";

const users = pgTable("users", { id: bigint("id", { mode: "bigint" }).primaryKey() });
const organization = pgTable("organization", { id: text("id").primaryKey() });
const { customerAddresses } = makeAddressTables({
  users,
  organization,
  extraColumns: () => ({ addressTagId: bigint("address_tag_id", { mode: "bigint" }) }),
});
const cfg = getTableConfig(customerAddresses);

describe("makeAddressTables", () => {
  it("names the table and keeps AddressValues column names", () => {
    expect(cfg.name).toBe("customer_addresses");
    expect(cfg.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "user_id", "label", "full_name", "address_line", "address_unit", "city", "province",
        "postal_code", "delivery_instructions", "lat", "lng", "is_default", "archived_at",
        "organization_id", "address_tag_id",
      ]),
    );
  });

  it("allows one live default per user and indexes every FK", () => {
    const idx = Object.fromEntries(cfg.indexes.map((i) => [i.config.name, i.config]));
    expect(idx["customer_addresses_one_default"]?.unique).toBe(true);
    expect(idx["customer_addresses_one_default"]?.where).toBeDefined();
    expect(Object.keys(idx)).toEqual(
      expect.arrayContaining(["customer_addresses_user_idx", "customer_addresses_org_idx"]),
    );
  });
});
