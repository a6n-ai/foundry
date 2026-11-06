import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Apps may name font sizes on an Apple-style scale in @theme (--text-footnote, --text-body, ...).
// tailwind-merge only knows Tailwind's own size names and would read these as text colors, dropping a
// real color class it thinks they conflict with. Registering them keeps size and color apart.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption-2", "caption", "footnote", "subhead", "callout", "body", "title-3", "title-2", "title-1", "large-title"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
