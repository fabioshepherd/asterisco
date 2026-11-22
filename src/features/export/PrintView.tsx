import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

// KaTeX styles + fonts so exported/printed math renders correctly in the PDF.
import "katex/dist/katex.min.css";

interface PrintContent {
  contentHtml: string;
  css: string;
}

/**
 * Standalone view loaded into a separate print window (index.html?print=1).
 * It announces readiness, receives the sanitized document HTML, renders it and
 * triggers the OS print dialog (which offers "Save as PDF").
 */
export function PrintView() {
  const [content, setContent] = useState<PrintContent | null>(null);

  useEffect(() => {
    const unlisten = listen<PrintContent>("print:content", (event) => setContent(event.payload));
    void emit("print:ready");
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!content) return;
    let cancelled = false;
    const onAfterPrint = () => void emit("print:done");
    window.addEventListener("afterprint", onAfterPrint);

    // Wait for the embedded fonts (Source Serif 4 / Source Code Pro) to load and a frame to
    // paint before opening the print dialog, so the PDF never captures a
    // half-rendered, unstyled page. `document.fonts.ready` is the reliable
    // signal; the small rAF gap lets KaTeX/Mermaid layout settle.
    const print = () => {
      if (!cancelled) window.print();
    };
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => requestAnimationFrame(() => requestAnimationFrame(print)));

    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [content]);

  if (!content) return null;
  return (
    <>
      <style>{content.css}</style>
      <main dangerouslySetInnerHTML={{ __html: content.contentHtml }} />
    </>
  );
}
