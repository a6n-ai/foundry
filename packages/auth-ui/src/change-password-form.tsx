"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { passwordSchema } from "@foundry/commons";
import { RevealToggle, resolveUi, type AuthUi } from "./ui";
import { ForgotCurrentPassword, type ForgotCurrentPasswordProps } from "./forgot-current-password";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirm: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/** Decoupled: the app supplies the actual better-auth call via `onChangePassword`. */
export interface ChangePasswordFormProps {
  onChangePassword: (input: { currentPassword: string; newPassword: string }) => Promise<{ error?: unknown }>;
  /**
   * Enables the "forgot your current password" escape hatch. Omit it and the
   * form behaves exactly as before — the toggle only appears when an app has
   * actually wired the OTP callbacks.
   */
  forgotCurrent?: Omit<ForgotCurrentPasswordProps, "onDone">;
  /** Restyle with the app's own primitives; defaults to the shadcn kit. */
  ui?: Partial<AuthUi>;
}

export function ChangePasswordForm({ onChangePassword, forgotCurrent, ui }: ChangePasswordFormProps) {
  const { Button, Field, Notice } = resolveUi(ui);
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [forgot, setForgot] = useState(false);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  async function onSubmit(values: ChangePasswordValues) {
    const { error } = await onChangePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (error) {
      form.setError("root", { message: "Current password is incorrect or the new password is invalid." });
      return;
    }
    toast.success("Password updated.");
    form.reset();
  }

  if (forgot && forgotCurrent) {
    return <ForgotCurrentPassword {...forgotCurrent} ui={ui} onDone={() => setForgot(false)} />;
  }

  const field = (name: "currentPassword" | "newPassword" | "confirm", key: keyof typeof show, label: string, autoComplete: string) => (
    <Field
      label={label}
      type={show[key] ? "text" : "password"}
      autoComplete={autoComplete}
      error={errors[name]?.message}
      trailing={<RevealToggle shown={show[key]} onToggle={() => setShow((s) => ({ ...s, [key]: !s[key] }))} />}
      {...form.register(name)}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-3">
      {field("currentPassword", "current", "Current password", "current-password")}
      {field("newPassword", "next", "New password", "new-password")}
      {field("confirm", "confirm", "Confirm new password", "new-password")}
      {errors.root && <Notice tone="error">{errors.root.message}</Notice>}
      <Button type="submit" variant="primary" disabled={!isDirty} pending={isSubmitting} pendingLabel="Saving..." className="w-full min-w-32 sm:w-auto">
        Change password
      </Button>
      {forgotCurrent ? (
        <button
          type="button"
          onClick={() => setForgot(true)}
          className="text-muted-foreground hover:text-foreground justify-self-start text-sm underline underline-offset-4"
        >
          Forgot your current password?
        </button>
      ) : null}
    </form>
  );
}
