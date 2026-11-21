"use client"

import * as React from "react"
import {
  Collapsible as SdkCollapsible,
  CollapsiblePanel,
  CollapsibleTrigger as SdkCollapsibleTrigger,
} from "@ui-sdk/react/collapsible"
import { type AsChildProps, withAsChild } from "./as-child"

function Collapsible(props: React.ComponentProps<typeof SdkCollapsible> & AsChildProps) {
  return <SdkCollapsible {...withAsChild(props)} />
}

function CollapsibleTrigger(props: React.ComponentProps<typeof SdkCollapsibleTrigger> & AsChildProps) {
  return <SdkCollapsibleTrigger {...withAsChild(props)} />
}

function CollapsibleContent(props: React.ComponentProps<typeof CollapsiblePanel>) {
  return <CollapsiblePanel {...props} />
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
