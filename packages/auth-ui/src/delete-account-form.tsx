"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resolveUi, type AuthUi } from "./ui";

type Result = { error?: unknown };

/**
 * Decoupled danger-zone account deletion. The app wires `onDelete` to its
 * better-auth client. Requires re-entering the password and typing DELETE, so a
 * permanent action can't be a single misclick.
 */
export interface DeleteAccountFormProps {
  onDelete: (input: { password: string }) => Promise<Result>;
  onSuccess?: () => void;
  ui?: Partial<AuthUi>;
}

const schema = z
  .object({
    password: z.string().min(1, "Enter your password to confirm"),
    confirm: z.string(),
  })
  .refine((d) => d.confirm === "DELETE", { message: "Type DELETE to confirm", path: ["confirm"] });

export function DeleteAccountForm({ onDelete, onSuccess, ui }: DeleteAccountFormProps) {
  const { Button, Field, Notice } = resolveUi(ui);
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    const res = await onDelete({ password: values.password });
    if (res.error) {
      form.setError("password", { message: "Incorrect password, or your account can't be deleted here." });
      return;
    }
    onSuccess?.();
  }

  if (!open) {
    return (
      <Button type="button" variant="danger" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Delete account
      </Button>
    );
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-3">
      <Notice tone="muted">This permanently deletes your account and cannot be undone.</Notice>
      <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...form.register("password")} />
      <Field label="Type DELETE to confirm" autoComplete="off" placeholder="DELETE" error={errors.confirm?.message} {...form.register("confirm")} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" variant="danger" pending={isSubmitting}>Permanently delete</Button>
      </div>
    </form>
  );
}
