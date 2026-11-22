import { Crepe } from "@milkdown/crepe";
import { describe, expect, it } from "vitest";

import { imageBlockAltText, keepImageBlockAlt } from "./image-block-alt";

async function roundTrip(markdown: string): Promise<string> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue: markdown });
  crepe.editor.config(keepImageBlockAlt);
  await crepe.create();
  const out = crepe.getMarkdown();
  await crepe.destroy();
  root.remove();
  return out;
}

describe("image block alt", () => {
  it("keeps alt and title of a standalone image verbatim", async () => {
    const md = `![Architecture](a.png "The system")\n`;
    expect(await roundTrip(md)).toBe(md);
  });

  it("keeps alt of a standalone image without title", async () => {
    const md = `![Architecture](a.png)\n`;
    expect(await roundTrip(md)).toBe(md);
  });

  it("keeps an empty alt empty", async () => {
    const md = `![](a.png)\n`;
    expect(await roundTrip(md)).toBe(md);
  });

  it("keeps inline images inside text", async () => {
    const md = `See ![diagram](b.png "t") here.\n`;
    expect(await roundTrip(md)).toBe(md);
  });
});

describe("image block alt text view", () => {
  const labels = { label: "Alt text", placeholder: "Describe the image" };

  async function mount(markdown: string): Promise<{ crepe: Crepe; root: HTMLElement }> {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const crepe = new Crepe({ root, defaultValue: markdown });
    crepe.editor.config(keepImageBlockAlt).use(imageBlockAltText(labels));
    await crepe.create();
    return { crepe, root };
  }

  it("renders the Markdown alt, not the caption, on the image", async () => {
    const { crepe, root } = await mount(`![Architecture](a.png "The system")\n`);
    const img = root.querySelector('img[data-type="image-block"]');
    expect(img?.getAttribute("alt")).toBe("Architecture");
    await crepe.destroy();
    root.remove();
  });

  it("edits the saved alt text from the field", async () => {
    const { crepe, root } = await mount(`![Architecture](a.png "The system")\n`);
    const input = root.querySelector<HTMLInputElement>(".image-alt-field input");
    expect(input?.value).toBe("Architecture");
    expect(root.querySelector(".image-alt-field")?.textContent).toBe("Alt text");
    if (!input) throw new Error("alt field missing");
    input.value = "System overview";
    input.dispatchEvent(new Event("change"));
    expect(crepe.getMarkdown()).toBe(`![System overview](a.png "The system")\n`);
    expect(root.querySelector('img[data-type="image-block"]')?.getAttribute("alt")).toBe(
      "System overview",
    );
    await crepe.destroy();
    root.remove();
  });
});
