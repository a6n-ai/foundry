import type { PartialBlock } from "@blocknote/core"

export function meetingTemplate(input: { title: string; attendees: string[] }): PartialBlock[] {
  const section = (content: string): PartialBlock => ({ type: "heading", props: { level: 2 }, content })
  return [
    { type: "heading", props: { level: 1 }, content: input.title },
    section("Attendees"),
    ...input.attendees.map((content): PartialBlock => ({ type: "bulletListItem", content })),
    section("Agenda"),
    { type: "numberedListItem" },
    section("Notes"),
    { type: "paragraph" },
    section("Action items"),
    { type: "checkListItem" },
  ]
}
