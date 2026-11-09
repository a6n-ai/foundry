/** What Foundry packages need from an email transport and renderer; apps inject their own (e.g. @relay/email). */
export interface EmailProvider {
  send(message: {
    to: { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<unknown>;
}

export type RenderEmailTemplate = (input: {
  subject: string;
  body: string;
  vars: Record<string, unknown>;
  appName: string;
}) => Promise<{ subject: string; html: string; text: string }>;
