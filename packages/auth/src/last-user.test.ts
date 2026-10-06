import { describe, expect, it } from "vitest";
import { encodeLastUser, maskEmail, parseLastUser } from "./last-user";

describe("last user cookie", () => {
  it("round-trips a sign-in, first name only", () => {
    const raw = encodeLastUser("/callback/google", { name: "Vijay Panangipally unit 1703", email: "ezzi@gmail.com" });
    expect(parseLastUser(raw)).toEqual({ firstName: "Vijay", email: "ezzi@gmail.com", method: "google" });
  });

  it("ignores paths that are not a sign-in", () => {
    expect(encodeLastUser("/get-session", { name: "A", email: "a@b.co" })).toBeNull();
  });

  it("reads a broken cookie as no one", () => {
    expect(parseLastUser("not json")).toBeNull();
    expect(parseLastUser(JSON.stringify({ email: "x", method: "google" }))).toBeNull();
    expect(parseLastUser(JSON.stringify({ email: "a@b.co", method: "sso" }))).toBeNull();
  });

  it("keeps a safe photo URL and drops anything else", () => {
    const withPhoto = encodeLastUser("/sign-in/email-otp", { name: "A", email: "a@b.co", image: "https://lh3.googleusercontent.com/a/x" });
    expect(parseLastUser(withPhoto)?.image).toBe("https://lh3.googleusercontent.com/a/x");
    expect(parseLastUser(encodeLastUser("/sign-in/email-otp", { name: "A", email: "a@b.co", image: "/api/files/public/avatars/1-0a1b2c3d.webp" }))?.image).toBe("/api/files/public/avatars/1-0a1b2c3d.webp");
    for (const image of ["javascript:alert(1)", "//evil.com/x.png", "http://plain.example/x.png"]) {
      expect(parseLastUser(JSON.stringify({ email: "a@b.co", method: "email", image }))?.image).toBeUndefined();
    }
  });

  it("masks the email", () => {
    expect(maskEmail("vishwas@gmail.com")).toBe("vi•••@gmail.com");
  });
});
