// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { AddressFields, useAddressFields } from "./address-fields";

afterEach(cleanup);

describe("AddressFields", () => {
  it("renders a plain input with no dropdown when onResolve/resolveUrl are omitted", () => {
    render(<AddressFields values={{}} onChange={vi.fn()} preset="delivery" />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Street address")).toBeInTheDocument();
  });

  it("shows suggestions from the suggest endpoint and fills fields + reports lat/lng on pick", async () => {
    const onChange = vi.fn();
    const onResolve = vi.fn();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/suggest")) {
        return new Response(
          JSON.stringify({ suggestions: [{ placeId: "p1", label: "123 Main St, Toronto" }] }),
        );
      }
      return new Response(
        JSON.stringify({
          place: { lat: 43.6, lng: -79.4, addressLine: "123 Main St", city: "Toronto" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AddressFields
        values={{ addressLine: "" }}
        onChange={onChange}
        onResolve={onResolve}
        resolveUrl="/api/address/resolve"
        fields={["addressLine"]}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "123 Main" } });

    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument(), { timeout: 1000 });
    const option = screen.getByRole("option", { name: "123 Main St, Toronto" });
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenCalledWith({ addressLine: "123 Main St, Toronto" });
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ lat: 43.6, lng: -79.4 }));
    expect(onChange).toHaveBeenCalledWith({ addressLine: "123 Main St", city: "Toronto" });

    vi.unstubAllGlobals();
  });
});

describe("AddressFields ui slots and hooks", () => {
  it("default markup keeps shadcn input, label and postal slot", () => {
    const { container } = render(<AddressFields values={{}} onChange={vi.fn()} preset="delivery" postalSlot={<i data-testid="ps" />} />);
    expect(container.querySelector('[data-slot="input"]')).toBeTruthy();
    expect(screen.getByTestId("ps")).toBeInTheDocument();
  });

  it("uses app-supplied Field and Select", () => {
    const onChange = vi.fn();
    render(
      <AddressFields
        values={{}}
        onChange={onChange}
        fields={["addressLine", "province"]}
        ui={{
          Field: ({ label, inputProps }) => <input data-kit="f" aria-label={label} {...inputProps} />,
          Select: ({ label, onChange: c }) => <button data-kit="s" onClick={() => c("ON")}>{label}</button>,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Street address"), { target: { value: "1 A" } });
    expect(onChange).toHaveBeenCalledWith({ addressLine: "1 A" });
    fireEvent.click(document.querySelector('[data-kit="s"]')!);
    expect(onChange).toHaveBeenCalledWith({ province: "ON" });
  });

  it("useAddressFields autofills structured fields and reports lat/lng on resolve", () => {
    const onChange = vi.fn();
    const onResolve = vi.fn();
    const { result } = renderHook(() => useAddressFields({ values: {}, onChange, onResolve, fields: ["addressLine"], resolveUrl: "/api/places/resolve" }));
    const row = result.current.rows[0]!;
    expect(result.current.suggestUrl).toBe("/api/places/suggest");
    if (row.kind !== "line") throw new Error("expected line row");
    row.onResolve({ lat: 1, lng: 2, city: "Toronto" });
    expect(onChange).toHaveBeenCalledWith({ city: "Toronto" });
    expect(onResolve).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });
});
