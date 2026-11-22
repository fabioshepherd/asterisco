import { Crepe } from "@milkdown/crepe";
import { describe, expect, it, vi } from "vitest";

import {
  type CrepeControlLabels,
  labelCrepeControls,
  observeCrepeControls,
} from "./crepe-control-labels";

const labels: CrepeControlLabels = {
  alignLeft: "Align column left",
  alignCenter: "Center column",
  alignRight: "Align column right",
  deleteColumn: "Delete column",
  deleteRow: "Delete row",
  addRow: "Add row",
  addColumn: "Add column",
  linkInput: "Link URL",
  confirmLink: "Apply link",
  copyLink: "Copy link",
  editLink: "Edit link",
  removeLink: "Remove link",
};

describe("Crepe control labels", () => {
  // Pins the selectors to Crepe's markup: a Milkdown upgrade that renames a
  // control fails here instead of silently leaving it unnamed.
  it("names every icon-only control Crepe renders", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const crepe = new Crepe({
      root,
      defaultValue: "| a | b |\n| - | - |\n| 1 | 2 |\n\nSee [the site](https://example.com).\n",
    });
    await crepe.create();
    labelCrepeControls(root, labels);

    const named = [...root.querySelectorAll("[aria-label]")].map((el) =>
      el.getAttribute("aria-label"),
    );
    // The block handle is only rendered on hover (covered by the e2e suite).
    for (const key of [
      "alignLeft",
      "alignCenter",
      "alignRight",
      "deleteColumn",
      "deleteRow",
      "addRow",
      "addColumn",
      "linkInput",
    ] as const) {
      expect(named, key).toContain(labels[key]);
    }
    const icons = root.querySelectorAll(".milkdown-icon svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const svg of icons) expect(svg.getAttribute("aria-hidden")).toBe("true");

    await crepe.destroy();
    root.remove();
  });

  it("hides the pointer-only block handle instead of naming it as a button", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="milkdown-block-handle"><div class="operation-item"></div><div class="operation-item"></div></div>';
    labelCrepeControls(root, labels);
    expect(root.querySelector(".milkdown-block-handle")?.getAttribute("aria-hidden")).toBe("true");
    for (const item of root.querySelectorAll(".operation-item")) {
      expect(item.getAttribute("role")).toBeNull();
      expect(item.getAttribute("aria-label")).toBeNull();
    }
  });
});

describe("observeCrepeControls (EDITOR-07)", () => {
  /** MutationObserver callbacks run as microtasks. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("names a control Crepe adds later, whether it is the added node or inside it", async () => {
    const root = document.createElement("div");
    const dispose = observeCrepeControls(root, labels);

    const preview = document.createElement("div");
    preview.className = "milkdown-link-preview";
    preview.innerHTML = '<span class="link-edit-button"></span>';
    root.appendChild(preview);
    await flush();
    expect(preview.querySelector(".link-edit-button")?.getAttribute("aria-label")).toBe(
      "Edit link",
    );

    const remove = document.createElement("span");
    remove.className = "link-remove-button";
    preview.appendChild(remove);
    await flush();
    expect(remove.getAttribute("aria-label")).toBe("Remove link");
    expect(remove.getAttribute("role")).toBe("button");
    dispose();
  });

  it("does not rescan the editor for a mutation that adds no control", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Hello</p>";
    const dispose = observeCrepeControls(root, labels);
    const scan = vi.spyOn(root, "querySelectorAll");

    const paragraph = root.querySelector("p")!;
    paragraph.appendChild(document.createTextNode(" world"));
    const next = document.createElement("p");
    next.textContent = "Typed";
    root.appendChild(next);
    await flush();

    expect(scan).not.toHaveBeenCalled();
    dispose();
  });
});
