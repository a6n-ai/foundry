"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@foundry/ui/input-otp";

type CodeOtpProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  // Forwarded by FormControl's Slot (id / aria-describedby) so FormLabel/FormMessage stay wired.
  id?: string;
  "aria-describedby"?: string;
  length?: 4 | 6;
  masked?: boolean;
};

// 6-digit verification code entry, unmasked. Segmented input-otp component —
// plain controlled <Input> here misses real keystrokes' onChange in prod.
export function CodeOtp({ value, onChange, onComplete, autoFocus, disabled, length = 6, masked, ...rest }: CodeOtpProps) {
  return (
    <InputOTP
      maxLength={length}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete={masked ? "off" : "one-time-code"}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      containerClassName="w-full max-w-sm"
      {...rest}
    >
      {/* Fluid, separate square boxes: six still fit a 320px phone. The row is
          capped at max-w-sm and the boxes keep aspect-square, so a wide column
          (the subscribe wizard) draws the same squares as the narrow login
          panel instead of stretching them into rectangles. */}
      <InputOTPGroup className="w-full gap-2">
        {Array.from({ length }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            masked={masked}
            className="aspect-square h-auto min-w-0 flex-1 rounded-xl border text-xl font-medium tabular-nums first:rounded-xl last:rounded-xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
