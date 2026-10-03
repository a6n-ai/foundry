"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { emailSchema } from "@foundry/commons";
import { ResendCode } from "./resend-code";
import { resolveUi, type AuthUi } from "./ui";

type Result = { error?: unknown } | null | undefined;
type SendResult = { error?: { status?: number } | null } | null | undefined | unknown;

export interface EmailCodeSignInProps {
  /**
   * Sends the 6-digit code. Only a transport failure (`{ error }`, e.g. a 429)
   * stops the flow; an unknown address must look like success, so whether an
   * account exists is never revealed.
   */
  onSendCode: (email: string) => Promise<SendResult>;
  onVerify: (email: string, code: string) => Promise<Result>;
  /** Runs after a successful verify. Navigation belongs to the app. */
  onSuccess: () => void | Promise<void>;
  /** Shows a back chevron on the email step (e.g. back to the welcome screen). */
  onBack?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Rendered under the form on both steps: "use a password instead", sign-up links, etc. */
  extra?: ReactNode;
  /** Small print under the code-step heading, e.g. "codes only go to existing accounts". */
  codeHint?: ReactNode;
  ui?: Partial<AuthUi>;
}

const CODE = /^\d{6}$/;

/** Passwordless sign-in: email, then a 6-digit code with a resend countdown. */
export function EmailCodeSignIn({
  onSendCode,
  onVerify,
  onSuccess,
  onBack,
  title = "Sign in",
  subtitle = "We'll email you a 6-digit code.",
  extra,
  codeHint,
  ui,
}: EmailCodeSignInProps) {
  const { Button, Field, Code, Notice } = resolveUi(ui);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError("Enter a valid email address.");
    setFieldError(undefined);
    setError(null);
    setPending(true);
    const failure = await send(parsed.data);
    if (failure) {
      setPending(false);
      return setError(failure);
    }
    setEmail(parsed.data);
    setPending(false);
    setStep("code");
  }

  /** null on success, else the message to show. */
  async function send(to: string): Promise<string | null> {
    let res: SendResult;
    try {
      res = await onSendCode(to);
    } catch {
      return "Couldn't send the code. Try again.";
    }
    const err = (res as { error?: { status?: number } | null } | null | undefined)?.error;
    if (!err) return null;
    return err.status === 429 ? "Too many codes requested. Wait a minute, then try again." : "Couldn't send the code. Try again.";
  }

  async function verify(value: string = code) {
    if (!CODE.test(value)) return setFieldError("Enter all 6 digits.");
    setFieldError(undefined);
    setError(null);
    setPending(true);
    const res = await onVerify(email, value).catch(() => ({ error: true }));
    if (res?.error) {
      setPending(false);
      setCode("");
      setError("That code didn't work. Check the latest email, or resend a new code.");
      return;
    }
    await onSuccess();
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setFieldError(undefined);
  }

  if (step === "code") {
    return (
      // key: a fresh <form> across the step swap; a reused input's native value
      // tracker desyncs from the segmented code field's controlled value.
      <form
        key="code"
        method="post"
        onSubmit={(e) => { e.preventDefault(); void verify(); }}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 flex flex-1 flex-col gap-6 duration-300 ease-out"
      >
        <BackButton onClick={changeEmail} label="Change email" />
        <header className="flex flex-col gap-2 text-center">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.022em]">Check your email</h1>
          <p className="text-muted-foreground text-balance text-[15px]">
            Enter the 6-digit code we sent to <span className="text-foreground font-medium [overflow-wrap:anywhere]">{email}</span>
          </p>
          {codeHint ? <p className="text-muted-foreground text-balance text-xs">{codeHint}</p> : null}
        </header>
        <Code
          label="Verification code"
          length={6}
          value={code}
          onChange={(v) => { setCode(v); if (error) setError(null); }}
          onComplete={(v) => void verify(v)}
          error={fieldError}
          autoFocus
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" variant="primary" className="w-full" pending={pending} pendingLabel="Signing in…">
          Continue
        </Button>
        <ResendCode
          onResend={async () => {
            const failure = await send(email);
            if (failure) throw new Error(failure);
          }}
        />
        {extra}
      </form>
    );
  }

  return (
    // method="post": a tap before hydration finishes would otherwise submit as
    // GET and put the email address in the URL, logs and history.
    <form key="email" method="post" onSubmit={sendCode} noValidate className="flex flex-1 flex-col gap-6">
      {onBack ? <BackButton onClick={onBack} label="Back" /> : null}
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.022em]">{title}</h1>
        {subtitle ? <p className="text-muted-foreground text-balance text-[15px]">{subtitle}</p> : null}
      </header>
      <Field
        label="Email"
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldError}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" variant="primary" className="w-full" pending={pending} pendingLabel="Sending code…">
        Email me a code
      </Button>
      {extra}
    </form>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-primary -ml-2 flex min-h-11 items-center gap-0.5 self-start rounded-lg pr-2 text-[17px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-3"
    >
      <ChevronLeft className="size-6" aria-hidden />
      {label}
    </button>
  );
}
