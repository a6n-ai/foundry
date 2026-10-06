import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { FriendsPanel, relationAction } from "./friends-panel";

const ana = { publicId: "usr_ana", displayUsername: "Ana.K", name: "Ana K", image: null };
const ben = { publicId: "usr_ben", displayUsername: "ben", name: "Ben", image: null };
const cy = { publicId: "usr_cy", displayUsername: null, name: "Cy", image: null };
const noop = async () => ({});

describe("FriendsPanel", () => {
  it("shows the invite link, incoming requests, sent requests and friends", () => {
    const html = renderToStaticMarkup(
      <FriendsPanel
        friends={[ana]}
        incoming={[ben]}
        outgoing={[cy]}
        inviteUrl="https://x.test/join?ref=me"
        search={async () => ({ rows: [] })}
        act={noop}
      />,
    );
    expect(html).toContain("https://x.test/join?ref=me");
    expect(html).toContain("@Ana.K");
    expect(html).toContain("Accept");
    expect(html).toContain("Decline");
    expect(html).toContain("Cancel request");
  });

  it("asks for a username when there is no invite link", () => {
    const html = renderToStaticMarkup(
      <FriendsPanel friends={[]} incoming={[]} outgoing={[]} inviteUrl={null} search={async () => ({ rows: [] })} act={noop} />,
    );
    expect(html).toContain("Set a username");
    expect(html).toContain("No friends yet");
  });
});

describe("relationAction", () => {
  it("maps each relation to the one thing you can do", () => {
    expect(relationAction("none")).toEqual({ label: "Add", kind: "request" });
    expect(relationAction("incoming")).toEqual({ label: "Accept", kind: "accept" });
    expect(relationAction("outgoing")).toEqual({ label: "Requested", kind: null });
    expect(relationAction("friends")).toEqual({ label: "Friends", kind: null });
  });
});
