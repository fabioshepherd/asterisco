import { describe, it, expect } from "vitest";

import { bytesToBase64 } from "./base64";

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
}

describe("bytesToBase64", () => {
  it("round-trips through atob", () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 128, 64]);
    const restored = base64ToBytes(bytesToBase64(original));
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it("handles payloads larger than one chunk without losing bytes", () => {
    // Exceed the 0x8000 chunk boundary so a naive String.fromCharCode(...all)
    // would overflow the argument limit and chunking is actually exercised.
    const big = new Uint8Array(0x8000 * 2 + 5);
    for (let i = 0; i < big.length; i += 1) big[i] = i % 256;
    const restored = base64ToBytes(bytesToBase64(big));
    expect(restored.length).toBe(big.length);
    expect(Array.from(restored)).toEqual(Array.from(big));
  });
});
