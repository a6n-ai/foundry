"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { emailSchema } from "@foundry/commons";
import { authErrorMessage, errorOf } from "./errors";
import { ResendCode } from "./resend-code";
import { EmailSuggestions } from "./email-suggestions";
import { resolveUi, type AuthUi } from "./ui";

type Result = { error?: unknown } | null | undefined;
type SendResult = { error?: { status?: number } | null } | null | undefined | unknown;

export interface EmailCodeSignInProps {
  /**
   * Sends the 6-digit code. Only a rate limit (`{ error: { status: 429 } }`)
   * stops the flow; anything else moves on, so whether an account exists is
   * never revealed.
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
  /** Email step only, above the email field with an "or" divider: e.g. `<GoogleSignInButton />`. */
  alternatives?: ReactNode;
  /** Small print under the code-step text. */
  codeHint?: ReactNode;
  /**
   * Body-only mode for use inside AuthWelcome: no headings of its own (the
   * welcome header above stays put), left-aligned, back link at the bottom.
   */
  compact?: boolean;
  /** Lets a compact host retitle its header per step. */
  onStepChange?: (step: "email" | "code") => void;
  ui?: Partial<AuthUi>;
}

const CODE = /^\d{6}$/;
/** The one style for secondary actions under an auth screen's main button. */
export const AUTH_LINK = "text-muted-foreground hover:text-foreground min-h-11 text-sm underline-offset-4 hover:underline";
const LINK = AUTH_LINK;

/** Passwordless sign-in: email, then a 6-digit code with a resend countdown. */
export function EmailCodeSignIn({
  onSendCode,
  onVerify,
  onSuccess,
  onBack,
  title = "Sign in",
  subtitle = "We'll email you a 6-digit code.",
  extra,
  alternatives,
  codeHint,
  compact = false,
  onStepChange,
  ui,
}: EmailCodeSignInProps) {
  const { Button, Field, Code, Notice } = resolveUi(ui);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError("Enter an email address like name@example.com.");
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
    onStepChange?.("code");
  }

  /**
   * null to advance, else the message to show. Only a rate limit holds the
   * user on the email step: every other failure (including an address with no
   * account, which sends nothing) moves on to the code screen, so the screen
   * never reveals whether an account exists.
   */
  async function send(to: string): Promise<string | null> {
    let err: ReturnType<typeof errorOf>;
    try {
      err = errorOf(await onSendCode(to));
    } catch {
      return null;
    }
    return err?.status === 429 ? authErrorMessage(err, "send") : null;
  }

  async function verify(value: string = code) {
    if (!CODE.test(value)) return setFieldError("Enter all 6 digits.");
    setFieldError(undefined);
    setError(null);
    setPending(true);
    let res: Result;
    try {
      res = await onVerify(email, value);
    } catch {
      res = { error: {} };
    }
    if (res?.error) {
      setPending(false);
      setCode("");
      setError(authErrorMessage(res.error, "verify"));
      return;
    }
    await onSuccess();
  }

  function changeEmail() {
    setStep("email");
    onStepChange?.("email");
    setCode("");
    setError(null);
    setFieldError(undefined);
  }

  const others = alternatives ? (
    <>
      {alternatives}
      <div className="text-muted-foreground flex items-center gap-3 text-xs" aria-hidden>
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
    </>
  ) : null;

  const resend = (
    <ResendCode
      onResend={async () => {
        const failure = await send(email);
        if (failure) throw new Error(failure);
      }}
    />
  );

  if (compact) {
    const codeStep = step === "code";
    return (
      // One form that morphs in place: the email field stays (locked once the
      // code is sent), the code boxes open up beneath it, and the button
      // relabels. No step swap, so nothing on screen jumps.
      <form
        method="post"
        noValidate
        onSubmit={(e) => { if (codeStep) { e.preventDefault(); void verify(); } else void sendCode(e); }}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex flex-1 flex-col gap-5 duration-300 ease-out"
      >
        {codeStep ? null : others}
        <div className="flex flex-col gap-2">
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
            readOnly={codeStep}
            aria-readonly={codeStep}
            className={codeStep ? "opacity-70" : undefined}
            error={codeStep ? undefined : fieldError}
          />
          {codeStep ? null : <EmailSuggestions value={email} onPick={setEmail} />}
        </div>
        {/* grid-rows 0fr -> 1fr animates to the content's real height. */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${codeStep ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          aria-hidden={!codeStep}
        >
          {/* -m-1 p-1: room for the focused box's ring, which overflow-hidden would slice. */}
          <div className="-m-1 flex min-h-0 flex-col gap-4 overflow-hidden p-1">
            {codeStep ? (
              <>
                <p className="text-muted-foreground pt-1 text-sm">
                  If there&apos;s an account for this email, we&apos;ve sent it a 6-digit code.
                  {codeHint ? <> {codeHint}</> : null}
                </p>
                <Code
                  label="Verification code"
                  length={6}
                  value={code}
                  onChange={(v) => { setCode(v); if (error) setError(null); }}
                  onComplete={(v) => void verify(v)}
                  error={fieldError}
                  autoFocus
                />
              </>
            ) : null}
          </div>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex flex-col gap-3 pt-1">
          <Button type="submit" variant="primary" className="w-full" pending={pending} pendingLabel={codeStep ? "Signing in…" : "Sending code…"}>
            {codeStep ? "Continue" : "Email me a code"}
          </Button>
          {/* Every secondary action lives here, centered under the button, on
              every auth screen: never wedged between the inputs. */}
          <div className="flex flex-col items-center">
            {codeStep ? (
              <>
                {resend}
                <button type="button" onClick={changeEmail} className={LINK}>Use a different email</button>
              </>
            ) : null}
            {extra}
            {!codeStep && onBack ? <button type="button" onClick={onBack} className={LINK}>Back</button> : null}
          </div>
        </div>
      </form>
    );
  }

  if (step === "code") {
    return (
      // key: a fresh <form> across the step swap; a reused input's native value
      // tracker desyncs from the segmented code field's controlled value.
      <form
        key="code"
        method="post"
        onSubmit={(e) => { e.preventDefault(); void verify(); }}
        className={`motion-safe:animate-in motion-safe:fade-in flex flex-1 flex-col duration-300 ease-out ${compact ? "gap-5 motion-safe:slide-in-from-bottom-2" : "gap-6 motion-safe:slide-in-from-right-4"}`}
      >
        {compact ? (
          <div className="flex flex-col gap-1">
            <p className="text-[15px]">
              If there&apos;s an account for <span className="font-medium [overflow-wrap:anywhere]">{email}</span>, we&apos;ve sent it a 6-digit code.{" "}
              <button type="button" onClick={changeEmail} className="text-primary font-medium underline-offset-4 hover:underline">
                Change
              </button>
            </p>
            {codeHint ? <p className="text-muted-foreground text-xs">{codeHint}</p> : null}
          </div>
        ) : (
          <>
            <BackButton onClick={changeEmail} label="Change email" />
            <header className="flex flex-col gap-2 text-center">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.022em]">Check your email</h1>
              <p className="text-muted-foreground text-balance text-[15px]">
                If there&apos;s an account for <span className="text-foreground font-medium [overflow-wrap:anywhere]">{email}</span>, we&apos;ve sent it a 6-digit code.
              </p>
              {codeHint ? <p className="text-muted-foreground text-balance text-xs">{codeHint}</p> : null}
            </header>
          </>
        )}
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
        {compact ? resend : null}
        {/* Compact on phones: the button rides the bottom edge (thumb reach,
            just above the keyboard), Revolut-style. */}
        <div className={compact ? "flex flex-col gap-3 pt-1" : "contents"}>
          <Button type="submit" variant="primary" className="w-full" pending={pending} pendingLabel="Signing in…">
            Continue
          </Button>
          {compact ? null : resend}
          {extra}
        </div>
      </form>
    );
  }

  return (
    // method="post": a tap before hydration finishes would otherwise submit as
    // GET and put the email address in the URL, logs and history.
    <form
      key="email"
      method="post"
      onSubmit={sendCode}
      noValidate
      className={`flex flex-1 flex-col ${compact ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 gap-5 duration-300 ease-out" : "gap-6"}`}
    >
      {compact ? null : (
        <>
          {onBack ? <BackButton onClick={onBack} label="Back" /> : null}
          <header className="flex flex-col gap-2 text-center">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.022em]">{title}</h1>
            {subtitle ? <p className="text-muted-foreground text-balance text-[15px]">{subtitle}</p> : null}
          </header>
        </>
      )}
      {others}
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
      <EmailSuggestions value={email} onPick={setEmail} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className={compact ? "flex flex-col gap-3 pt-1" : "contents"}>
        <Button type="submit" variant="primary" className="w-full" pending={pending} pendingLabel="Sending code…">
          Email me a code
        </Button>
        {extra}
        {compact && onBack ? (
          <button type="button" onClick={onBack} className="text-muted-foreground mx-auto min-h-11 text-sm underline-offset-4 hover:underline">
            Back
          </button>
        ) : null}
      </div>
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
