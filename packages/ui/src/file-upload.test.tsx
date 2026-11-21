// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("radix-ui", () => {
  throw new Error("file-upload must not import radix-ui")
})

import { FileUpload, FileUploadDropzone } from "./file-upload"

afterEach(cleanup)

describe("FileUpload", () => {
  it("renders without Radix direction, defaulting to ltr", () => {
    render(
      <FileUpload>
        <FileUploadDropzone>Drop files</FileUploadDropzone>
      </FileUpload>
    )
    expect(screen.getByText("Drop files")).toHaveAttribute("dir", "ltr")
  })

  it("takes an explicit dir", () => {
    render(
      <FileUpload dir="rtl">
        <FileUploadDropzone>Drop files</FileUploadDropzone>
      </FileUpload>
    )
    expect(screen.getByText("Drop files")).toHaveAttribute("dir", "rtl")
  })
})
