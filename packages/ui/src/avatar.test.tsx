// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./avatar"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup(props: { delay?: number } = {}) {
  render(
    <Avatar data-testid="root" className="custom" size="lg">
      <AvatarImage src="/a.png" alt="Ada" />
      <AvatarFallback {...props}>AL</AvatarFallback>
    </Avatar>
  )
  return screen.getByRole("img", { hidden: true })
}

describe("Avatar", () => {
  it("shows the fallback before the image loads and keeps slots, size and className", () => {
    setup()
    const root = screen.getByTestId("root")
    expect(root).toHaveAttribute("data-slot", "avatar")
    expect(root).toHaveAttribute("data-size", "lg")
    expect(root).toHaveClass("custom")
    expect(screen.getByText("AL")).toHaveAttribute("data-slot", "avatar-fallback")
  })

  it("swaps the fallback for the image once it loads", () => {
    const img = setup()
    expect(img).toHaveAttribute("data-slot", "avatar-image")
    fireEvent.load(img)
    expect(screen.queryByText("AL")).toBeNull()
    expect(screen.getByRole("img", { name: "Ada" })).toBeInTheDocument()
  })

  it("keeps the fallback after an error", () => {
    const img = setup()
    fireEvent.error(img)
    expect(screen.getByText("AL")).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: "Ada" })).toBeNull()
  })

  it("waits delay before showing the fallback", async () => {
    vi.useFakeTimers()
    render(
      <Avatar>
        <AvatarFallback delay={500}>AL</AvatarFallback>
      </Avatar>
    )
    expect(screen.queryByText("AL")).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("renders badge and group extras", () => {
    render(
      <AvatarGroup data-testid="g">
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
          <AvatarBadge data-testid="b" />
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>
    )
    expect(screen.getByTestId("g")).toHaveAttribute("data-slot", "avatar-group")
    expect(screen.getByTestId("b")).toHaveAttribute("data-slot", "avatar-badge")
    expect(screen.getByText("+2")).toHaveAttribute("data-slot", "avatar-group-count")
  })
})
