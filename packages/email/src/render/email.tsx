import { interpolate } from "./interpolate";

const CONTAINER = { fontFamily: "system-ui, sans-serif", color: "#111", maxWidth: "520px", margin: "0 auto", padding: "24px", background: "#fff" };

/** Interpolate {{vars}} then render the branded email to HTML + plaintext. */
export async function renderEmailTemplate(input: {
  subject: string;
  body: string;
  vars: Record<string, unknown>;
  appName: string;
}): Promise<{ subject: string; html: string; text: string }> {
  // Loaded on first render, not at import: the components barrel takes ~1.5s to load, and every
  // server module that reaches @foundry/email (auth included) paid it at startup.
  const { Body, Container, Head, Heading, Html, Markdown, render } = await import("@react-email/components");
  const subject = interpolate(input.subject, input.vars);
  const markdown = interpolate(input.body, input.vars);
  const email = (
    <Html lang="en">
      <Head />
      <Body style={{ backgroundColor: "#f6f6f6", margin: 0 }}>
        <Container style={CONTAINER}>
          <Heading style={{ margin: "0 0 8px" }}>{input.appName}</Heading>
          <Markdown>{markdown}</Markdown>
        </Container>
      </Body>
    </Html>
  );
  const html = await render(email);
  const text = await render(email, { plainText: true });
  return { subject, html, text };
}

/** In-app rendering: interpolated title + plaintext body (no email chrome). */
export function renderInApp(input: {
  subject: string;
  body: string;
  vars: Record<string, unknown>;
}): { title: string; body: string } {
  return {
    title: interpolate(input.subject, input.vars),
    body: interpolate(input.body, input.vars),
  };
}
