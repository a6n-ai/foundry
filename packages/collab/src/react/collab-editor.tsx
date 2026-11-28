import type { PartialBlock } from "@blocknote/core"
import { withCollaboration } from "@blocknote/core/yjs"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import "@blocknote/shadcn/style.css"
import { useEffect, useRef, useState } from "react"
import YProvider from "y-partyserver/provider"
import type { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"
import { FRAGMENT } from "../limits"

export type CollabStatus = "connecting" | "connected" | "disconnected" | "full"

export type CollabEditorProps = {
  /** Host with port, e.g. `location.host`. */
  url: string
  docId: string
  /** Called on every (re)connect. `null` means access is gone: the editor stops retrying. */
  getToken: () => Promise<string | null>
  user: { name: string; color: string }
  readOnly: boolean
  template?: PartialBlock[]
  theme: "light" | "dark"
  onDenied?: () => void
  onStatus?: (status: CollabStatus) => void
  /** The live connection, for presence UI outside the editor. */
  onProvider?: (provider: { awareness: Awareness } | null) => void
}

type Session = { doc: Y.Doc; provider: YProvider }

export function CollabEditor(props: CollabEditorProps) {
  const latest = useRef(props)
  latest.current = props
  const [session, setSession] = useState<Session | null>(null)
  const [full, setFull] = useState(false)
  const { url, docId } = props

  useEffect(() => {
    const doc = new Y.Doc()
    let alive = true
    let denied = false
    const provider: YProvider = new YProvider(url, docId, doc, {
      connect: false,
      prefix: `/collab/${docId}`,
      params: async () => {
        let token: string | null
        try {
          token = await latest.current.getToken()
        } catch (err) {
          // offline or a failed request: connect with no token, get refused, and back off
          console.warn("collab token request failed", err)
          return { token: "" }
        }
        if (token === null && alive && !denied) {
          denied = true
          provider.shouldConnect = false
          latest.current.onDenied?.()
        }
        return { token: token ?? "" }
      },
    })
    provider.on("status", ({ status }: { status: CollabStatus }) => latest.current.onStatus?.(status))
    provider.on("custom-message", (message: string) => {
      if (message !== '{"type":"full"}') return
      setFull(true)
      latest.current.onStatus?.("full")
    })
    setSession({ doc, provider })
    latest.current.onProvider?.(provider)
    // connect() turns reconnecting back on, so a refusal or an unmount during the token request is applied after it
    void provider.connect().then(() => {
      if (!alive || denied) provider.disconnect()
    })
    return () => {
      alive = false
      latest.current.onProvider?.(null)
      provider.destroy()
      doc.destroy()
      setSession(null)
      setFull(false)
    }
  }, [url, docId])

  if (!session) return null
  return <Editor key={session.doc.clientID} {...session} {...props} readOnly={props.readOnly} full={full} />
}

function Editor({
  doc,
  provider,
  user,
  readOnly,
  full,
  template,
  theme,
}: Session & CollabEditorProps & { full: boolean }) {
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: { fragment: doc.getXmlFragment(FRAGMENT), user, provider, showCursorLabels: "activity" },
    }),
    [doc],
  )
  const seed = useRef({ template, readOnly })
  seed.current = { template, readOnly }

  useEffect(() => {
    const onSynced = (synced: boolean) => {
      const { template, readOnly } = seed.current
      if (synced && template && !readOnly && editor.isEmpty) editor.replaceBlocks(editor.document, template)
    }
    provider.on("synced", onSynced)
    if (provider.synced) onSynced(true)
    return () => provider.off("synced", onSynced)
  }, [editor, provider])

  return <BlockNoteView editor={editor} editable={!readOnly && !full} theme={theme} />
}
