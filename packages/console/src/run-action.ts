import { toast } from "@foundry/ui/toast"

// Server actions return { ok: false, code } for expected refusals instead of throwing.
function refusal(result: unknown): string | null {
  if (typeof result !== "object" || result === null || !("ok" in result) || result.ok !== false) return null
  return "code" in result && typeof result.code === "string" ? result.code : ""
}

export async function runAction(
  action: () => Promise<unknown>,
  success: string,
  invalidate: () => Promise<void>,
  errorText: (err: unknown) => string,
): Promise<void> {
  try {
    const code = refusal(await action())
    if (code !== null) {
      toast.error(errorText(new Error(code)))
      return
    }
    toast.success(success)
    await invalidate()
  } catch (err) {
    toast.error(errorText(err))
  }
}

// For a confirm dialog: rejects with the mapped copy so the dialog shows it inline.
export async function confirmAction(
  action: () => Promise<unknown>,
  success: string,
  invalidate: () => Promise<void>,
  errorText: (err: unknown) => string,
): Promise<void> {
  let code: string | null
  try {
    code = refusal(await action())
  } catch (err) {
    throw new Error(errorText(err), { cause: err })
  }
  if (code !== null) throw new Error(errorText(new Error(code)))
  toast.success(success)
  await invalidate()
}
