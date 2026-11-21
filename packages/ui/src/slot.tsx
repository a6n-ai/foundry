import * as React from "react"

import { cn } from "./cn"

type AnyProps = Record<string, any>

function Slottable({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function isSlottable(child: React.ReactNode): child is React.ReactElement<{ children?: React.ReactNode }> {
  return React.isValidElement(child) && child.type === Slottable
}

function setRef(ref: unknown, node: unknown) {
  if (typeof ref === "function") ref(node)
  else if (ref) (ref as { current: unknown }).current = node
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps) {
  const merged = { ...slotProps, ...childProps }
  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key]
    const childValue = childProps[key]
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function" && typeof childValue === "function") {
      merged[key] = (...args: unknown[]) => {
        const result = childValue(...args)
        const event = args[0] as { defaultPrevented?: boolean } | undefined
        if (!event?.defaultPrevented) slotValue(...args)
        return result
      }
    } else if (key === "style") {
      merged.style = { ...slotValue, ...childValue }
    } else if (key === "className") {
      merged.className = cn(slotValue, childValue)
    } else if (key === "ref") {
      merged.ref = (node: unknown) => {
        setRef(slotValue, node)
        setRef(childValue, node)
      }
    }
  }
  return merged
}

// Radix Slot semantics without Radix: the single child (or the <Slottable> child) receives the slot's props.
// Unlike Radix, the slot handler is skipped when the child's handler called preventDefault.
function Slot({ children, ...slotProps }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode; ref?: React.Ref<any> }) {
  const items = React.Children.toArray(children)
  const slottable = items.find(isSlottable)
  const element = slottable ? slottable.props.children : children
  if (!React.isValidElement<AnyProps>(element)) return <>{element}</>
  const content = slottable
    ? items.map((child) => (child === slottable ? element.props.children : child))
    : element.props.children
  return React.cloneElement(element, mergeProps(slotProps, element.props), content)
}

export { Slot, Slottable }
