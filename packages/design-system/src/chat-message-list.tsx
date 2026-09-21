"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@foundry/ui/cn";
import { Skeleton } from "@foundry/ui/skeleton";

export type ChatAttachment = { thumbUrl: string; name: string; href: string };

export type ChatMessage = {
  id: string;
  /** "system" renders centered meta text; otherwise bubble. */
  kind: "system" | "mine" | "theirs";
  body: string;
  /** Footer under the bubble (e.g. "You · Jul 20"). */
  meta?: string;
  attachments?: ChatAttachment[] | null;
};

export interface ChatUi {
  /** Centered meta line for `kind: "system"`. */
  System: ComponentType<{ message: ChatMessage }>;
  /** One bubble + footer for `mine` / `theirs`. */
  Bubble: ComponentType<{ message: ChatMessage; mine: boolean }>;
}

function DefaultSystem({ message: m }: { message: ChatMessage }) {
  return (
    <p className="text-muted-foreground text-center text-xs text-pretty">
      {m.body}
      {m.meta ? ` · ${m.meta}` : null}
    </p>
  );
}

function DefaultBubble({ message: m, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <div className={bubbleWrap(mine)}>
      <div className={bubbleBody(mine)}>
        <p className="whitespace-pre-wrap text-pretty">{m.body}</p>
        {m.attachments?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {m.attachments.map((a, i) => (
              <a key={i} href={a.href} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.thumbUrl} alt={a.name} className="size-24 rounded-md border object-cover" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {m.meta ? <span className="text-muted-foreground text-xs">{m.meta}</span> : null}
    </div>
  );
}

export const defaultChatUi: ChatUi = { System: DefaultSystem, Bubble: DefaultBubble };

const bubbleWrap = (mine: boolean) =>
  cn("flex flex-col gap-1", mine ? "items-end" : "items-start");
const bubbleGeom = (mine: boolean) =>
  cn("max-w-[90%] rounded-2xl sm:max-w-[85%]", mine ? "rounded-br-sm" : "rounded-bl-sm");
const bubbleBody = (mine: boolean) =>
  cn(
    bubbleGeom(mine),
    "px-3.5 py-2.5 text-sm",
    mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
  );

export function ChatMessageList({
  messages,
  className,
  empty,
  ui,
}: {
  messages: ChatMessage[];
  className?: string;
  empty?: ReactNode;
  /** Restyle with the app's own primitives; defaults to the shadcn bubbles. */
  ui?: Partial<ChatUi>;
}) {
  const { System, Bubble } = ui ? { ...defaultChatUi, ...ui } : defaultChatUi;
  if (messages.length === 0) {
    return empty ? <div className={className}>{empty}</div> : null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {messages.map((m) =>
        m.kind === "system" ? <System key={m.id} message={m} /> : <Bubble key={m.id} message={m} mine={m.kind === "mine"} />,
      )}
    </div>
  );
}

const SKELETON_BUBBLES = [false, true, false, true, false, true];

export function ChatMessageListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {SKELETON_BUBBLES.map((mine, i) => (
        <div key={i} className={bubbleWrap(mine)}>
          <Skeleton className={cn(bubbleGeom(mine), "h-9 w-48")} />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
