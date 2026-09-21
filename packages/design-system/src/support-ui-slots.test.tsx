import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@foundry/realtime/client", () => ({ useTyping: () => ({ peerTyping: false, notifyTyping: vi.fn() }) }));

import { ChatMessageList } from "./chat-message-list";
import { MessageComposer } from "./message-composer";

const messages = [
  { id: "1", kind: "system" as const, body: "Opened", meta: "Jul 1" },
  { id: "2", kind: "mine" as const, body: "Hi", meta: "You" },
];

describe("support ui slots", () => {
  it("ChatMessageList default keeps shadcn bubbles", () => {
    const html = renderToStaticMarkup(<ChatMessageList messages={messages} />);
    expect(html).toContain("bg-primary text-primary-foreground");
    expect(html).toContain("Opened · Jul 1");
  });
  it("ChatMessageList uses app Bubble/System", () => {
    const html = renderToStaticMarkup(
      <ChatMessageList
        messages={messages}
        ui={{ Bubble: ({ message, mine }) => <b data-kit={mine ? "mine" : "theirs"}>{message.body}</b>, System: () => <i data-kit="sys" /> }}
      />,
    );
    expect(html).toContain('data-kit="mine"');
    expect(html).toContain('data-kit="sys"');
    expect(html).not.toContain("bg-primary");
  });
  it("MessageComposer default renders shadcn textarea; ui swaps it", () => {
    const action = vi.fn();
    expect(renderToStaticMarkup(<MessageComposer action={action} closed={false} />)).toContain('data-slot="textarea"');
    const html = renderToStaticMarkup(
      <MessageComposer
        action={action}
        closed={false}
        ui={{ Textarea: () => <textarea data-kit="ta" />, Button: ({ children }) => <button data-kit="btn">{children}</button> }}
      />,
    );
    expect(html).toContain('data-kit="ta"');
    expect(html).toContain('data-kit="btn"');
    expect(html).not.toContain('data-slot="textarea"');
  });
});
