import * as React from "react"
import { renderElement } from "@ui-sdk/react/primitive"

function Rendered({
  tag,
  render,
  ...props
}: Record<string, any> & { tag: string; render?: React.ReactElement }) {
  return renderElement(tag, props, render)
}

export { Rendered }
