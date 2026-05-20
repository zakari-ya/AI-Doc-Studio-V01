/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "motion/react";
import { UploadSection } from "./components/UploadSection";
import { ProcessingState } from "./components/ProcessingState";
import { LandingPage } from "./components/LandingPage";
import { processDocumentWithStorage } from "./lib/openrouter";

type AppState = "LANDING" | "UPLOAD" | "PROCESSING" | "SUCCESS" | "ERROR";
type ProcessingPhase = "uploading" | "extracting" | "reconstructing" | "finalizing";

const EditorWorkspace = lazy(() =>
  import("./components/EditorWorkspace").then((module) => ({
    default: module.EditorWorkspace,
  })),
);

export default function App() {
  const { getToken } = useAuth();
  const [state, setState] = useState<AppState>("LANDING");
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>("uploading");
  const [markdown, setMarkdown] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      const result = await processDocumentWithStorage(file, getToken);
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
    setState("UPLOAD");
    setProcessingPhase("uploading");
    setMarkdown("");
    setOriginalText("");
    setFileName("");
    setError(null);
    setNotice(null);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-foreground selection:bg-white/10 dashed-grid">
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-[2rem] border border-white/10 bg-black/60 p-8 text-center shadow-[0_0_80px_rgba(255,255,255,0.06)] backdrop-blur-2xl">
            <img src="/favicone.png" className="mx-auto mb-6 h-10 w-10 object-contain" alt="AI-Doc-Studio Logo" />
            <h1 className="mb-4 font-serif text-3xl italic tracking-tight text-white">
              Secure entry required
            </h1>
            <p className="mb-8 text-sm leading-6 text-zinc-500">
              Sign in to upload private PDFs, run reconstruction, and keep every document tied to your account.
            </p>
            <SignInButton mode="modal">
              <button className="w-full rounded-full bg-white px-8 py-4 text-[10px] font-bold uppercase tracking-[0.35em] text-black transition hover:bg-zinc-200">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="fixed right-4 top-4 z-[60] rounded-full border border-white/10 bg-black/70 p-2 backdrop-blur-xl">
          <UserButton afterSignOutUrl="/" />
        </div>
        <AnimatePresence mode="wait">
        {state === "LANDING" && (
          <LandingPage key="landing" onStart={() => setState("UPLOAD")} />
        )}

        {state === "UPLOAD" && (
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
                  onClick={() => setState("LANDING")}
                  className="text-[9px] md:text-[10px] font-bold text-zinc-700 hover:text-white uppercase tracking-[0.3em] md:tracking-[0.4em] transition-all flex items-center gap-3 md:gap-4 group"
                >
                  <div className="w-6 md:w-8 h-px bg-zinc-800 group-hover:w-10 md:group-hover:w-12 group-hover:bg-white transition-all" />
                  Back to Overview
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state === "PROCESSING" && (
          <ProcessingState key="processing" phase={processingPhase} />
        )}

        {state === "SUCCESS" && (
          <Suspense fallback={<ProcessingState key="editor-loading" phase="finalizing" />}>
            <EditorWorkspace
              key="success"
              markdown={markdown}
              notice={notice}
              original={originalText}
              fileName={fileName}
              onBack={handleReset}
              onHome={() => setState("LANDING")}
            />
          </Suspense>
        )}

        {state === "ERROR" && (
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
      </SignedIn>
    </div>
  );
}
