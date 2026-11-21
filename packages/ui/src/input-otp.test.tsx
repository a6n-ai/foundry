// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "./input-otp"

beforeAll(() => {
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

function Code(props: Partial<React.ComponentProps<typeof InputOTP>>) {
  return (
    <InputOTP maxLength={6} aria-label="Code" {...props}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  )
}

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })

const input = () => screen.getByLabelText("Code") as HTMLInputElement
const slots = () => [...document.querySelectorAll('[data-slot="otp-input-slot"]')]

describe("InputOTP", () => {
  it("renders ui-sdk slots and a one-time-code input", async () => {
    render(<Code name="code" />)
    await settle()
    expect(document.querySelector('[data-slot="otp-input"]')).not.toBeNull()
    expect(slots()).toHaveLength(6)
    expect(document.querySelector('[data-slot="otp-input-separator"]')).not.toBeNull()
    expect(input()).toHaveAttribute("autocomplete", "one-time-code")
    expect(input()).toHaveAttribute("name", "code")
    expect(input().maxLength).toBe(6)
  })

  it("types digits into the slots and calls onChange", async () => {
    const onChange = vi.fn()
    render(<Code onChange={onChange} />)
    fireEvent.input(input(), { target: { value: "123" } })
    await settle()
    expect(onChange).toHaveBeenLastCalledWith("123")
    expect(slots().map((s) => s.textContent)).toEqual(["1", "2", "3", "", "", ""])
  })

  it("ignores characters outside the pattern", async () => {
    const onChange = vi.fn()
    render(<Code onChange={onChange} />)
    fireEvent.input(input(), { target: { value: "1a2" } })
    await settle()
    expect(input().value).not.toContain("a")
  })

  it("accepts a whole-string regex pattern, as input-otp did", async () => {
    render(<Code pattern="^[a-z]+$" />)
    fireEvent.input(input(), { target: { value: "ab" } })
    await settle()
    expect(slots().slice(0, 2).map((s) => s.textContent)).toEqual(["a", "b"])
    fireEvent.input(input(), { target: { value: "ab1" } })
    await settle()
    expect(slots()[2].textContent).toBe("")
  })

  it("calls onComplete once every slot is filled", async () => {
    const onComplete = vi.fn()
    render(<Code onComplete={onComplete} />)
    fireEvent.input(input(), { target: { value: "12345" } })
    await settle()
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.input(input(), { target: { value: "123456" } })
    await settle()
    expect(onComplete).toHaveBeenCalledWith("123456")
  })

  it("fills from a paste and keeps only maxLength characters", async () => {
    const onChange = vi.fn()
    const onComplete = vi.fn()
    render(<Code maxLength={4} onChange={onChange} onComplete={onComplete} />)
    fireEvent.paste(input(), { clipboardData: { getData: () => "98765" } })
    await settle()
    expect(onChange).toHaveBeenLastCalledWith("9876")
    expect(onComplete).toHaveBeenCalledWith("9876")
  })

  it("round-trips a controlled value", async () => {
    function Controlled() {
      const [v, setV] = useState("")
      return <Code value={v} onChange={(x) => setV(x)} />
    }
    render(<Controlled />)
    fireEvent.input(input(), { target: { value: "42" } })
    await settle()
    expect(input().value).toBe("42")
    expect(slots()[1].textContent).toBe("2")
  })

  it("masks filled slots", async () => {
    render(
      <InputOTP maxLength={2} aria-label="Code" defaultValue="12">
        <InputOTPGroup>
          <InputOTPSlot index={0} masked />
          <InputOTPSlot index={1} masked />
        </InputOTPGroup>
      </InputOTP>
    )
    expect(slots().map((s) => s.textContent)).toEqual(["•", "•"])
  })

  it("autofocuses and can be disabled", async () => {
    const { rerender } = render(<Code autoFocus />)
    expect(document.activeElement).toBe(input())
    rerender(<Code disabled />)
    expect(input()).toBeDisabled()
  })

  it("uses state attributes and no transition-all or data-state", async () => {
    render(<Code defaultValue="1" autoFocus />)
    expect(slots()[0]).toHaveAttribute("data-filled")
    for (const slot of slots()) {
      expect(slot.className).not.toMatch(/transition-all|data-\[active=true\]/)
    }
    expect(document.querySelector("[data-state]")).toBeNull()
  })
})
