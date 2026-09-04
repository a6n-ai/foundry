import { z } from "zod";

/**
 * No API, no OAuth — DoorDash gives a merchant no self-serve integration
 * beyond a store page URL. The "plugin" is just that URL, toggled on when
 * the client actually has a live DoorDash storefront to link to.
 */
export const doorDashConfigSchema = z.object({
  installed: z.boolean().default(false),
  /** Full https://www.doordash.com/store/... store URL. */
  url: z.string().url().optional(),
});
export type DoorDashConfig = z.infer<typeof doorDashConfigSchema>;

export const DEFAULT_DOORDASH_CONFIG: DoorDashConfig = {
  installed: false,
};

/** NULL/garbage config → uninstalled. Never throws on read. */
export function parseDoorDashConfig(raw: unknown): DoorDashConfig {
  const parsed = doorDashConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_DOORDASH_CONFIG;
}
