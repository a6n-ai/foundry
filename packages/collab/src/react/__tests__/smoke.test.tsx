// @vitest-environment jsdom
import { withCollaboration } from "@blocknote/core/yjs"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import { cleanup, render } from "@testing-library/react"
import { version } from "react"
import { afterEach, beforeAll, expect, test } from "vitest"
import * as Y from "yjs"

// jsdom has no layout engine; ProseMirror asks for these.
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const fragment = new Y.Doc().getXmlFragment("document-store")

function Editor() {
  const editor = useCreateBlockNote(
    withCollaboration({ collaboration: { fragment, user: { name: "A", color: "#000000" } } }),
  )
  return <BlockNoteView editor={editor} />
}

test("BlockNote 0.57 renders under React 19 with a Yjs fragment", () => {
  const { container } = render(<Editor />)
  expect(version.startsWith("19.")).toBe(true)
  expect(container.querySelector('[contenteditable="true"]')).not.toBeNull()
})
