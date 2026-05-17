import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, X } from "lucide-react";

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
      className="fixed inset-0 z-50 flex flex-col items-center bg-[#030303] overflow-hidden"
    >
      <div className="absolute inset-0 dashed-grid opacity-[0.03]" />
      
      <div className="relative flex flex-col items-center h-full w-full max-w-lg">
        {/* Header Branding for PWA feel */}
        <header className="w-full h-14 flex items-center justify-between px-6 shrink-0 relative z-10">
           <div className="flex items-center gap-3">
             <FileText className="w-5 h-5 text-white" />
             <span className="font-bold text-white text-sm">AI Studio</span>
           </div>
           <X className="w-5 h-5 text-zinc-500" />
        </header>

        {/* Mockup Preview Area */}
        <div className="flex-1 w-full flex items-center justify-center px-6">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="relative w-full aspect-[3/4] bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
           >
              {/* Content Mockup */}
              <div className="p-8 space-y-6">
                 <div className="h-4 w-2/3 bg-white/10 rounded-md" />
                 <div className="space-y-3">
                   <div className="h-2 w-full bg-white/5 rounded-md" />
                   <div className="h-2 w-full bg-white/5 rounded-md" />
                   <div className="h-2 w-4/5 bg-white/5 rounded-md" />
                 </div>
                 <div className="grid grid-cols-2 gap-4 pt-4">
                   <div className="aspect-square bg-white/5 rounded-lg" />
                   <div className="aspect-square bg-white/5 rounded-lg" />
                 </div>
                 <div className="space-y-3">
                   <div className="h-2 w-full bg-white/5 rounded-md" />
                   <div className="h-2 w-2/3 bg-white/5 rounded-md" />
                 </div>
              </div>
              
              {/* Scanline Effect */}
              <motion.div 
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-2 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10"
              />
              
              {/* Bottom Technical Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/5">
                 <div className="px-2 py-0.5 border border-white/10 rounded text-[8px] font-mono text-zinc-500 bg-white/5">OCR_ACTIVE</div>
                 <div className="text-[8px] font-mono text-zinc-700 tracking-wider">L:282 P:55</div>
              </div>
           </motion.div>
        </div>

        <div className="flex flex-col items-center gap-4 text-center px-8 py-12">
          <h2 className="text-3xl font-light text-white tracking-tight leading-tight">Analyzing document structure...</h2>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">Reconstructing layout and identifying metadata patterns for Project Alpha.</p>
        </div>
        
        {/* Bottom Task Bar */}
        <div className="w-full bg-black/40 border-t border-white/5 p-8 space-y-4">
           <div className="flex justify-between items-end">
              <div className="space-y-1">
                 <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Current Task</span>
                 <div className="h-5 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p 
                        key={index}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        className="text-[12px] font-mono text-white"
                      >
                        {MESSAGES[index]}
                      </motion.p>
                    </AnimatePresence>
                 </div>
              </div>
              <span className="text-[12px] font-mono text-white">{progress.toFixed(0)}%</span>
           </div>
           
           <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${progress}%` }}
                className="h-full bg-white shadow-[0_0_15px_white]"
              />
           </div>
           
           <button className="w-full pt-4 flex items-center justify-center gap-3 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] hover:text-white transition-colors">
              <div className="flex gap-0.5">
                 <div className="w-0.5 h-3 bg-zinc-700" />
                 <div className="w-0.5 h-3 bg-zinc-700" />
              </div>
              Pause Reconstruction
           </button>
        </div>
      </div>
    </motion.div>
  );

}
