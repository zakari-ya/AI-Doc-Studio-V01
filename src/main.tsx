import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function cleanupLegacyOfflineState() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) =>
              [registration.active, registration.installing, registration.waiting]
                .filter(Boolean)
                .some((worker) => worker?.scriptURL.endsWith("/service-worker.js")),
            )
            .map((registration) => registration.unregister()),
        );

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith("doc-studio-"))
              .map((key) => caches.delete(key)),
          );
        }
      } catch (error) {
        console.error("Legacy service worker cleanup failed:", error);
      }
    })();
  });
}

cleanupLegacyOfflineState();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
