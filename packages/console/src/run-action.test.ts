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

  it("a failed refresh after a successful action is logged, not toasted as an error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await runAction(async () => {}, "Saved", async () => Promise.reject(new Error("net")), errorText)
    expect(toast.success).toHaveBeenCalledWith("Saved")
    expect(toast.error).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it("toasts the mapped error and skips invalidate", async () => {
    const invalidate = vi.fn(async () => {})
    await runAction(async () => Promise.reject(new Error("boom")), "Saved", invalidate, errorText)
    expect(toast.error).toHaveBeenCalledWith("mapped:boom")
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("treats { ok: false, code } as a refusal", async () => {
    const invalidate = vi.fn(async () => {})
    await runAction(async () => ({ ok: false, code: "nope" }), "Saved", invalidate, errorText)
    expect(toast.error).toHaveBeenCalledWith("mapped:nope")
    expect(toast.success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("treats { ok: true } as success", async () => {
    const invalidate = vi.fn(async () => {})
    await runAction(async () => ({ ok: true }), "Saved", invalidate, errorText)
    expect(toast.success).toHaveBeenCalledWith("Saved")
    expect(invalidate).toHaveBeenCalledOnce()
  })
})

describe("confirmAction", () => {
  it("rethrows with the mapped copy and does not toast", async () => {
    const invalidate = vi.fn(async () => {})
    await expect(confirmAction(async () => Promise.reject(new Error("boom")), "Done", invalidate, errorText)).rejects.toThrow("mapped:boom")
    expect(toast.success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("resolves when the refresh after a successful action fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(confirmAction(async () => {}, "Done", async () => Promise.reject(new Error("net")), errorText)).resolves.toBeUndefined()
    expect(toast.success).toHaveBeenCalledWith("Done")
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it("toasts and invalidates on success", async () => {
    const invalidate = vi.fn(async () => {})
    await confirmAction(async () => {}, "Done", invalidate, errorText)
    expect(toast.success).toHaveBeenCalledWith("Done")
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it("rejects with the mapped copy on { ok: false, code }", async () => {
    const invalidate = vi.fn(async () => {})
    await expect(confirmAction(async () => ({ ok: false, code: "nope" }), "Done", invalidate, errorText)).rejects.toThrow("mapped:nope")
    expect(toast.success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })
})
