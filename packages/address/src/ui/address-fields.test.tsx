// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddressFields } from "./address-fields";

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

describe("AddressFields ui slots", () => {
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
          Spinner: () => null,
          Select: ({ label, onChange: c }) => <button data-kit="s" onClick={() => c("ON")}>{label}</button>,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Street address"), { target: { value: "1 A" } });
    expect(onChange).toHaveBeenCalledWith({ addressLine: "1 A" });
    fireEvent.click(document.querySelector('[data-kit="s"]')!);
    expect(onChange).toHaveBeenCalledWith({ province: "ON" });
  });

  it("a resolve never replaces a longer typed postal code or blanks a field", async () => {
    const onChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.endsWith("/suggest")
        ? { suggestions: [{ placeId: "p1", label: "1 Yonge St" }] }
        : { place: { lat: 1, lng: 2, addressLine: "1 Yonge St", postalCode: "M4N" } }))));
    render(
      <AddressFields
        values={{ postalCode: "M4N 3M5", city: "Toronto" }}
        onChange={onChange}
        resolveUrl="/api/places/resolve"
        fields={["addressLine"]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1 Yonge" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: "1 Yonge St" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ addressLine: "1 Yonge St" }));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ postalCode: expect.anything() }));
    vi.unstubAllGlobals();
  });
});
