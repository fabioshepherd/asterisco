import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import "@/i18n";
import { EmptyState } from "@/features/welcome/EmptyState";

import { StatusBar } from "./StatusBar";

expect.extend(toHaveNoViolations);

/**
 * Accessibility smoke tests (WCAG 2.2 AA) on key components. axe runs a subset of
 * rules in jsdom (no layout-dependent checks like color-contrast), which still
 * catches the high-value issues: missing names/labels, invalid roles, and ARIA.
 */
describe("accessibility", () => {
  it("StatusBar has no detectable a11y violations", async () => {
    const { container } = render(<StatusBar />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("EmptyState has no detectable a11y violations", async () => {
    const { container } = render(<EmptyState />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
