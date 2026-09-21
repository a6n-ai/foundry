"use client";

import { useRef, useState, useTransition, type ChangeEvent, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PaperclipIcon, SendIcon, XIcon } from "lucide-react";
import type { RealtimeRole } from "@foundry/realtime";
import { useTyping } from "@foundry/realtime/client";
import { Button } from "@foundry/ui/button";
import { Textarea } from "@foundry/ui/textarea";
import { makeImageThumbnail } from "./make-image-thumbnail";

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 4;

export type MessageComposerProps = {
  action: (form: FormData) => Promise<void>;
  closed: boolean;
  placeholder?: string;
  channel?: string;
  peerRole?: RealtimeRole;
  /** Shown when `closed` is true. */
  closedMessage?: string;
  /** Override browser thumbnail helper (defaults to makeImageThumbnail). */
  makeThumbnail?: (file: File) => Promise<File>;
  submitLabel?: string;
  submittingLabel?: string;
  /** Restyle with the app's own primitives; defaults to the shadcn kit. */
  ui?: Partial<ComposerUi>;
};

export interface ComposerTextareaProps {
  value: string;
  placeholder: string;
  rows: number;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}
export interface ComposerButtonProps {
  variant: "outline" | "primary";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}
export interface ComposerFilesProps {
  files: File[];
  onRemove: (index: number) => void;
}
export interface ComposerUi {
  Textarea: ComponentType<ComposerTextareaProps>;
  Button: ComponentType<ComposerButtonProps>;
  Notice: ComponentType<{ tone: "error" | "muted"; children: ReactNode }>;
  Files: ComponentType<ComposerFilesProps>;
}

const DefaultTextarea = (p: ComposerTextareaProps) => <Textarea {...p} />;
const DefaultButton = ({ variant, disabled, onClick, children }: ComposerButtonProps) =>
  variant === "outline" ? (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>{children}</Button>
  ) : (
    <Button onClick={onClick} disabled={disabled} className="w-fit active:scale-[0.98]">{children}</Button>
  );
const DefaultNotice = ({ tone, children }: { tone: "error" | "muted"; children: ReactNode }) =>
  tone === "error" ? (
    <p className="text-destructive text-sm" role="alert">{children}</p>
  ) : (
    <p className="text-muted-foreground text-xs">{children}</p>
  );
const DefaultFiles = ({ files, onRemove }: ComposerFilesProps) => (
  <div className="flex flex-wrap gap-2">
    {files.map((f, i) => (
      <span key={i} className="bg-muted flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
        {f.name}
        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)} className="text-muted-foreground hover:text-foreground">
          <XIcon className="size-3" />
        </button>
      </span>
    ))}
  </div>
);

export const defaultComposerUi: ComposerUi = { Textarea: DefaultTextarea, Button: DefaultButton, Notice: DefaultNotice, Files: DefaultFiles };

export const COMPOSER_LIMITS = { accept: ACCEPT, maxBytes: MAX_BYTES, maxFiles: MAX_FILES };

/**
 * Headless reply-composer logic: body, validated image picks, thumbnailed
 * FormData submit, realtime typing. Draw it with any kit.
 */
export function useMessageComposer({
  action,
  channel,
  peerRole,
  makeThumbnail = makeImageThumbnail,
}: Pick<MessageComposerProps, "action" | "channel" | "peerRole" | "makeThumbnail">) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Hooks can't be conditional: call with a possibly-empty channel; useChannel no-ops on empty.
  const { peerTyping, notifyTyping } = useTyping(channel ?? "", peerRole ?? "staff");

  function addFiles(picked: FileList | null) {
    if (!picked) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(picked)) {
      if (next.length >= MAX_FILES) {
        setError(`Attach up to ${MAX_FILES} images`);
        break;
      }
      if (!ACCEPT.includes(f.type)) {
        setError("Only PNG, JPEG, WebP or GIF images are allowed");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError("Each image must be 5 MB or smaller");
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit() {
    const trimmed = body.trim();
    if (!trimmed && files.length === 0) return setError("Type a message or attach an image.");
    setError(null);
    start(async () => {
      try {
        const form = new FormData();
        form.set("body", trimmed);
        for (const f of files) {
          const thumb = await makeThumbnail(f);
          form.append("attachment", f);
          form.append("attachment_thumb", thumb, thumb.name);
        }
        await action(form);
        setBody("");
        setFiles([]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't send your reply. Please try again.");
      }
    });
  }

  return {
    body,
    onBodyChange: (v: string) => {
      setBody(v);
      if (channel) notifyTyping();
    },
    files,
    removeFile: (i: number) => setFiles((fs) => fs.filter((_, j) => j !== i)),
    inputRef,
    addFiles,
    pending,
    error,
    peerTyping: Boolean(channel && peerTyping),
    submit,
  };
}



/**
 * Reply composer with optional image attachments + realtime typing.
 * Apps inject the server action; FormData keys: `body`, `attachment[]`, `attachment_thumb[]`.
 */
export function MessageComposer({
  action,
  closed,
  placeholder = "Write a reply…",
  channel,
  peerRole,
  closedMessage = "This conversation is closed.",
  makeThumbnail = makeImageThumbnail,
  submitLabel = "Send reply",
  submittingLabel = "Sending…",
  ui,
}: MessageComposerProps) {
  const { Textarea: TextareaSlot, Button: ButtonSlot, Notice, Files } = ui ? { ...defaultComposerUi, ...ui } : defaultComposerUi;
  const c = useMessageComposer({ action, channel, peerRole, makeThumbnail });

  if (closed) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">{closedMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      {c.peerTyping ? <Notice tone="muted">Typing…</Notice> : null}
      <TextareaSlot rows={3} placeholder={placeholder} value={c.body} onChange={(e) => c.onBodyChange(e.target.value)} />
      {c.files.length > 0 ? <Files files={c.files} onRemove={c.removeFile} /> : null}
      {c.error ? <Notice tone="error">{c.error}</Notice> : null}
      <div className="flex items-center gap-2">
        <input ref={c.inputRef} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => c.addFiles(e.target.files)} />
        <ButtonSlot variant="outline" disabled={c.pending || c.files.length >= MAX_FILES} onClick={() => c.inputRef.current?.click()}>
          <PaperclipIcon className="size-4" /> Attach
        </ButtonSlot>
        <ButtonSlot variant="primary" disabled={c.pending} onClick={c.submit}>
          {c.pending ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
          {c.pending ? submittingLabel : submitLabel}
        </ButtonSlot>
      </div>
    </div>
  );
}
