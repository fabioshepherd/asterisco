import { describe, expect, it } from "vitest";

import { decodeText, encodeText } from "./text-format";

describe("decodeText", () => {
  it("hands the editor LF text without a BOM and remembers the file's format", () => {
    expect(decodeText("﻿# T\r\n\r\nline\r\n")).toEqual({
      text: "# T\n\nline\n",
      format: { eol: "\r\n", bom: true, finalNewline: true },
    });
  });

  it("reads a plain LF file as LF, no BOM", () => {
    expect(decodeText("# T\n\nline\n")).toEqual({
      text: "# T\n\nline\n",
      format: { eol: "\n", bom: false, finalNewline: true },
    });
  });

  it("notes a missing final newline", () => {
    expect(decodeText("# T\r\n\r\nno newline").format).toEqual({
      eol: "\r\n",
      bom: false,
      finalNewline: false,
    });
  });

  it("takes the majority line ending of a mixed file", () => {
    expect(decodeText("a\r\nb\r\nc\n").format.eol).toBe("\r\n");
    expect(decodeText("a\nb\nc\r\n").format.eol).toBe("\n");
  });

  it("treats an empty file as LF with a final newline", () => {
    expect(decodeText("").format).toEqual({ eol: "\n", bom: false, finalNewline: true });
  });
});

describe("encodeText", () => {
  it("writes text as is when the document has no remembered format", () => {
    expect(encodeText("a\nb", undefined)).toBe("a\nb");
  });

  it("re-applies CRLF, the BOM and the missing final newline", () => {
    expect(encodeText("# T\n\nedited\n", { eol: "\r\n", bom: true, finalNewline: false })).toBe(
      "﻿# T\r\n\r\nedited",
    );
  });

  it("adds the final newline back when the file had one", () => {
    expect(encodeText("a\nb", { eol: "\n", bom: false, finalNewline: true })).toBe("a\nb\n");
  });

  it("round-trips what decodeText read", () => {
    for (const raw of [
      "﻿# T\r\n\r\nline\r\n",
      "# T\r\n\r\nno newline",
      "plain\n",
      "﻿bom only",
      "",
    ]) {
      const { text, format } = decodeText(raw);
      expect(encodeText(text, format)).toBe(raw);
    }
  });
});
