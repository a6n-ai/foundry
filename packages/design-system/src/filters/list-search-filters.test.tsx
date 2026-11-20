// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => "/orders",
  useSearchParams: () => new URLSearchParams(search),
}));

import { ListSearchFilters } from "./list-search-filters";
import type { FacetDef } from "./facet";

const spec: FacetDef[] = [
  { kind: "search", fields: ["name"] },
  { kind: "select", field: "status", label: "Status", options: [{ value: "late", label: "Late" }] },
  { kind: "multi", field: "source", label: "Source", options: [{ value: "web", label: "Web" }] },
  { kind: "dateRange", field: "createdAt", label: "Created" },
];

beforeEach(() => {
  search = "";
  replace.mockClear();
});
afterEach(cleanup);

describe("ListSearchFilters", () => {
  it("shows pinned facets as empty chips and relabels the add button", () => {
    render(<ListSearchFilters spec={spec} pinned={["status"]} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("More filters")).toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
  });

  it("a numeric pinned count pins the first facets, skipping search", () => {
    render(<ListSearchFilters spec={spec} pinned={2} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
  });

  it("clearValues sentinel is not shown as an active chip, a real value is", () => {
    search = "status=off";
    const { unmount } = render(<ListSearchFilters spec={spec} clearValues={{ status: "off" }} />);
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    unmount();
    search = "status=late";
    render(<ListSearchFilters spec={spec} clearValues={{ status: "off" }} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("dateControl=inline renders the page's date slot, external and menu do not", () => {
    const slot = <i data-testid="date-slot" />;
    const { rerender } = render(<ListSearchFilters spec={spec} dateControl="inline" dateSlot={slot} />);
    expect(screen.getByTestId("date-slot")).toBeInTheDocument();
    rerender(<ListSearchFilters spec={spec} dateControl="external" dateSlot={slot} />);
    expect(screen.queryByTestId("date-slot")).not.toBeInTheDocument();
    rerender(<ListSearchFilters spec={spec} dateControl="menu" dateSlot={slot} />);
    expect(screen.queryByTestId("date-slot")).not.toBeInTheDocument();
  });

  it("hides the date chip when the page owns the date control", () => {
    search = "from=100&to=200";
    const DateField = () => <i data-testid="menu-date" />;
    const { unmount } = render(<ListSearchFilters spec={spec} DateField={DateField} />);
    expect(screen.getByTestId("menu-date")).toBeInTheDocument();
    unmount();
    render(<ListSearchFilters spec={spec} dateControl="external" DateField={DateField} />);
    expect(screen.queryByTestId("menu-date")).not.toBeInTheDocument();
  });

  it("renders recommended presets and applies one on click, dropping stale picks and page", async () => {
    search = "status=stale&page=2&q=x";
    const recommendations = {
      load: vi.fn(async () => [{ key: "late", label: "Late orders", params: { status: "late" } }]),
      record: vi.fn(async () => undefined),
    };
    render(<ListSearchFilters spec={spec} recommendations={recommendations} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Late orders" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = new URL(replace.mock.calls[0]![0] as string, "http://x");
    expect(url.pathname).toBe("/orders");
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: "late", q: "x" });
  });

  it("renders no preset group when recommendations return nothing", async () => {
    const recommendations = { load: vi.fn(async () => []), record: vi.fn(async () => undefined) };
    render(<ListSearchFilters spec={spec} recommendations={recommendations} />);
    await waitFor(() => expect(recommendations.load).toHaveBeenCalled());
    expect(screen.queryByLabelText("Recommended filters")).not.toBeInTheDocument();
  });

  it("Add Filter opens a searchable list of fields", async () => {
    render(<ListSearchFilters spec={spec} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Add Filter" }), { button: 0, ctrlKey: false });
    expect(await screen.findByPlaceholderText("Filter by…")).toBeInTheDocument();
  });

  it("picking a value in a chip writes the same ?param as before", async () => {
    render(<ListSearchFilters spec={spec} pinned={["status"]} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Select..." }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("option", { name: "Late" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = new URL(replace.mock.calls[0]![0] as string, "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: "late" });
  });

  it("an active chip reads Key Value with no operator and × removes it", async () => {
    search = "status=late";
    render(<ListSearchFilters spec={spec} />);
    const chip = screen.getByText("Status").closest('[data-slot="filter-chip"]') as HTMLElement;
    expect(chip).toHaveTextContent("StatusLate");
    expect(within(chip).queryByRole("button", { name: "is" })).not.toBeInTheDocument();
    fireEvent.click(within(chip).getByRole("button", { name: "Remove Status" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(new URL(replace.mock.calls[0]![0] as string, "http://x").search).toBe("");
  });

  it("a recommended preset is a dashed suggestion pill", async () => {
    const recommendations = {
      load: vi.fn(async () => [{ key: "late", label: "Late orders", params: { status: "late" } }]),
      record: vi.fn(async () => undefined),
    };
    render(<ListSearchFilters spec={spec} recommendations={recommendations} />);
    expect(await screen.findByRole("radio", { name: "Late orders" })).toHaveAttribute("data-slot", "filter-suggestion");
  });

  it("the date range is still its own chip", () => {
    search = "from=100&to=200";
    const DateField = () => <i data-testid="menu-date" />;
    render(<ListSearchFilters spec={spec} DateField={DateField} />);
    const chip = screen.getByText("Created").closest('[data-slot="filter-chip"]');
    expect(chip).toContainElement(screen.getByTestId("menu-date"));
  });
});
