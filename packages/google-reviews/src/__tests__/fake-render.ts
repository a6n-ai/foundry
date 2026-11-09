import type { RenderEmailTemplate } from "@foundry/commons";

export const fakeRender: RenderEmailTemplate = async ({ subject, body, vars }) => {
  const fill = (t: string) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => String(vars[k] ?? ""));
  const text = fill(body);
  return { subject: fill(subject), html: `<p>${text}</p>`, text };
};
