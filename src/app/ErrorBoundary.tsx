import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { log } from "@/lib/log";
import { cn } from "@/lib/utils";

type Variant = "root" | "editor";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** `root` renders a full-screen centered fallback; `editor` a compact inline one. */
  variant?: Variant;
  /** Overrides the default reset action (full reload for `root`); injectable for tests. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Localized fallback UI. Split out so it can use hooks (the boundary is a class). */
function ErrorFallback({ variant, onReset }: { variant: Variant; onReset: () => void }) {
  const { t } = useTranslation("common");

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        variant === "root"
          ? "h-full justify-center bg-bg p-8 text-fg"
          : "m-4 rounded-lg border border-border bg-bg p-6 text-fg shadow-card",
      )}
    >
      <h2 className="text-lg font-semibold">{t("error.title")}</h2>
      <p className="max-w-prose text-sm text-muted-fg">{t("error.message")}</p>
      <Button variant="outline" onClick={onReset}>
        {t("error.reload")}
      </Button>
    </div>
  );
}

/**
 * React error boundary catching render-time throws in the editor stack
 * (Crepe/Milkdown, CodeMirror, Mermaid, KaTeX) so a crash degrades gracefully
 * instead of white-screening the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error("[ErrorBoundary] caught render error", error, info.componentStack);
  }

  private handleReset = (): void => {
    const { onReset, variant = "root" } = this.props;
    if (onReset) {
      onReset();
      this.setState({ hasError: false });
      return;
    }
    if (variant === "root") {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    const { variant = "root", children } = this.props;
    if (this.state.hasError) {
      return <ErrorFallback variant={variant} onReset={this.handleReset} />;
    }
    return children;
  }
}
