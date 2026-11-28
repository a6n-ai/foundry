// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from "y-protocols/awareness"
import * as Y from "yjs"
import { CollabEditor, type CollabEditorProps } from "../collab-editor"
import { meetingTemplate } from "../template"
import { stubLayout } from "./stub-layout"

const providers = vi.hoisted(() => [] as any[])

vi.mock("y-partyserver/provider", async () => {
  const { Awareness } = await import("y-protocols/awareness")
  return {
    default: class {
      awareness: InstanceType<typeof Awareness>
      shouldConnect = false
      synced = false
      private listeners = new Map<string, Set<(...args: any[]) => void>>()
      constructor(
        _host: string,
        _room: string,
        doc: any,
        readonly options: any,
      ) {
        this.awareness = new Awareness(doc)
        providers.push(this)
        if (options.connect !== false) void this.connect()
      }
      // same order as the real provider: params first, then it turns reconnecting on
      async connect() {
        await this.options.params()
        this.shouldConnect = true
      }
      disconnect() {
        this.shouldConnect = false
      }
      destroy() {
        this.disconnect()
        this.awareness.destroy()
      }
      on(name: string, fn: (...args: any[]) => void) {
        this.listeners.set(name, (this.listeners.get(name) ?? new Set()).add(fn))
      }
      off(name: string, fn: (...args: any[]) => void) {
        this.listeners.get(name)?.delete(fn)
      }
      emit(name: string, args: any[]) {
        if (name === "synced") this.synced = args[0]
        for (const fn of this.listeners.get(name) ?? []) fn(...args)
      }
    },
  }
})

beforeAll(stubLayout)
beforeEach(() => providers.splice(0))
afterEach(cleanup)

const template = meetingTemplate({ title: "Meeting with Ana", attendees: ["Ana"] })

function mount(props: Partial<CollabEditorProps> = {}) {
  return render(
    <CollabEditor
      url="localhost:3003"
      docId="cdc_1"
      getToken={async () => "token"}
      user={{ name: "A", color: "#60a5fa" }}
      readOnly={false}
      template={template}
      theme="light"
      {...props}
    />,
  )
}

const blocks = (root: HTMLElement) => root.querySelectorAll('[data-node-type="blockContainer"]')

test("seeds only when synced and empty", async () => {
  const { container } = mount()
  await waitFor(() => expect(container.querySelector('[contenteditable="true"]')).not.toBeNull())
  expect(container.textContent).not.toContain("Meeting with Ana")
  act(() => providers[0].emit("synced", [true]))
  await waitFor(() => expect(blocks(container)[0]?.textContent).toBe("Meeting with Ana"))
  const count = blocks(container).length
  act(() => providers[0].emit("synced", [true]))
  expect(blocks(container)).toHaveLength(count)
})

test("does not seed when readOnly", async () => {
  const { container } = mount({ readOnly: true })
  await waitFor(() => expect(container.querySelector(".bn-editor")).not.toBeNull())
  act(() => providers[0].emit("synced", [true]))
  expect(container.textContent).not.toContain("Meeting with Ana")
  expect(container.querySelector('[contenteditable="true"]')).toBeNull()
})

test("null token calls onDenied and stops reconnecting", async () => {
  const onDenied = vi.fn()
  mount({ getToken: async () => null, onDenied })
  await waitFor(() => expect(onDenied).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(providers[0].shouldConnect).toBe(false))
})

test("re-announces own presence when the room asks", async () => {
  mount()
  await waitFor(() => expect(providers[0]).toBeDefined())
  const { awareness } = providers[0]
  awareness.setLocalState({ user: { name: "A" } })
  const changed = vi.fn()
  awareness.on("change", changed)
  act(() => providers[0].emit("custom-message", ['{"type":"who"}']))
  expect(changed.mock.calls[0]![0].updated).toEqual([awareness.clientID])
})

test("drops the presence of people the room reports as gone", async () => {
  mount()
  await waitFor(() => expect(providers[0]).toBeDefined())
  const { awareness } = providers[0]
  const other = new Awareness(new Y.Doc())
  other.setLocalState({ user: { name: "Ana" } })
  applyAwarenessUpdate(awareness, encodeAwarenessUpdate(other, [other.clientID]), "test")
  expect(awareness.getStates().has(other.clientID)).toBe(true)
  act(() => providers[0].emit("custom-message", [JSON.stringify({ type: "left", clients: [other.clientID] })]))
  expect(awareness.getStates().has(other.clientID)).toBe(false)
  act(() => providers[0].emit("custom-message", ["not json"]))
  other.destroy()
})
