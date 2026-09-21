"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Controller } from "react-hook-form";
import { pinSchema } from "@foundry/commons";
import { RevealToggle, resolveUi, type AuthUi } from "./ui";
import { useState } from "react";

type Result = { ok: boolean; message?: string };

export interface PinFormProps {
  hasPin: boolean;
  onSetPin: (currentPassword: string, pin: string) => Promise<Result>;
  onRemovePin: (currentPassword: string) => Promise<Result>;
  ui?: Partial<AuthUi>;
}

const setSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPin: pinSchema,
    confirm: z.string().min(1, "Please confirm your PIN"),
  })
  .refine((d) => d.newPin === d.confirm, { message: "PINs do not match", path: ["confirm"] });
const removeSchema = z.object({ currentPassword: z.string().min(1, "Current password is required") });

export function PinForm({ hasPin, onSetPin, onRemovePin, ui }: PinFormProps) {
  const { Button, Field, Code, Notice } = resolveUi(ui);
  const [show, setShow] = useState(false);
  const setForm = useForm<z.infer<typeof setSchema>>({
    resolver: zodResolver(setSchema),
    defaultValues: { currentPassword: "", newPin: "", confirm: "" },
  });
  const removeForm = useForm<z.infer<typeof removeSchema>>({
    resolver: zodResolver(removeSchema),
    defaultValues: { currentPassword: "" },
  });
  const se = setForm.formState;
  const re = removeForm.formState;
  const reveal = <RevealToggle shown={show} onToggle={() => setShow((v) => !v)} />;

  async function onSet(v: z.infer<typeof setSchema>) {
    const res = await onSetPin(v.currentPassword, v.newPin);
    if (!res.ok) return setForm.setError("root", { message: res.message ?? "Could not set the PIN." });
    toast.success(hasPin ? "PIN updated." : "PIN set.");
    setForm.reset();
  }
  async function onRemove(v: z.infer<typeof removeSchema>) {
    const res = await onRemovePin(v.currentPassword);
    if (!res.ok) return removeForm.setError("root", { message: res.message ?? "Could not remove the PIN." });
    toast.success("PIN removed.");
    removeForm.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium">{hasPin ? "Update PIN" : "Set a PIN"}</h3>
        <Notice tone="muted">A 4-digit PIN re-unlocks your session without a full sign-in.</Notice>
      </div>
      <form onSubmit={setForm.handleSubmit(onSet)} className="grid max-w-md gap-3">
        <Field label="Current password" type={show ? "text" : "password"} trailing={reveal} error={se.errors.currentPassword?.message} {...setForm.register("currentPassword")} />
        <Controller control={setForm.control} name="newPin" render={({ field }) => (
          <Code label="New PIN" length={4} masked value={field.value} onChange={field.onChange} error={se.errors.newPin?.message} />
        )} />
        <Controller control={setForm.control} name="confirm" render={({ field }) => (
          <Code label="Confirm PIN" length={4} masked value={field.value} onChange={field.onChange} error={se.errors.confirm?.message} />
        )} />
        {se.errors.root && <Notice tone="error">{se.errors.root.message}</Notice>}
        <Button type="submit" variant="primary" disabled={!se.isDirty} pending={se.isSubmitting} className="w-full min-w-32 sm:w-auto">
          {se.isSubmitting ? "Saving..." : hasPin ? "Update PIN" : "Set PIN"}
        </Button>
      </form>
      {hasPin && (
        <form onSubmit={removeForm.handleSubmit(onRemove)} className="grid max-w-md gap-3">
          <Field label="Current password" type={show ? "text" : "password"} trailing={reveal} error={re.errors.currentPassword?.message} {...removeForm.register("currentPassword")} />
          {re.errors.root && <Notice tone="error">{re.errors.root.message}</Notice>}
          <Button type="submit" variant="danger" disabled={!re.isDirty} pending={re.isSubmitting} className="w-full min-w-32 sm:w-auto">
            {re.isSubmitting ? "Removing..." : "Remove PIN"}
          </Button>
        </form>
      )}
    </div>
  );
}
