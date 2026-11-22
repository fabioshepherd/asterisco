import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@/i18n";
import i18n from "@/i18n";

import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders the localized fallback and a reload button when a child throws", () => {
    // React logs the caught error to console.error; silence the expected noise.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary variant="root" onReset={() => undefined}>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(i18n.t("error.title", { ns: "common" }));
    expect(
      screen.getByRole("button", { name: i18n.t("error.reload", { ns: "common" }) }),
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("calls onReset when the reload button is clicked", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onReset = vi.fn();
    const user = userEvent.setup();

    render(
      <ErrorBoundary variant="root" onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );

    await user.click(
      screen.getByRole("button", { name: i18n.t("error.reload", { ns: "common" }) }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it("renders children unchanged when nothing throws", () => {
    render(
      <ErrorBoundary variant="editor">
        <p>healthy child</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("healthy child")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
