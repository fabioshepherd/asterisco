import codeExt from "@fontsource-variable/source-code-pro/files/source-code-pro-latin-ext-wght-normal.woff2?url";
import codeNormal from "@fontsource-variable/source-code-pro/files/source-code-pro-latin-wght-normal.woff2?url";
import sansExt from "@fontsource-variable/source-sans-3/files/source-sans-3-latin-ext-wght-normal.woff2?url";
import sansNormal from "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url";
import serifItalicExt from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-ext-standard-italic.woff2?url";
import serifNormalExt from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-ext-standard-normal.woff2?url";
import serifItalic from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-standard-italic.woff2?url";
import serifNormal from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-standard-normal.woff2?url";
import { bytesToBase64 } from "@/lib/base64";
import { log } from "@/lib/log";
import { type EditorFontFamily, useSettings } from "@/stores/settings";

// fontsource subset ranges, copied verbatim from its CSS. The subset files are
// disjoint (the latin-ext file does NOT contain basic latin), so each @font-face
// MUST declare its range — otherwise the latin-ext face shadows the latin one and
// breaks common glyphs. Ranges are identical across the three Source cuts.
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

interface FontFace {
  family: string;
  style: "normal" | "italic";
  weight: string;
  url: string;
  unicodeRange: string;
}

/** Code always renders in Source Code Pro (latin + latin-ext). */
const CODE_FACES: FontFace[] = [
  { family: "Source Code Pro Variable", style: "normal", weight: "200 900", url: codeNormal, unicodeRange: LATIN }, // prettier-ignore
  { family: "Source Code Pro Variable", style: "normal", weight: "200 900", url: codeExt, unicodeRange: LATIN_EXT }, // prettier-ignore
];

/** Reading-body faces per `editorFontFamily` (latin + latin-ext: covers Latin-script languages). */
const READING_FACES: Record<EditorFontFamily, FontFace[]> = {
  serif: [
    {
      family: "Source Serif 4 Variable",
      style: "normal",
      weight: "200 900",
      url: serifNormal,
      unicodeRange: LATIN,
    },
    {
      family: "Source Serif 4 Variable",
      style: "normal",
      weight: "200 900",
      url: serifNormalExt,
      unicodeRange: LATIN_EXT,
    },
    {
      family: "Source Serif 4 Variable",
      style: "italic",
      weight: "200 900",
      url: serifItalic,
      unicodeRange: LATIN,
    },
    {
      family: "Source Serif 4 Variable",
      style: "italic",
      weight: "200 900",
      url: serifItalicExt,
      unicodeRange: LATIN_EXT,
    },
  ],
  sans: [
    {
      family: "Source Sans 3 Variable",
      style: "normal",
      weight: "200 900",
      url: sansNormal,
      unicodeRange: LATIN,
    },
    {
      family: "Source Sans 3 Variable",
      style: "normal",
      weight: "200 900",
      url: sansExt,
      unicodeRange: LATIN_EXT,
    },
  ],
};

async function toFontFaceRule(face: FontFace): Promise<string | null> {
  try {
    const response = await fetch(face.url);
    const base64 = bytesToBase64(new Uint8Array(await response.arrayBuffer()));
    return [
      "@font-face {",
      `  font-family: "${face.family}";`,
      `  font-style: ${face.style};`,
      `  font-weight: ${face.weight};`,
      "  font-display: swap;",
      `  unicode-range: ${face.unicodeRange};`,
      `  src: url(data:font/woff2;base64,${base64}) format("woff2-variations");`,
      "}",
    ].join("\n");
  } catch (error) {
    log.warn("Export font embed failed; falling back to the system stack", error);
    return null;
  }
}

/**
 * Build `@font-face` rules with the document fonts inlined as base64 woff2, so a
 * standalone HTML export renders identically offline. Embeds the selected reading
 * font plus Source Code Pro for code (each as latin + latin-ext subsets); failures
 * degrade to the system font stack.
 */
export async function inlineExportFonts(): Promise<string> {
  const family = useSettings.getState().editorFontFamily;
  // `?? serif` guards a persisted setting that predates the current union.
  const faces = [...(READING_FACES[family] ?? READING_FACES.serif), ...CODE_FACES];

  const rules = await Promise.all(faces.map(toFontFaceRule));
  return rules.filter((rule): rule is string => rule !== null).join("\n");
}
