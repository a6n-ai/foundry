import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinueAs, type AuthUi } from "../index";

const kit: Partial<AuthUi> = { Button: ({ children }) => <button data-kit="btn">{children}</button> };
const user = { firstName: "Ana", email: "ana@example.com", maskedEmail: "a**@example.com", method: "google" as const };

describe("ContinueAs", () => {
  it("shows who, Continue, another account and Not you, drawn with the app kit", () => {
    const html = renderToStaticMarkup(
      <ContinueAs ui={kit} user={user} onContinue={vi.fn()} onOther={vi.fn()} onForget={vi.fn()} getStarted={{ label: "New here? Create an account", onClick: vi.fn() }} />,
    );
    expect(html).toContain("Ana");
    expect(html).toContain("ana@example.com");
    expect(html).toContain('data-kit="btn">Continue<');
    expect(html).toContain("Continue with another account");
    expect(html).toContain("Not you? Remove this account");
    expect(html).toContain("New here? Create an account");
  });

  it("falls back to an initial when there is no photo", () => {
    const html = renderToStaticMarkup(<ContinueAs user={{ ...user, firstName: "" }} onContinue={vi.fn()} onOther={vi.fn()} onForget={vi.fn()} />);
    expect(html).toContain(">A<");
  });
});
