import * as React from "react"

import { cn } from "./cn"

type AnyProps = Record<string, any>

function Slottable({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function isSlottable(child: React.ReactNode): child is React.ReactElement<{ children?: React.ReactNode }> {
  return React.isValidElement(child) && child.type === Slottable
}

// Returns a React 19 callback-ref cleanup when the ref gave one, so the composed ref can hand it back.
function setRef(ref: unknown, node: unknown): (() => void) | undefined {
  if (typeof ref === "function") {
    const cleanup = ref(node)
    return typeof cleanup === "function" ? cleanup : undefined
  }
  if (ref) (ref as { current: unknown }).current = node
  return undefined
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps) {
  const merged = { ...slotProps, ...childProps }
  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key]
    const childValue = childProps[key]
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function" && typeof childValue === "function") {
      merged[key] = (...args: unknown[]) => {
        const result = childValue(...args)
        slotValue(...args)
        return result
      }
    } else if (key === "style") {
      merged.style = { ...slotValue, ...childValue }
    } else if (key === "className") {
      merged.className = cn(slotValue, childValue)
    } else if (key === "ref") {
      merged.ref = (node: unknown) => {
        const cleanups = [setRef(slotValue, node), setRef(childValue, node)]
        if (!cleanups.some(Boolean)) return undefined
        return () =>
          cleanups.forEach((cleanup, i) => (cleanup ? cleanup() : setRef(i === 0 ? slotValue : childValue, null)))
      }
    }
  }
  return merged
}

// Slot semantics: the single child (or the <Slottable> child) receives the slot's props.
// Handlers compose child first, then slot, always (slot handlers check defaultPrevented themselves).
function Slot({ children, ...slotProps }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode; ref?: React.Ref<any> }) {
  const items = React.Children.toArray(children)
  const slottable = items.find(isSlottable)
  // Throws here: several children with no Slottable would silently drop every slot prop.
  if (!slottable && items.length > 1) React.Children.only(null)
  const element = slottable ? slottable.props.children : children
  if (!React.isValidElement<AnyProps>(element)) return <>{element}</>
  const content = slottable
    ? items.map((child) => (child === slottable ? element.props.children : child))
    : element.props.children
  return React.cloneElement(element, mergeProps(slotProps, element.props), content)
}

export { Slot, Slottable }
