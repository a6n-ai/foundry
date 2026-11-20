// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

beforeAll(() => {
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = function () {};
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover][data-open] { display: block !important }",
    })
  );
});

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
  it("shows pinned facets as empty chips and keeps the add button label", () => {
    render(<ListSearchFilters spec={spec} pinned={["status"]} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Filter" })).toBeInTheDocument();
    expect(screen.queryByText("More filters")).not.toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
  });

  it("the add button carries a filter icon", () => {
    render(<ListSearchFilters spec={spec} />);
    expect(screen.getByRole("button", { name: "Add Filter" }).querySelector(".lucide-list-filter")).not.toBeNull();
  });

  it("an empty pinned facet is a dashed key-only chip with no remove button", () => {
    render(<ListSearchFilters spec={spec} pinned={["status"]} />);
    const chip = screen.getByText("Status").closest('[data-slot="filter-chip"]') as HTMLElement;
    expect(chip).toHaveAttribute("data-empty");
    expect(within(chip).queryByRole("button", { name: "Remove Status" })).not.toBeInTheDocument();
  });

  it("an active chip has no data-empty marker", () => {
    search = "status=late";
    render(<ListSearchFilters spec={spec} />);
    const chip = screen.getByText("Late").closest('[data-slot="filter-chip"]') as HTMLElement;
    expect(chip).not.toHaveAttribute("data-empty");
  });

  it("after × removes a chip, focus moves to the Add Filter button", async () => {
    search = "status=late";
    render(<ListSearchFilters spec={spec} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Status" }));
    expect(screen.getByRole("button", { name: "Add Filter" })).toHaveFocus();
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

  it("picking a value in an empty pinned chip writes the same ?param and shows the remove button", async () => {
    render(<ListSearchFilters spec={spec} pinned={["status"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Late" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = new URL(replace.mock.calls[0]![0] as string, "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: "late" });
    expect(await screen.findByRole("button", { name: "Remove Status" })).toBeInTheDocument();
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

  it("× on a pinned chip with a value clears it back to the empty pinned chip", async () => {
    search = "status=late";
    render(<ListSearchFilters spec={spec} pinned={["status"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Status" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(new URL(replace.mock.calls[0]![0] as string, "http://x").search).toBe("");
    const chip = screen.getByText("Status").closest('[data-slot="filter-chip"]') as HTMLElement;
    expect(chip).toHaveAttribute("data-empty");
    expect(within(chip).queryByRole("button", { name: "Remove Status" })).not.toBeInTheDocument();
  });

  it("an empty unpinned chip keeps its × and removing it drops the chip", async () => {
    const DateField = () => <i data-testid="menu-date" />;
    render(<ListSearchFilters spec={spec} DateField={DateField} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Filter" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Created" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove Created" }));
    expect(screen.queryByRole("button", { name: "Remove Created" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("menu-date")).not.toBeInTheDocument();
  });

  it("the date range is still its own chip", () => {
    search = "from=100&to=200";
    const DateField = () => <i data-testid="menu-date" />;
    render(<ListSearchFilters spec={spec} DateField={DateField} />);
    const chip = screen.getByText("Created").closest('[data-slot="filter-chip"]');
    expect(chip).toContainElement(screen.getByTestId("menu-date"));
  });
});
