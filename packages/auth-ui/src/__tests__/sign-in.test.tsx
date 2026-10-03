import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthWelcome, EmailCodeSignIn, EmailSuggestions, ResendCode, type AuthUi } from "../index";

const kit: Partial<AuthUi> = {
  Button: ({ children }) => <button data-kit="btn">{children}</button>,
  Field: ({ label }) => <label data-kit="field">{label}</label>,
};

describe("sign-in flow", () => {
  it("ResendCode starts on the first cooldown, not on a live link", () => {
    const html = renderToStaticMarkup(<ResendCode onResend={vi.fn()} cooldowns={[45]} />);
    expect(html).toContain("0:45");
    expect(html).not.toContain("Resend code</button>");
  });
  it("EmailCodeSignIn draws with the app kit and posts, never GETs, before hydration", () => {
    const html = renderToStaticMarkup(
      <EmailCodeSignIn onSendCode={vi.fn()} onVerify={vi.fn()} onSuccess={vi.fn()} ui={kit} />,
    );
    expect(html).toContain('data-kit="field"');
    expect(html).toContain('method="post"');
  });
  it("AuthWelcome renders both actions through the kit", () => {
    const html = renderToStaticMarkup(
      <AuthWelcome art={<i />} title="Hi" primary={{ label: "Sign in", onClick: vi.fn() }} secondary={{ label: "Get started", onClick: vi.fn() }} ui={kit} />,
    );
    expect(html.match(/data-kit="btn"/g)).toHaveLength(2);
  });
  it("EmailSuggestions offers providers after @ and nothing before", () => {
    expect(renderToStaticMarkup(<EmailSuggestions value="priya" onPick={vi.fn()} />)).toBe("");
    const html = renderToStaticMarkup(<EmailSuggestions value="priya@g" onPick={vi.fn()} />);
    expect(html).toContain("gmail.com");
    expect(html).not.toContain("outlook.com");
  });
});
