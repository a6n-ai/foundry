"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { resolveUi, type AuthUi } from "./ui";

type Result = { error?: unknown };

/**
 * Decoupled OTP email change with current-email confirmation:
 *  1. enter new email  -> onSendCurrentOtp() emails a code to the CURRENT address
 *  2. enter that code  -> onRequestChange() verifies it and emails a code to the NEW address
 *  3. enter that code  -> onConfirmChange() switches the account email
 */
export interface ChangeEmailFormProps {
  currentEmail?: string | null;
  onSendCurrentOtp: () => Promise<Result>;
  onRequestChange: (input: { newEmail: string; otp: string }) => Promise<Result>;
  onConfirmChange: (input: { newEmail: string; otp: string }) => Promise<Result>;
  onSuccess?: () => void;
  ui?: Partial<AuthUi>;
}

const emailSchema = z.object({ newEmail: z.email("Enter a valid email") });
const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

export function ChangeEmailForm(props: ChangeEmailFormProps) {
  const { Button, Field, Code, Notice } = resolveUi(props.ui);
  const [step, setStep] = useState<"email" | "current" | "new">("email");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { newEmail: "" } });
  const currentForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const newForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });

  async function startChange(values: z.infer<typeof emailSchema>) {
    setError(null);
    const res = await props.onSendCurrentOtp();
    if (res.error) { setError("Could not start the change. Try again."); return; }
    setNewEmail(values.newEmail.trim());
    setStep("current");
  }

  async function confirmCurrent(values: z.infer<typeof otpSchema>) {
    setError(null);
    const res = await props.onRequestChange({ newEmail, otp: values.code });
    if (res.error) { setError("That code is invalid or expired."); return; }
    setStep("new");
  }

  async function confirmNew(values: z.infer<typeof otpSchema>) {
    setError(null);
    const res = await props.onConfirmChange({ newEmail, otp: values.code });
    if (res.error) { setError("That code is invalid or expired."); return; }
    toast.success("Email updated.");
    props.onSuccess?.();
    setStep("email");
    emailForm.reset();
    currentForm.reset();
    newForm.reset();
  }

  const OtpStep = ({ form, onSubmit, sentTo, cta }: {
    form: ReturnType<typeof useForm<z.infer<typeof otpSchema>>>;
    onSubmit: (v: z.infer<typeof otpSchema>) => void;
    sentTo: string;
    cta: string;
  }) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-3">
      <Notice tone="muted">We sent a 6-digit code to {sentTo}.</Notice>
      <Controller control={form.control} name="code" render={({ field, fieldState }) => (
        <Code label="Verification code" length={6} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
      )} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" variant="primary" pending={form.formState.isSubmitting} className="w-full min-w-32 sm:w-auto">{cta}</Button>
    </form>
  );

  if (step === "current") return <OtpStep form={currentForm} onSubmit={confirmCurrent} sentTo={props.currentEmail ?? "your current email"} cta="Verify" />;
  if (step === "new") return <OtpStep form={newForm} onSubmit={confirmNew} sentTo={newEmail} cta="Change email" />;

  return (
    <form onSubmit={emailForm.handleSubmit(startChange)} className="grid max-w-md gap-3">
      <Field label="New email address" type="email" autoComplete="email" placeholder="you@example.com" error={emailForm.formState.errors.newEmail?.message} {...emailForm.register("newEmail")} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" variant="primary" pending={emailForm.formState.isSubmitting} className="w-full min-w-32 sm:w-auto">Change email</Button>
    </form>
  );
}
