"use client";

/** The providers most customers use; shown as one-tap completions after "@". */
export const COMMON_EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"] as const;

/**
 * Completions for what is typed after "@": nothing before the "@" is typed, or
 * once the domain already matches one exactly. Lives here, not in commons:
 * apps pin commons separately, and a new commons export would not be visible
 * to auth-ui through an app's older copy.
 */
export function emailDomainSuggestions(value: string): string[] {
  const at = value.indexOf("@");
  if (at < 1 || value.indexOf("@", at + 1) !== -1) return [];
  const local = value.slice(0, at);
  const partial = value.slice(at + 1).toLowerCase();
  return COMMON_EMAIL_DOMAINS.filter((d) => d.startsWith(partial) && d !== partial).map((d) => `${local}@${d}`);
}

/**
 * One-tap completions for common providers once "@" is typed ("priya@" →
 * @gmail.com, @outlook.com …). Buttons, not a datalist: mobile keyboards hide
 * datalist options, and these are the screens people sign in from on phones.
 */
export function EmailSuggestions({ value, onPick }: { value: string; onPick: (email: string) => void }) {
  const suggestions = emailDomainSuggestions(value);
  if (suggestions.length === 0) return null;
  return (
    <div role="group" aria-label="Suggested email addresses" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          // Keep focus in the input so the keyboard stays up after a tap.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s)}
          className="border-border bg-card hover:bg-accent min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-transform duration-100 active:scale-[0.97]"
        >
          <span className="text-muted-foreground">@</span>
          {s.slice(s.indexOf("@") + 1)}
        </button>
      ))}
    </div>
  );
}
