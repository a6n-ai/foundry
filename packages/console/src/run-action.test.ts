import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@foundry/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "@foundry/ui/toast"
import { confirmAction, runAction } from "./run-action"

const errorText = (e: unknown) => `mapped:${(e as Error).message}`

beforeEach(() => vi.clearAllMocks())

describe("runAction", () => {
  it("toasts success then invalidates", async () => {
    const invalidate = vi.fn(async () => {})
    await runAction(async () => {}, "Saved", invalidate, errorText)
    expect(toast.success).toHaveBeenCalledWith("Saved")
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it("toasts the mapped error and skips invalidate", async () => {
    const invalidate = vi.fn(async () => {})
    await runAction(async () => Promise.reject(new Error("boom")), "Saved", invalidate, errorText)
    expect(toast.error).toHaveBeenCalledWith("mapped:boom")
    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe("confirmAction", () => {
  it("rethrows with the mapped copy and does not toast", async () => {
    const invalidate = vi.fn(async () => {})
    await expect(confirmAction(async () => Promise.reject(new Error("boom")), "Done", invalidate, errorText)).rejects.toThrow("mapped:boom")
    expect(toast.success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("toasts and invalidates on success", async () => {
    const invalidate = vi.fn(async () => {})
    await confirmAction(async () => {}, "Done", invalidate, errorText)
    expect(toast.success).toHaveBeenCalledWith("Done")
    expect(invalidate).toHaveBeenCalledOnce()
  })
})
