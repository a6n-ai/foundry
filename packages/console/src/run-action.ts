import { toast } from "@foundry/ui/toast"

export async function runAction(
  action: () => Promise<unknown>,
  success: string,
  invalidate: () => Promise<void>,
  errorText: (err: unknown) => string,
): Promise<void> {
  try {
    await action()
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
  try {
    await action()
  } catch (err) {
    throw new Error(errorText(err), { cause: err })
  }
  toast.success(success)
  await invalidate()
}
