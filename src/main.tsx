import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/i18n";
import "@/styles/global.css";
import { App } from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { installGlobalErrorHandlers } from "@/app/global-error-handlers";
import { PrintView } from "@/features/export/PrintView";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

// A separate print window loads this same bundle with ?print=1.
const isPrintWindow = new URLSearchParams(window.location.search).get("print") === "1";

installGlobalErrorHandlers();

createRoot(rootElement).render(
  <StrictMode>
    {isPrintWindow ? (
      <PrintView />
    ) : (
      <ErrorBoundary variant="root">
        <App />
      </ErrorBoundary>
    )}
  </StrictMode>,
);
