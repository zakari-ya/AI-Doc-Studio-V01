import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

type ProcessingPhase = "extracting" | "reconstructing" | "finalizing";

const PHASE_COPY: Record<
  ProcessingPhase,
  {
    title: string;
    description: string;
    messages: string[];
    progressFloor: number;
    progressCeiling: number;
  }
> = {
  extracting: {
    title: "Extracting PDF text...",
    description: "Reading the PDF locally and preparing a clean text payload before the AI reconstruction step.",
    messages: [
      "Opening PDF container...",
      "Reading document pages...",
      "Collecting text blocks...",
      "Normalizing extracted text...",
    ],
    progressFloor: 6,
    progressCeiling: 38,
  },
  reconstructing: {
    title: "Reconstructing document...",
    description: "The selected model is still working. This step can take longer on slower models and larger files.",
    messages: [
      "Preparing AI reconstruction...",
      "Sending validated text to the server...",
      "Waiting for model response...",
      "Refining markdown structure...",
      "Verifying sanitized output...",
    ],
    progressFloor: 42,
    progressCeiling: 92,
  },
  finalizing: {
    title: "Opening workspace...",
    description: "Packaging the reconstructed result and preparing the editor and preview panes.",
    messages: [
      "Preparing editor state...",
      "Generating preview artifacts...",
      "Opening workspace...",
    ],
    progressFloor: 94,
    progressCeiling: 100,
  },
};

interface ProcessingStateProps {
  phase?: ProcessingPhase;
}

export function ProcessingState({ phase = "extracting" }: ProcessingStateProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(PHASE_COPY[phase].progressFloor);

  const phaseConfig = useMemo(() => PHASE_COPY[phase], [phase]);

  useEffect(() => {
    setIndex(0);
    setProgress(phaseConfig.progressFloor);
  }, [phaseConfig]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev < phaseConfig.messages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [phaseConfig]);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= phaseConfig.progressCeiling) {
          return phaseConfig.progressCeiling;
        }

        const next = prev + Math.max((phaseConfig.progressCeiling - prev) * 0.08, 0.6);
        return Math.min(next, phaseConfig.progressCeiling);
      });
    }, 180);

    return () => clearInterval(progressInterval);
  }, [phaseConfig]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center bg-[#030303] overflow-hidden"
    >
      <div className="absolute inset-0 dashed-grid opacity-[0.03]" />

      <div className="relative flex flex-col items-center h-full w-full max-w-2xl px-4 md:px-8">
        <header className="w-full h-14 md:h-20 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <img src="/favicone.png" className="w-5 h-5 md:w-6 md:h-6 object-contain" alt="AI-Doc-Studio Logo" />
            <span className="font-bold text-white text-sm md:text-base tracking-tight">AI-Doc-Studio</span>
          </div>
          <X className="w-5 h-5 text-zinc-700" />
        </header>

        <div className="flex-1 w-full flex items-center justify-center p-2 md:p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-sm aspect-[3/4] max-h-[25vh] sm:max-h-[30vh] md:max-h-[35vh] bg-[#0a0a0a] rounded-[32px] md:rounded-[48px] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="p-10 space-y-8">
              <div className="h-4 w-2/3 bg-white/10 rounded-full" />
              <div className="space-y-4">
                <div className="h-2 w-full bg-white/5 rounded-full" />
                <div className="h-2 w-full bg-white/5 rounded-full" />
                <div className="h-2 w-4/5 bg-white/5 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div className="aspect-square bg-white/[0.03] rounded-2xl border border-white/5" />
                <div className="aspect-square bg-white/[0.03] rounded-2xl border border-white/5" />
              </div>
              <div className="space-y-4">
                <div className="h-2 w-full bg-white/5 rounded-full" />
                <div className="h-2 w-2/3 bg-white/5 rounded-full" />
              </div>
            </div>

            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-4 bg-gradient-to-b from-transparent via-white/10 to-transparent z-10 pointer-events-none"
            />

            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10">
              <div className="px-2 py-0.5 border border-white/10 rounded-md text-[8px] font-mono text-zinc-500 bg-white/5">
                {phase.toUpperCase()}
              </div>
              <div className="text-[9px] font-mono text-zinc-700 tracking-[0.2em]">RECON_UNIT_01</div>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-2 md:gap-4 text-center px-8 py-6 md:py-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-light text-white tracking-tight leading-tight">
            {phaseConfig.title}
          </h2>
          <p className="text-zinc-500 text-xs md:text-sm leading-relaxed max-w-sm">
            {phaseConfig.description}
          </p>
        </div>

        <div className="w-full bg-black/40 border-t border-white/5 p-6 md:p-8 space-y-4 md:space-y-6">
          <div className="flex justify-between items-end gap-4">
            <div className="space-y-1.5 min-w-0">
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Current Status</span>
              <div className="h-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${phase}-${index}`}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    className="text-[14px] md:text-lg font-mono text-white italic font-serif"
                  >
                    {phaseConfig.messages[index]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <span className="text-[14px] md:text-lg font-mono text-white tabular-nums">
              {progress.toFixed(0)}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              className="h-full bg-white shadow-[0_0_20px_white]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
