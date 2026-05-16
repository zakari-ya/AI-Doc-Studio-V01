import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const MESSAGES = [
  "Analyzing document structure...",
  "Identifying paragraph boundaries...",
  "Extracting semantic hierarchies...",
  "Rebuilding table layouts...",
  "Optimizing Markdown syntax...",
  "Preparing AI reconstruction...",
  "Finalizing clean output...",
];

export function ProcessingState() {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev < MESSAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Artificial progress based on index and some fake variability
    const targetProgress = ((index + 1) / MESSAGES.length) * 100;
    const step = (targetProgress - progress) / 50;
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < targetProgress) {
          return Math.min(prev + step, targetProgress);
        }
        return prev;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, [index, progress]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030303] overflow-hidden"
    >
      <div className="absolute inset-0 dashed-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative flex flex-col items-center gap-16 scale-110">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border border-white/5 rounded-full" 
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border border-zinc-800/20 rounded-full border-dashed" 
          />
          
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.15)] z-10">
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="w-8 h-8 bg-black rounded-lg flex items-center justify-center"
             >
               <div className="w-1.5 h-4 bg-white/20 rounded-full" />
             </motion.div>
          </div>
          
          {/* Scanning Effect */}
          <motion.div 
            animate={{ y: [-64, 64, -64], opacity: [0, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 right-0 h-10 bg-gradient-to-b from-transparent via-white/5 to-transparent z-20 pointer-events-none"
          />
        </div>

        <div className="flex flex-col items-center gap-8 text-center max-w-sm">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em] block">Extraction Protocol</span>
            <div className="h-6 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={index}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="text-lg font-light text-white italic font-serif"
                >
                  {MESSAGES[index]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-4 w-full">
             <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden relative">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                  className="h-full bg-white relative z-10 shadow-[0_0_20px_white]"
                />
             </div>
             <div className="flex justify-between w-64 text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
               <span>Status: Active</span>
               <span>{progress.toFixed(0)}% Complete</span>
             </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 border border-white/5 rounded-full bg-white/[0.02] backdrop-blur-md">
         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
         <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Hardware Acceleration Active / Secure Pipe</span>
      </div>

      {/* Decorative Binary Rain Overlay (Subtle) */}
      <div className="absolute top-0 right-0 bottom-0 w-32 border-l border-white/5 opacity-20 hidden lg:block overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ y: [0, -1000] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="p-4 font-mono text-[8px] text-zinc-600 leading-none whitespace-pre"
        >
          {Array.from({ length: 100 }).map(() => (Math.random() > 0.5 ? "1" : "0")).join("\n")}
          {Array.from({ length: 100 }).map(() => (Math.random() > 0.5 ? "1" : "0")).join("\n")}
        </motion.div>
      </div>
    </motion.div>
  );

}
