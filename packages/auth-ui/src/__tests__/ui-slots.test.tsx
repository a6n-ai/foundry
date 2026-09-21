import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangePasswordForm, ForgotPasswordForm, DeleteAccountForm, PinForm, defaultUi, type AuthUi } from "../index";

const custom: Partial<AuthUi> = {
  Button: ({ children }) => <button data-kit="btn">{children}</button>,
  Field: ({ label }) => <label data-kit="field">{label}</label>,
  Code: ({ label }) => <div data-kit="code">{label}</div>,
};

describe("auth-ui ui slots", () => {
  it("exports defaultUi with every primitive", () => {
    expect(Object.keys(defaultUi).sort()).toEqual(["Button", "Code", "Field", "Notice"]);
  });
  it("defaults to the shadcn kit", () => {
    const html = renderToStaticMarkup(<ChangePasswordForm onChangePassword={vi.fn()} />);
    expect(html).toContain('data-slot="input"');
    expect(html).not.toContain("data-kit");
  });
  it("uses app-supplied primitives", () => {
    const html = renderToStaticMarkup(<ChangePasswordForm onChangePassword={vi.fn()} ui={custom} />);
    expect(html).toContain('data-kit="field"');
    expect(html).toContain("Current password");
    expect(html).not.toContain('data-slot="input"');
  });
  it("PIN and delete forms honor ui", () => {
    const pin = renderToStaticMarkup(<PinForm hasPin onSetPin={vi.fn()} onRemovePin={vi.fn()} ui={custom} />);
    expect(pin).toContain('data-kit="code"');
    expect(renderToStaticMarkup(<DeleteAccountForm onDelete={vi.fn()} ui={custom} />)).toContain('data-kit="btn"');
  });
  it("ForgotPasswordForm honors ui and keeps the shadcn default without it", () => {
    const kit = renderToStaticMarkup(<ForgotPasswordForm onSendEmailOtp={vi.fn()} onResetWithEmailOtp={vi.fn()} ui={custom} />);
    expect(kit).toContain('data-kit="field"');
    expect(kit).toContain('data-kit="btn"');
    const def = renderToStaticMarkup(<ForgotPasswordForm onSendEmailOtp={vi.fn()} onResetWithEmailOtp={vi.fn()} />);
    expect(def).toContain('data-slot="input"');
    expect(def).not.toContain("data-kit");
  });
});
