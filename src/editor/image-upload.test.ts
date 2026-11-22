import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));
vi.mock("@/lib/tauri/fs", () => ({
  saveImageAsset: vi.fn(),
}));
vi.mock("@/stores/notifications", () => ({
  notify: { error: vi.fn() },
}));
vi.mock("@/stores/document", () => ({
  useDocuments: { getState: vi.fn(() => ({})) },
  selectActiveDocument: vi.fn(),
}));

import { isTauri } from "@tauri-apps/api/core";

import { saveImageAsset } from "@/lib/tauri/fs";
import { selectActiveDocument } from "@/stores/document";
import { notify } from "@/stores/notifications";

import { isRemoteOrInline, MAX_IMAGE_BYTES, toAbsolutePath, uploadImage } from "./image-upload";

describe("isRemoteOrInline", () => {
  it("recognizes URLs that are already loadable", () => {
    expect(isRemoteOrInline("data:image/png;base64,AAAA")).toBe(true);
    expect(isRemoteOrInline("https://example.com/a.png")).toBe(true);
    expect(isRemoteOrInline("asset://localhost/a.png")).toBe(true);
  });

  it("treats relative/local paths as not-yet-loadable", () => {
    expect(isRemoteOrInline("./assets/a.png")).toBe(false);
    expect(isRemoteOrInline("/Users/me/notes/assets/a.png")).toBe(false);
  });
});

describe("toAbsolutePath", () => {
  it("resolves a relative path against the document directory", () => {
    expect(toAbsolutePath("./assets/a.png", "/Users/me/notes/doc.md")).toBe(
      "/Users/me/notes/assets/a.png",
    );
    expect(toAbsolutePath("assets/a.png", "/Users/me/notes/doc.md")).toBe(
      "/Users/me/notes/assets/a.png",
    );
  });

  it("leaves an absolute path unchanged", () => {
    expect(toAbsolutePath("/abs/a.png", "/Users/me/doc.md")).toBe("/abs/a.png");
    expect(toAbsolutePath("C:\\img\\a.png", "C:\\notes\\doc.md")).toBe("C:\\img\\a.png");
  });
});

/** Build a File whose bytes are the given ASCII string. */
function pngFile(name = "pic.png", body = "PNGBYTES"): File {
  return new File([body], name, { type: "image/png" });
}

describe("uploadImage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(selectActiveDocument).mockReturnValue({ path: "/Users/me/notes/doc.md" } as never);
  });

  it("with a saved doc copies to assets/ and returns a relative link", async () => {
    vi.mocked(saveImageAsset).mockResolvedValue("assets/pic.png");

    const url = await uploadImage(pngFile());

    expect(saveImageAsset).toHaveBeenCalledWith(
      "/Users/me/notes/doc.md",
      "pic.png",
      expect.any(Uint8Array),
    );
    expect(url).toBe("./assets/pic.png");
  });

  it("on an untitled doc falls back to an inline data URI", async () => {
    vi.mocked(selectActiveDocument).mockReturnValue(null as never);

    const url = await uploadImage(pngFile());

    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(saveImageAsset).not.toHaveBeenCalled();
  });

  it("says why a save failed instead of dropping the image silently", async () => {
    vi.mocked(saveImageAsset).mockRejectedValue({ kind: "permissionDenied", message: "denied" });

    // Rejects, so Crepe keeps its placeholder.
    await expect(uploadImage(pngFile())).rejects.toMatchObject({ kind: "permissionDenied" });

    expect(notify.error).toHaveBeenCalledWith("Couldn’t add the image: permission denied");
  });

  it("refuses an image over the cap before sending it, with its own message", async () => {
    const big = pngFile();
    Object.defineProperty(big, "size", { value: MAX_IMAGE_BYTES + 1 });

    await expect(uploadImage(big)).rejects.toMatchObject({ kind: "imageTooLarge" });

    expect(saveImageAsset).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith("Couldn’t add the image: it is larger than 25 MB");
  });
});
