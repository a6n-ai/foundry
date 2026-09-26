// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedAddress } from "../rules";
import { CustomerAddressesCard } from "../ui/customer-addresses-card";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const home: SavedAddress = {
  publicId: "adr_home", label: "Home", fullName: null, addressLine: "1 A St", addressUnit: null, city: "Toronto",
  province: null, postalCode: "M5V 2T6", deliveryInstructions: null, isDefault: true, lat: null, lng: null,
};

describe("CustomerAddressesCard", () => {
  afterEach(cleanup);

  it("a refused save keeps the dialog open and shows the reason inside it", async () => {
    const actions = {
      create: vi.fn().mockRejectedValue(new Error("You already have an address called Home")),
      update: vi.fn(), setDefault: vi.fn(), archive: vi.fn(),
    };
    render(<CustomerAddressesCard initial={[home]} actions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: /add address/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(within(dialog).getByText(/You already have an address called/)).toBeTruthy());
  });
});
