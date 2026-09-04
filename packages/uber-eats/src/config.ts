import { z } from "zod";

/**
 * No API, no OAuth — Uber Eats gives a merchant no self-serve integration
 * beyond a store page URL. The "plugin" is just that URL, toggled on when
 * the client actually has a live Uber Eats storefront to link to.
 */
export const uberEatsConfigSchema = z.object({
  installed: z.boolean().default(false),
  /** Full https://www.ubereats.com/... store URL. */
  url: z.string().url().optional(),
});
export type UberEatsConfig = z.infer<typeof uberEatsConfigSchema>;

export const DEFAULT_UBER_EATS_CONFIG: UberEatsConfig = {
  installed: false,
};

/** NULL/garbage config → uninstalled. Never throws on read. */
export function parseUberEatsConfig(raw: unknown): UberEatsConfig {
  const parsed = uberEatsConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_UBER_EATS_CONFIG;
}
