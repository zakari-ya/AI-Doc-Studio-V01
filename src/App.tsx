/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "motion/react";
import { UploadSection } from "./components/UploadSection";
import { ProcessingState } from "./components/ProcessingState";
import { LandingPage } from "./components/LandingPage";
import { AuthModal } from "./components/AuthModal";
import { processDocumentWithStorage } from "./lib/openrouter";
import { getSupabaseBrowserClient } from "./lib/supabase";

type AppState = "LANDING" | "UPLOAD" | "PROCESSING" | "SUCCESS" | "ERROR";
type ProcessingPhase = "uploading" | "extracting" | "reconstructing" | "finalizing";
type AuthModalPhase = "idle" | "sending" | "sent" | "callback";

const PENDING_START_KEY = "ai-doc-studio:pending-start";
const AUTH_QUERY_KEYS = [
  "token_hash",
  "type",
  "error",
  "error_code",
  "error_description",
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "provider_token",
  "provider_refresh_token",
] as const;

const EditorWorkspace = lazy(() =>
  import("./components/EditorWorkspace").then((module) => ({
    default: module.EditorWorkspace,
  })),
);

function markPendingStart() {
  sessionStorage.setItem(PENDING_START_KEY, "1");
}

function clearPendingStart() {
  sessionStorage.removeItem(PENDING_START_KEY);
}

function consumePendingStart() {
  const hasPendingStart = sessionStorage.getItem(PENDING_START_KEY) === "1";
  if (hasPendingStart) {
    clearPendingStart();
  }

  return hasPendingStart;
}

function hasPendingStart() {
  return sessionStorage.getItem(PENDING_START_KEY) === "1";
}

function normalizeOtpType(value: string | null): EmailOtpType | null {
  switch (value) {
    case "email":
    case "recovery":
    case "invite":
    case "email_change":
      return value;
    default:
      return null;
  }
}

function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function clearAuthArtifactsFromUrl() {
  const url = new URL(window.location.href);
  const hashParams = getHashParams();

  for (const key of AUTH_QUERY_KEYS) {
    url.searchParams.delete(key);
    hashParams.delete(key);
  }

  const nextUrl = `${url.pathname}${url.search}${hashParams.toString() ? `#${hashParams.toString()}` : ""}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function hasAuthUrlPayload() {
  const url = new URL(window.location.href);
  const hashParams = getHashParams();

  return (
    Boolean(url.searchParams.get("token_hash")) ||
    Boolean(url.searchParams.get("error_description")) ||
    hashParams.has("access_token") ||
    hashParams.has("refresh_token") ||
    hashParams.has("error_description")
  );
}

function createAuthErrorMessage(error: string) {
  return error.trim() || "Authentication failed. Request a fresh magic link and try again.";
}

export default function App() {
  const [state, setState] = useState<AppState>("LANDING");
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>("uploading");
  const [markdown, setMarkdown] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalPhase, setAuthModalPhase] = useState<AuthModalPhase>("idle");
  const [authModalEmail, setAuthModalEmail] = useState("");
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isAuthenticated = Boolean(session?.user);
  const pendingStart = hasPendingStart();
  const userEmail = session?.user.email ?? null;

  const resetWorkspaceState = (nextState: AppState = "UPLOAD") => {
    setState(nextState);
    setProcessingPhase("uploading");
    setMarkdown("");
    setOriginalText("");
    setFileName("");
    setError(null);
    setNotice(null);
  };

  const handleSignedInState = (nextSession: Session | null) => {
    setSession(nextSession);
    setIsSigningOut(false);

    if (!nextSession?.user) {
      return;
    }

    clearAuthArtifactsFromUrl();
    setIsAuthModalOpen(false);
    setAuthModalPhase("idle");
    setAuthModalError(null);

    if (consumePendingStart()) {
      resetWorkspaceState("UPLOAD");
    }
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const otpType = normalizeOtpType(url.searchParams.get("type"));
    const searchError = url.searchParams.get("error_description");
    const hashError = getHashParams().get("error_description");
    const hasCallbackPayload = hasAuthUrlPayload();
    let isDisposed = false;

    if (hasCallbackPayload) {
      setIsAuthModalOpen(true);
      setAuthModalPhase("callback");
      setAuthModalError(null);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (isDisposed) {
        return;
      }

      if (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && nextSession)) {
        handleSignedInState(nextSession);
        return;
      }

      if (event === "SIGNED_OUT") {
        clearPendingStart();
        resetWorkspaceState("LANDING");
        setSession(null);
        setIsAuthModalOpen(false);
        setAuthModalPhase("idle");
        setAuthModalError(null);
      }
    });

    void (async () => {
      try {
        if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });

          clearAuthArtifactsFromUrl();

          if (verifyError && !isDisposed) {
            setIsAuthModalOpen(true);
            setAuthModalPhase("idle");
            setAuthModalError(createAuthErrorMessage(verifyError.message));
          }
        } else if ((searchError || hashError) && !isDisposed) {
          clearAuthArtifactsFromUrl();
          setIsAuthModalOpen(true);
          setAuthModalPhase("idle");
          setAuthModalError(
            createAuthErrorMessage(decodeURIComponent(searchError ?? hashError ?? "")),
          );
        }

        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (isDisposed) {
          return;
        }

        if (sessionError) {
          setIsAuthModalOpen(true);
          setAuthModalPhase("idle");
          setAuthModalError("Authentication session could not be restored.");
        } else {
          setSession(currentSession);
          if (currentSession?.user) {
            handleSignedInState(currentSession);
          } else if (hasCallbackPayload) {
            setIsAuthModalOpen(true);
            setAuthModalPhase("idle");
            setAuthModalError(
              "Magic link sign-in did not complete. Request a fresh link and try again.",
            );
          }
        }
      } finally {
        if (!isDisposed) {
          setIsAuthReady(true);
        }
      }
    })();

    return () => {
      isDisposed = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady || isAuthenticated || state === "LANDING") {
      return;
    }

    resetWorkspaceState("LANDING");
    setIsAuthModalOpen(true);
    setAuthModalPhase("idle");
    setAuthModalError("Your session expired. Sign in again to continue.");
  }, [isAuthReady, isAuthenticated, state]);

  const handleOpenAuthModal = (queueStart = false) => {
    if (queueStart) {
      markPendingStart();
    }

    setIsAuthModalOpen(true);
    setAuthModalPhase("idle");
    setAuthModalError(null);
  };

  const handleCloseAuthModal = () => {
    if (authModalPhase === "callback") {
      return;
    }

    if (authModalPhase === "idle") {
      clearPendingStart();
    }

    setIsAuthModalOpen(false);
    setAuthModalPhase("idle");
    setAuthModalError(null);
  };

  const handleRequestMagicLink = async () => {
    const supabase = getSupabaseBrowserClient();
    const email = authModalEmail.trim().toLowerCase();

    if (!email) {
      setAuthModalError("Enter the invited email address you want to use.");
      return;
    }

    setAuthModalPhase("sending");
    setAuthModalError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });

    if (signInError) {
      setAuthModalPhase("idle");
      setAuthModalError(createAuthErrorMessage(signInError.message));
      return;
    }

    setAuthModalEmail(email);
    setAuthModalPhase("sent");
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    setIsSigningOut(true);
    setAuthModalError(null);

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setIsSigningOut(false);
      setAuthModalError(createAuthErrorMessage(signOutError.message));
      setIsAuthModalOpen(true);
      setAuthModalPhase("idle");
      return;
    }

    clearPendingStart();
    resetWorkspaceState("LANDING");
    setSession(null);
    setAuthModalEmail("");
    setIsSigningOut(false);
  };

  const handleStart = () => {
    if (isAuthenticated) {
      resetWorkspaceState("UPLOAD");
      return;
    }

    handleOpenAuthModal(true);
  };

  const handleProcess = async (file: File) => {
    setFileName(file.name);
    setState("PROCESSING");
    setProcessingPhase("uploading");
    setError(null);
    setNotice(null);
    setMarkdown("");
    setOriginalText("");

    let phaseTimer: number | undefined;
    let reconstructTimer: number | undefined;

    try {
      phaseTimer = window.setTimeout(() => setProcessingPhase("extracting"), 900);
      reconstructTimer = window.setTimeout(
        () => setProcessingPhase("reconstructing"),
        2600,
      );
      const result = await processDocumentWithStorage(file);
      setOriginalText(result.originalText);
      setMarkdown(result.markdown);
      setNotice(null);
      setProcessingPhase("finalizing");
      setState("SUCCESS");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setState("ERROR");
    } finally {
      if (phaseTimer) {
        window.clearTimeout(phaseTimer);
      }
      if (reconstructTimer) {
        window.clearTimeout(reconstructTimer);
      }
    }
  };

  const handleReset = () => {
    resetWorkspaceState("UPLOAD");
  };

  const renderLandingAuthControls = (): ReactNode => {
    if (isAuthenticated) {
      return (
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={isSigningOut}
          className="px-4 py-1.5 border border-white/10 bg-white/5 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing Out" : "Sign Out"}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleOpenAuthModal(false)}
        className="px-4 py-1.5 border border-white/10 bg-white/5 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-white/10"
      >
        Login
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#030303] text-foreground selection:bg-white/10 dashed-grid">
      <AnimatePresence mode="wait">
        {state === "LANDING" && (
          <LandingPage
            key="landing"
            authControls={renderLandingAuthControls()}
            isAuthenticated={isAuthenticated}
            onStart={handleStart}
          />
        )}

        {state === "UPLOAD" && isAuthenticated && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8"
          >
            <div className="w-full max-w-4xl">
              <header className="text-center space-y-4 md:space-y-6 mb-12 md:mb-20">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="h-px w-8 md:w-12 bg-white/20" />
                  <h2 className="text-3xl md:text-4xl font-light tracking-tighter text-white italic font-serif">
                    Laboratory / 01
                  </h2>
                </motion.div>
                <p className="text-zinc-500 font-bold text-[8px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em] px-4">
                  Select document for structural reconstruction
                </p>
              </header>
              <UploadSection onUpload={handleProcess} />
              <div className="flex justify-center mt-12 mb-12 md:mt-20">
                <button
                  onClick={() => resetWorkspaceState("LANDING")}
                  className="text-[9px] md:text-[10px] font-bold text-zinc-700 hover:text-white uppercase tracking-[0.3em] md:tracking-[0.4em] transition-all flex items-center gap-3 md:gap-4 group"
                >
                  <div className="w-6 md:w-8 h-px bg-zinc-800 group-hover:w-10 md:group-hover:w-12 group-hover:bg-white transition-all" />
                  Back to Overview
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state === "PROCESSING" && isAuthenticated && (
          <ProcessingState key="processing" phase={processingPhase} />
        )}

        {state === "SUCCESS" && isAuthenticated && (
          <Suspense fallback={<ProcessingState key="editor-loading" phase="finalizing" />}>
            <EditorWorkspace
              key="success"
              markdown={markdown}
              notice={notice}
              original={originalText}
              fileName={fileName}
              onBack={handleReset}
              onHome={() => resetWorkspaceState("LANDING")}
            />
          </Suspense>
        )}

        {state === "ERROR" && isAuthenticated && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen p-8 text-center"
          >
            <div className="relative p-12 rounded-3xl max-w-md border border-red-500/20 bg-red-500/5 backdrop-blur-3xl">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              </div>
              <h2 className="text-2xl font-light text-white tracking-tighter italic font-serif mb-4">
                Pipeline Failure
              </h2>
              <p className="text-zinc-500 mb-10 text-xs font-bold uppercase tracking-widest leading-relaxed">
                {error || "An intercept occurred during the reconstruction process."}
              </p>
              <button
                onClick={handleReset}
                className="w-full py-4 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
              >
                Re-initialize Session
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        email={authModalEmail}
        error={authModalError}
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuthModal}
        onEmailChange={setAuthModalEmail}
        onSubmit={handleRequestMagicLink}
        pendingStart={pendingStart}
        phase={authModalPhase}
      />
    </div>
  );
}
