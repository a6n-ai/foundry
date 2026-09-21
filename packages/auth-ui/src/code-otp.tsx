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
      {...rest}
    >
      <InputOTPGroup>
        {Array.from({ length }, (_, i) => (
          <InputOTPSlot key={i} index={i} masked={masked} className={masked ? "size-12 text-xl" : "size-10 text-lg"} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
