"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { passwordSchema } from "@foundry/commons";
import { resolveUi, type AuthUi } from "./ui";

type Result = { error?: unknown };

export interface ForgotCurrentPasswordProps {
  /** The signed-in account's email. Shown, never typed — this is not a lookup. */
  email: string;
  onSendEmailOtp: (email: string) => Promise<Result>;
  onResetWithEmailOtp: (input: { email: string; otp: string; password: string }) => Promise<Result>;
  onDone: () => void;
  ui?: Partial<AuthUi>;
}

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: passwordSchema,
});

/**
 * Password reset for someone already signed in who cannot produce their current
 * password.
 *
 * The emailed code is the whole point: the session alone must never be enough to
 * set a new password, or a borrowed session becomes permanent account takeover —
 * and since both apps revoke other sessions on reset, the real owner is the one
 * locked out. The code proves mailbox control, which the cookie does not.
 *
 * Separate from `ForgotPasswordForm` (the logged-out screen) because that one
 * owns the page: it renders an `h1` and asks who you are. Here the account is
 * already known and this sits inside a settings card.
 */
export function ForgotCurrentPassword(props: ForgotCurrentPasswordProps) {
  const { Button, Field, Code, Notice } = resolveUi(props.ui);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "", newPassword: "" },
  });

  async function send() {
    setSending(true);
    setError(null);
    await props.onSendEmailOtp(props.email);
    setSending(false);
    setSent(true);
  }

  async function onVerify(values: z.infer<typeof verifySchema>) {
    setError(null);
    const res = await props.onResetWithEmailOtp({
      email: props.email,
      otp: values.code,
      password: values.newPassword,
    });
    if (res.error) {
      setError("Invalid or expired code.");
      return;
    }
    toast.success("Password updated.");
    props.onDone();
  }

  if (!sent) {
    return (
      <div className="grid max-w-md gap-3">
        <p className="text-muted-foreground text-sm">
          We&apos;ll email a 6-digit code to <span className="font-medium">{props.email}</span>. Enter
          it here with your new password — you&apos;ll stay signed in on this device.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={send} pending={sending} className="min-w-32">
            Email me a code
          </Button>
          <Button type="button" variant="quiet" onClick={props.onDone}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const { errors, isSubmitting } = form.formState;
  return (
    // key forces a remount across the step swap — a reused input's native
    // value-tracker can desync from the segmented OTP field's controlled value.
    <form key="verify" onSubmit={form.handleSubmit(onVerify)} className="grid max-w-md gap-3">
      <p className="text-muted-foreground text-sm">
        We sent a 6-digit code to <span className="font-medium">{props.email}</span>.
      </p>
      <Controller control={form.control} name="code" render={({ field }) => (
        <Code label="Verification code" length={6} value={field.value} onChange={field.onChange} error={errors.code?.message} />
      )} />
      <Field label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...form.register("newPassword")} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" pending={isSubmitting} pendingLabel="Saving..." className="min-w-32">
          Set new password
        </Button>
        <Button type="button" variant="quiet" onClick={send} disabled={sending}>
          Resend code
        </Button>
      </div>
    </form>
  );
}
