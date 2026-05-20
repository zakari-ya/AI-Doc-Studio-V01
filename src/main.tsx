import { StrictMode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
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

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not configured.");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <App />
    </ClerkProvider>
  </StrictMode>,
);
