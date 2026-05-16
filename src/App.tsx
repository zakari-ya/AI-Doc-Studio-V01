/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadSection } from "./components/UploadSection";
import { ProcessingState } from "./components/ProcessingState";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { LandingPage } from "./components/LandingPage";
import { extractTextFromPDF } from "./lib/pdf";
import { reconstructDocument } from "./lib/openrouter";

type AppState = "LANDING" | "UPLOAD" | "PROCESSING" | "SUCCESS" | "ERROR";

export default function App() {
  const [state, setState] = useState<AppState>("LANDING");
  const [markdown, setMarkdown] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async (file: File) => {
    setFileName(file.name);
    setState("PROCESSING");
    setError(null);

    try {
      // Rate Limit Check for OCR/Extraction Pipeline
      const ocrCheck = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name })
      });

      if (!ocrCheck.ok) {
        const errorData = await ocrCheck.json().catch(() => ({}));
        throw new Error(errorData.message || "OCR Reconstruction rate limit reached. Please wait.");
      }

      const raw = await extractTextFromPDF(file);
      setOriginalText(raw);
      const reconstructed = await reconstructDocument(raw);
      setMarkdown(reconstructed);
      setState("SUCCESS");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setState("ERROR");
    }
  };

  const handleReset = () => {
    setState("UPLOAD");
    setMarkdown("");
    setOriginalText("");
    setFileName("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-foreground selection:bg-white/10 dashed-grid">
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
            className="flex flex-col items-center justify-center min-h-screen p-8"
          >
            <div className="w-full max-w-4xl">
               <header className="text-center space-y-6 mb-20">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="h-px w-12 bg-white/20" />
                    <h2 className="text-4xl font-light tracking-tighter text-white italic font-serif">Laboratory / 01</h2>
                  </motion.div>
                  <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.4em]">Select document for structural reconstruction</p>
               </header>
               <UploadSection onUpload={handleProcess} />
               <div className="flex justify-center mt-20">
                 <button 
                   onClick={() => setState("LANDING")}
                   className="text-[10px] font-bold text-zinc-700 hover:text-white uppercase tracking-[0.4em] transition-all flex items-center gap-4 group"
                 >
                   <div className="w-8 h-px bg-zinc-800 group-hover:w-12 group-hover:bg-white transition-all" />
                   Back to Overview
                 </button>
               </div>
            </div>
          </motion.div>
        )}

        {state === "PROCESSING" && (
          <ProcessingState key="processing" />
        )}

        {state === "SUCCESS" && (
          <EditorWorkspace 
            key="success" 
            markdown={markdown} 
            original={originalText}
            fileName={fileName}
            onBack={handleReset}
          />
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
              <h2 className="text-2xl font-light text-white tracking-tighter italic font-serif mb-4">Pipeline Failure</h2>
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
    </div>
  );
}
