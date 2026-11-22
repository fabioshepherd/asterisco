/**
 * How a file on disk spells its text, beyond the Markdown itself: line endings,
 * a UTF-8 byte-order mark and whether the last line ends with a newline. The
 * editor works on LF text without a BOM; the format is remembered at load and
 * re-applied on save, so an edited CRLF file stays CRLF instead of turning into
 * a whole-file `git diff`.
 */
export interface TextFormat {
  /** Line ending to write: the one most lines of the file used. */
  eol: "\n" | "\r\n";
  /** The file started with a U+FEFF byte-order mark. */
  bom: boolean;
  /** The file's last line ended with a newline (an empty file counts as yes). */
  finalNewline: boolean;
}

const BOM = "﻿";

/** Split raw file text into the LF, BOM-less text the editor works on and its format. */
export function decodeText(raw: string): { text: string; format: TextFormat } {
  const bom = raw.startsWith(BOM);
  const body = bom ? raw.slice(BOM.length) : raw;
  const crlf = body.split("\r\n").length - 1;
  const lf = body.split("\n").length - 1 - crlf;
  const text = crlf > 0 ? body.replaceAll("\r\n", "\n") : body;
  return {
    text,
    format: {
      // A mixed file is written back with the ending most of its lines use.
      eol: crlf > lf ? "\r\n" : "\n",
      bom,
      finalNewline: text === "" || text.endsWith("\n"),
    },
  };
}

/**
 * Spell editor text the way the file was spelled. Without a remembered format
 * (an untitled document, a dropped file) the text is written as is.
 */
export function encodeText(text: string, format: TextFormat | undefined): string {
  if (!format) return text;
  let out = text;
  if (!format.finalNewline && out.endsWith("\n")) out = out.slice(0, -1);
  else if (format.finalNewline && out !== "" && !out.endsWith("\n")) out += "\n";
  if (format.eol === "\r\n") out = out.replace(/\r?\n/g, "\r\n");
  return format.bom ? BOM + out : out;
}
