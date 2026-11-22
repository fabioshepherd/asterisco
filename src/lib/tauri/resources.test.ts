import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";

import { readThirdPartyNotices } from "./resources";

beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("readThirdPartyNotices", () => {
  it("invokes the read_third_party_notices command and returns its result", async () => {
    vi.mocked(invoke).mockResolvedValue("NOTICES TEXT");

    await expect(readThirdPartyNotices()).resolves.toBe("NOTICES TEXT");
    expect(invoke).toHaveBeenCalledWith("read_third_party_notices");
  });

  it("propagates a rejection from the command", async () => {
    const error = { kind: "resource", message: "boom" };
    vi.mocked(invoke).mockRejectedValue(error);

    await expect(readThirdPartyNotices()).rejects.toBe(error);
  });
});
