import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, FileText, X, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { FileUploadSchema } from "../lib/schemas";

interface UploadSectionProps {
  onUpload: (file: File) => void;
}

export function UploadSection({ onUpload }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      const validation = FileUploadSchema.safeParse({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (validation.success) {
        setSelectedFile(file);
      } else {
        setError(validation.error.issues[0].message);
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (file) {
      const validation = FileUploadSchema.safeParse({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (validation.success) {
        setSelectedFile(file);
      } else {
        setError(validation.error.issues[0].message);
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative group cursor-pointer transition-all duration-700 ease-[0.16, 1, 0.3, 1]",
          "aspect-[16/9] md:aspect-[2.5/1] flex flex-col items-center justify-center rounded-2xl border border-white/5 overflow-hidden",
          isDragging ? "bg-white/[0.04] border-white/20 scale-[1.02]" : "bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10"
        )}
      >
        <div className="absolute inset-0 dashed-grid opacity-10" />
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="hidden"
        />

        <div className="relative z-10 flex flex-col items-center gap-8">
          <motion.div 
            animate={selectedFile ? { scale: [1, 1.1, 1], rotate: [0, 5, 0] } : {}}
            className={cn(
              "w-20 h-20 bg-white rounded-2xl flex items-center justify-center transition-all duration-700 shadow-[0_0_50px_rgba(255,255,255,0.1)]",
              selectedFile ? "rotate-0" : "rotate-6 group-hover:rotate-0"
            )}
          >
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
              {selectedFile ? (
                <FileText className="w-5 h-5 text-white" />
              ) : (
                <Upload className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
              )}
            </div>
          </motion.div>

          <div className="text-center space-y-3">
            <h3 className="text-xl font-light text-white tracking-tight">
              {selectedFile ? selectedFile.name : error ? "Upload Failed" : "Buffer Document"}
            </h3>
            <p className={cn(
              "text-[10px] max-w-[280px] mx-auto leading-relaxed uppercase tracking-[0.2em] font-bold transition-colors",
              error ? "text-red-500" : "text-zinc-500"
            )}>
              {selectedFile 
                ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • STRUCTURAL HIERARCHY MAPPED` 
                : error ? error : "Drop PDF here or initialize local file system access"}
            </p>
          </div>
        </div>

        {selectedFile && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            className="absolute top-8 right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-20 group/close"
          >
            <X className="w-4 h-4 text-zinc-500 group-hover/close:text-white transition-colors" />
          </button>
        )}

        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/10 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/10 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/10 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/10 rounded-br-2xl" />
      </motion.div>

      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-wrap justify-center items-center gap-10 px-10 py-5 rounded-full bg-white/[0.02] border border-white/5 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">Extraction Protocol</span>
            <span className="text-[10px] font-mono font-medium text-zinc-400">ARCH-RECON v2.4</span>
          </div>
          <div className="w-px h-8 bg-white/5 hidden sm:block" />
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">Security Layer</span>
            <span className="text-[10px] font-mono font-medium text-zinc-400">ENCRYPTED-AES</span>
          </div>
          <div className="w-px h-8 bg-white/5 hidden sm:block" />
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">Data Retention</span>
            <span className="text-[10px] font-mono font-medium text-emerald-500/60 uppercase">Volatile Memory Only</span>
          </div>
        </div>

        <button
          disabled={!selectedFile}
          onClick={() => selectedFile && onUpload(selectedFile)}
          className={cn(
            "group relative px-16 py-6 rounded-full font-bold text-xs transition-all duration-500 flex items-center gap-4 overflow-hidden uppercase tracking-[0.3em]",
            selectedFile 
              ? "bg-white text-black hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_20px_50px_rgba(255,255,255,0.1)]" 
              : "bg-white/5 text-zinc-800 cursor-not-allowed border border-white/5 opacity-50"
          )}
        >
          <span className="relative z-10">Initialize Reconstruction</span>
          <ArrowRight className={cn(
            "w-4 h-4 transition-transform duration-700 relative z-10",
            selectedFile && "group-hover:translate-x-2"
          )} />
          {selectedFile && (
            <motion.div 
              layoutId="glow"
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            />
          )}
        </button>
      </div>
    </div>
  );

}
