"use client";

import { Loader2 } from "lucide-react";
import { useId, type ComponentType, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Button as ShadcnButton } from "@foundry/ui/button";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import { CodeOtp } from "./code-otp";

export interface AuthButtonProps {
  type?: "button" | "submit";
  variant?: "primary" | "outline" | "quiet" | "danger";
  disabled?: boolean;
  pending?: boolean;
  /** Text shown beside the spinner while `pending`. The default kit shows the spinner alone when omitted. */
  pendingLabel?: ReactNode;
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "ref"> {
  label: string;
  error?: string;
  /** Show/Hide toggle. Render it as-is inside a `relative` box around the input: it positions itself at the right edge. A kit that cannot host it may ignore it. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export interface AuthCodeProps {
  label: string;
  length: 4 | 6;
  masked?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onComplete?: () => void;
}

export interface AuthNoticeProps {
  tone?: "error" | "muted";
  children: ReactNode;
}

/** The primitives the auth-ui screens draw with. Apps pass a subset to restyle. */
export interface AuthUi {
  Button: ComponentType<AuthButtonProps>;
  Field: ComponentType<AuthFieldProps>;
  Code: ComponentType<AuthCodeProps>;
  Notice: ComponentType<AuthNoticeProps>;
}

const VARIANT = { primary: "default", outline: "outline", quiet: "ghost", danger: "destructive" } as const;

function DefaultButton({ variant = "primary", pending, pendingLabel, disabled, type = "button", className, onClick, children }: AuthButtonProps) {
  return (
    <ShadcnButton type={type} variant={VARIANT[variant]} disabled={disabled || pending} className={className} onClick={onClick}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </ShadcnButton>
  );
}

// The markup below reproduces what the forms rendered before slots existed
// (FormItem/FormLabel/FormControl/FormMessage output) so default apps see no change.
function FieldMessage({ id, children }: { id: string; children?: ReactNode }) {
  return children ? (
    <p data-slot="form-message" id={id} className="text-destructive text-sm">
      {children}
    </p>
  ) : null;
}

function DefaultField({ label, error, trailing, id, ref, ...input }: AuthFieldProps) {
  const itemId = `${useId()}-form-item`;
  return (
    <div data-slot="form-item" className="grid gap-2">
      <Label data-slot="form-label" data-error={!!error} className="data-[error=true]:text-destructive" htmlFor={itemId}>
        {label}
      </Label>
      {trailing ? (
        <div className="relative">
          <Input id={id} ref={ref} {...input} />
          {trailing}
        </div>
      ) : (
        <Input
          data-slot="form-control"
          id={id ?? itemId}
          ref={ref}
          aria-describedby={error ? `${itemId}-description ${itemId}-message` : `${itemId}-description`}
          aria-invalid={!!error}
          {...input}
        />
      )}
      <FieldMessage id={`${itemId}-message`}>{error}</FieldMessage>
    </div>
  );
}

function DefaultCode({ label, length, masked, value, onChange, onComplete, error }: AuthCodeProps) {
  const itemId = `${useId()}-form-item`;
  return (
    <div data-slot="form-item" className="grid gap-2">
      <Label data-slot="form-label" data-error={!!error} className="data-[error=true]:text-destructive" htmlFor={itemId}>
        {label}
      </Label>
      <CodeOtp
        id={itemId}
        aria-describedby={error ? `${itemId}-description ${itemId}-message` : `${itemId}-description`}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        aria-invalid={!!error}
        length={length}
        masked={masked}
      />
      <FieldMessage id={`${itemId}-message`}>{error}</FieldMessage>
    </div>
  );
}

function DefaultNotice({ tone = "error", children }: AuthNoticeProps) {
  return <p className={tone === "error" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>{children}</p>;
}

export const defaultUi: AuthUi = { Button: DefaultButton, Field: DefaultField, Code: DefaultCode, Notice: DefaultNotice };

export function resolveUi(ui?: Partial<AuthUi>): AuthUi {
  return ui ? { ...defaultUi, ...ui } : defaultUi;
}

/** Show/Hide toggle used as a `trailing` slot. */
export function RevealToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 text-xs" onClick={onToggle}>
      {shown ? "Hide" : "Show"}
    </button>
  );
}
