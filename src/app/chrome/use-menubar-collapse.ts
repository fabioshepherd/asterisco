import { useEffect, useState } from "react";

/**
 * Collapse the inline menubar into a single `☰` overflow when the window gets
 * too narrow to fit it (VS Code "compact" behaviour). Watches the document
 * width via a `ResizeObserver`; no-op (stays expanded) where `ResizeObserver`
 * is unavailable (e.g. jsdom without a stub).
 */
export function useMenubarCollapse(threshold = 720): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? root.clientWidth;
      setCollapsed(width < threshold);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [threshold]);

  return collapsed;
}
