import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import { FRAGMENT } from "../../limits"
import { yDocText } from "../text"

function el(name: string, ...children: (Y.XmlElement | Y.XmlText)[]) {
  const node = new Y.XmlElement(name)
  node.insert(0, children)
  return node
}

function text(value: string, marks?: Record<string, unknown>) {
  const node = new Y.XmlText()
  node.insert(0, value, marks)
  return node
}

const block = (...children: (Y.XmlElement | Y.XmlText)[]) => el("blockContainer", ...children)

function docWith(...blocks: Y.XmlElement[]) {
  const doc = new Y.Doc()
  doc.getXmlFragment(FRAGMENT).insert(0, [el("blockGroup", ...blocks)])
  return doc
}

describe("yDocText", () => {
  it("extracts paragraphs as lines", () => {
    const doc = docWith(block(el("paragraph", text("Hello"))), block(el("paragraph", text("World"))))
    expect(yDocText(doc)).toBe("Hello\nWorld")
  })

  it("keeps a nested block on its own line", () => {
    const doc = docWith(block(el("paragraph", text("Parent")), el("blockGroup", block(el("paragraph", text("Child"))))))
    expect(yDocText(doc)).toBe("Parent\nChild")
  })

  it("separates table cells", () => {
    const cell = (v: string) => el("tableCell", el("tableParagraph", text(v)))
    const doc = docWith(block(el("table", el("tableRow", cell("Name"), cell("Price")))))
    expect(yDocText(doc)).toBe("Name Price")
  })

  it("ignores formatting marks", () => {
    expect(yDocText(docWith(block(el("paragraph", text("bold", { bold: true })))))).toBe("bold")
  })

  it("caps length", () => {
    expect(yDocText(docWith(block(el("paragraph", text("x".repeat(300_000))))))).toHaveLength(200_000)
  })
})
