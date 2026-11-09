"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { makeImageThumbnail } from "./make-image-thumbnail";

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 4;

export type MessageComposerTyping = { peerTyping: boolean; notifyTyping: () => void };

export const COMPOSER_LIMITS = { accept: ACCEPT, maxBytes: MAX_BYTES, maxFiles: MAX_FILES };

/**
 * Headless reply-composer logic: body, validated image picks, thumbnailed
 * FormData submit. Draw it with any kit; pass the result of `useTyping` as `typing`
 * to show and send typing indicators.
 */
export function useMessageComposer({
  action,
  typing,
  makeThumbnail = makeImageThumbnail,
}: {
  action: (form: FormData) => Promise<void>;
  typing?: MessageComposerTyping;
  makeThumbnail?: (file: File) => Promise<File>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        // The request never reached the server (weak signal, big photos). Each browser
        // words it differently: Chrome "Failed to fetch", Safari "Load failed", Firefox "NetworkError…".
        if (e instanceof TypeError && /failed to fetch|load failed|networkerror/i.test(e.message)) {
          setError("Upload interrupted — check your connection and try again. Fewer or smaller photos help.");
          return;
        }
        setError(e instanceof Error ? e.message : "Couldn't send your reply. Please try again.");
      }
    });
  }

  return {
    body,
    onBodyChange: (v: string) => {
      setBody(v);
      typing?.notifyTyping();
    },
    files,
    removeFile: (i: number) => setFiles((fs) => fs.filter((_, j) => j !== i)),
    inputRef,
    addFiles,
    pending,
    error,
    peerTyping: Boolean(typing?.peerTyping),
    submit,
  };
}

