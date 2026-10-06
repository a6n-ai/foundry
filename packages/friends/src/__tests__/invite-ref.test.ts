import { describe, expect, it } from "vitest";
import { makeInviteRef, parseInviteRef } from "../invite-ref";

const SECRET = "test-secret";

describe("invite refs", () => {
  it("round-trips for the user it was made for", () => {
    const ref = makeInviteRef(SECRET, 42n, "priya.s");
    expect(ref).toMatch(/^priya\.s-[0-9a-f]{12}$/);
    const parsed = parseInviteRef(ref)!;
    expect(parsed.username).toBe("priya.s");
    expect(parsed.verify(SECRET, 42n)).toBe(true);
  });

  it("a bare or forged username is not an invite", () => {
    expect(parseInviteRef("priya.s")).toBeNull();
    expect(parseInviteRef("priya.s-000000000000")!.verify(SECRET, 42n)).toBe(false);
    expect(parseInviteRef(makeInviteRef(SECRET, 42n, "priya.s"))!.verify(SECRET, 43n)).toBe(false);
    expect(parseInviteRef(makeInviteRef("other", 42n, "priya.s"))!.verify(SECRET, 42n)).toBe(false);
  });

  it("rejects junk", () => {
    for (const bad of ["", "-abc", "x-<script>", "a".repeat(200)]) expect(parseInviteRef(bad)).toBeNull();
  });
});
