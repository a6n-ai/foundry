import * as React from "react"

export type AsChildProps = {
  /** @deprecated ui-sdk parts take `render`; pass the element there instead. */
  asChild?: boolean
}

// The child element becomes `render`; ui-sdk merges the part's props into it, as a Slot does.
export function withAsChild<P extends AsChildProps & { children?: unknown }>(props: P): Omit<P, "asChild"> {
  const { asChild, children, ...rest } = props
  if (asChild && React.isValidElement(children)) return { ...rest, render: children } as Omit<P, "asChild">
  return { ...rest, children } as Omit<P, "asChild">
}
