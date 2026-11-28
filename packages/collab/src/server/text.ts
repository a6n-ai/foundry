import * as Y from "yjs"
import { FRAGMENT, LIMITS } from "../limits"

/** Plain text of a BlockNote doc: one line per block, formatting dropped. */
export function yDocText(doc: Y.Doc, maxChars: number = LIMITS.textChars): string {
  let out = ""
  const endLine = () => {
    if (out && !out.endsWith("\n")) out = `${out.trimEnd()}\n`
  }
  const walk = (node: unknown) => {
    if (node instanceof Y.XmlText) {
      for (const op of node.toDelta() as { insert: unknown }[]) if (typeof op.insert === "string") out += op.insert
      return
    }
    if (!(node instanceof Y.XmlElement || node instanceof Y.XmlFragment)) return
    const name = node instanceof Y.XmlElement ? node.nodeName : ""
    if (name === "blockContainer") endLine()
    for (const child of node.toArray()) walk(child)
    if (name === "blockContainer") endLine()
    if (name === "tableCell" || name === "tableHeader") out += " "
  }
  walk(doc.getXmlFragment(FRAGMENT))
  return out.trim().replace(/\n{3,}/g, "\n\n").slice(0, maxChars)
}
