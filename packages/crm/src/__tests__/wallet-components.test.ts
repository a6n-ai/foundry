import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdjustCoinsDialog, CoinRateForm, EventPayoutGrid, WalletCapForm } from "../index";

const noop = async () => {};

describe("wallet admin components render from props alone", () => {
  it("EventPayoutGrid shows each event with its label and coins", () => {
    const html = renderToStaticMarkup(
      createElement(EventPayoutGrid, {
        rows: [{ event: "signup", label: "Sign-up", description: "Once per family", enabled: true, coins: 50 }],
        onSave: noop,
      }),
    );
    expect(html).toContain("Sign-up");
    expect(html).toContain("Once per family");
    expect(html).toContain('value="50"');
  });

  it("CoinRateForm shows the app currency, not a hardcoded one", () => {
    const html = renderToStaticMarkup(
      createElement(CoinRateForm, { currency: "SGD", current: { valuePerCoin: "0.0100" }, onSave: noop }),
    );
    expect(html).toContain("SGD");
    expect(html).not.toContain("CAD");
  });

  it("WalletCapForm renders blank for no cap", () => {
    const html = renderToStaticMarkup(createElement(WalletCapForm, { current: null, onSave: noop }));
    expect(html).toContain('placeholder="Unlimited"');
  });

  it("AdjustCoinsDialog renders its trigger", () => {
    const html = renderToStaticMarkup(
      createElement(AdjustCoinsDialog, { balance: 120, who: "Sam", onSubmit: async () => ({}) }),
    );
    expect(html).toContain("Give or take coins");
  });
});
