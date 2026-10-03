"use client";

import { emailDomainSuggestions } from "@foundry/commons";

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
