"use client"

import * as React from "react"
import {
  Collapsible as SdkCollapsible,
  CollapsiblePanel,
  CollapsibleTrigger as SdkCollapsibleTrigger,
} from "@ui-sdk/react/collapsible"

function Collapsible(props: React.ComponentProps<typeof SdkCollapsible>) {
  return <SdkCollapsible {...props} />
}

function CollapsibleTrigger(props: React.ComponentProps<typeof SdkCollapsibleTrigger>) {
  return <SdkCollapsibleTrigger {...props} />
}

function CollapsibleContent(props: React.ComponentProps<typeof CollapsiblePanel>) {
  return <CollapsiblePanel {...props} />
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
