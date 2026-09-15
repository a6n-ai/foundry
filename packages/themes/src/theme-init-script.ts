import { THEME_STORAGE_KEY } from "./storage-key";

// Runs synchronously in <head> during HTML parsing, before first paint, so the
// stored theme is applied without a flash. Render it from a Server Component
// (e.g. an inline <script>) so it does not trip React's "script inside a Client
// Component" warning. Keyed off THEME_STORAGE_KEY so it can never drift from the
// provider's storage key.
//
// Applies both `.dark` (CRM / Tailwind `dark:`) and `data-theme` (apps that style
// via attribute selectors, e.g. puchkaman marketing) so one preference drives both.
export const themeInitScript = makeThemeInitScript("system");

/**
 * Same boot script, but with a per-app fallback for "nothing stored yet" —
 * puchkaman's public site wants to always open light regardless of the
 * visitor's OS setting, without touching every other app's system-follows
 * default. A stored user preference (light/dark/system, from the toggle)
 * still always wins; this only changes what happens before anyone has
 * chosen anything.
 */
export function makeThemeInitScript(defaultTheme: "light" | "dark" | "system" = "system"): string {
  const fallback =
    defaultTheme === "system"
      ? `window.matchMedia("(prefers-color-scheme: dark)").matches`
      : defaultTheme === "dark"
        ? "true"
        : "false";
  return `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((!t||t==="system")&&(${fallback}));document.documentElement.classList.toggle("dark",d);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
}
