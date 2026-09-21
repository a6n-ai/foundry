"use client";

import { Loader2 } from "lucide-react";
import type { ComponentType, InputHTMLAttributes, ReactNode, Ref } from "react";
import { Button as ShadcnButton } from "@foundry/ui/button";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import { CodeOtp } from "./code-otp";

export interface AuthButtonProps {
  type?: "button" | "submit";
  variant?: "primary" | "outline" | "quiet" | "danger";
  disabled?: boolean;
  pending?: boolean;
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "ref"> {
  label: string;
  error?: string;
  /** Small control shown inside the field's right edge (e.g. Show/Hide). A kit that cannot host it may ignore it. */
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

function DefaultButton({ variant = "primary", pending, disabled, type = "button", className, onClick, children }: AuthButtonProps) {
  return (
    <ShadcnButton type={type} variant={VARIANT[variant]} disabled={disabled || pending} className={className} onClick={onClick}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </ShadcnButton>
  );
}

function ErrorText({ children }: { children?: ReactNode }) {
  return children ? <p className="text-destructive text-sm">{children}</p> : null;
}

function DefaultField({ label, error, trailing, id, ref, ...input }: AuthFieldProps) {
  const fid = id ?? `af-${input.name ?? label}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={fid} className={error ? "text-destructive" : undefined}>{label}</Label>
      <div className="relative">
        <Input id={fid} ref={ref} aria-invalid={error ? true : undefined} {...input} />
        {trailing ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function DefaultCode({ label, length, masked: _masked, value, onChange, onComplete, error }: AuthCodeProps) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <CodeOtp value={value} onChange={onChange} onComplete={onComplete} aria-invalid={!!error} length={length} masked={_masked} />
      <ErrorText>{error}</ErrorText>
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
    <button type="button" className="text-muted-foreground text-xs" onClick={onToggle}>
      {shown ? "Hide" : "Show"}
    </button>
  );
}
