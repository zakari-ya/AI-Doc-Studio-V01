import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion } from "motion/react";
import { ArrowRight, Database, FileText, Upload, X } from "lucide-react";
import { fileTypeFromBuffer } from "file-type";
import { cn } from "../lib/utils";
import {
  FileUploadSchema,
  MAX_PDF_FILE_SIZE_BYTES,
  MAX_PDF_PAGE_COUNT,
} from "../lib/schemas";

interface UploadSectionProps {
  onUpload: (file: File) => void;
}

const MAX_FILE_SIZE_MB = Math.round(MAX_PDF_FILE_SIZE_BYTES / (1024 * 1024));

export function UploadSection({ onUpload }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndSetFile = async (file: File) => {
    setError(null);
    setIsAnalyzing(true);

    try {
      const validation = FileUploadSchema.safeParse({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (!validation.success) {
        setSelectedFile(null);
        setError(validation.error.issues[0].message);
        return;
      }

      const arrayBuffer = await file.slice(0, 4100).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const type = await fileTypeFromBuffer(uint8Array);

      if (!type || type.mime !== "application/pdf") {
        setSelectedFile(null);
        setError(
          "Security violation: file signature does not match a valid PDF. Upload an unmodified PDF file.",
        );
        return;
      }

      setSelectedFile(file);
    } catch (analysisError) {
      console.error("Analysis Error:", analysisError);
      setSelectedFile(null);
      setError("File verification failed. Try another PDF or re-export the file before uploading.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void validateAndSetFile(file);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void validateAndSetFile(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 space-y-8 md:space-y-16 py-8 md:py-16">
      <div className="md:hidden w-full space-y-4 mb-8">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg w-fit">
          <Database className="w-3 h-3 text-zinc-500" />
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
            Project Alpha
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Initialize Workspace
        </h1>
        <p className="text-sm sm:text-base text-zinc-500 leading-relaxed max-w-xs">
          Recover structure from digital PDFs and reconstruct clean Markdown safely.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative group cursor-pointer transition-all duration-700 ease-[0.16,1,0.3,1]",
          "aspect-square md:aspect-[2.5/1] flex flex-col items-center justify-center rounded-[32px] md:rounded-[48px] border-2 border-dashed overflow-hidden",
          isDragging
            ? "bg-white/[0.04] border-white scale-[0.99] shadow-[0_0_80px_rgba(255,255,255,0.1)]"
            : "bg-black border-white/10 hover:border-white/20",
        )}
      >
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

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
              "w-16 h-16 md:w-20 md:h-20 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center transition-all duration-700 shadow-2xl",
              selectedFile
                ? "rotate-0 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                : "rotate-6 group-hover:rotate-0",
            )}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-xl flex items-center justify-center">
              {isAnalyzing ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : selectedFile ? (
                <FileText className="w-6 h-6 md:w-7 md:h-7 text-white" />
              ) : (
                <Upload className="w-6 h-6 md:w-7 md:h-7 text-white/40 group-hover:text-white transition-colors" />
              )}
            </div>
          </motion.div>

          <div className="text-center space-y-4">
            <div className="flex flex-col items-center">
              <span className="px-8 py-3 bg-white text-black rounded-xl font-bold text-xs md:text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all cursor-pointer active:scale-95 shadow-xl inline-block mb-4">
                {selectedFile ? "Replace Document" : "Upload PDF"}
              </span>
              <p className="text-[9px] md:text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">
                {selectedFile ? selectedFile.name : "Drop a digital PDF to begin"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-center px-4">
            {["PDF_ONLY", "LOCAL_PARSE", "SERVER_GUARDED"].map((tag) => (
              <div
                key={tag}
                className="px-3 py-1 border border-white/5 rounded-md text-[8px] font-mono text-zinc-500 bg-white/5 uppercase tracking-widest"
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {selectedFile && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              clearFile();
            }}
            className="absolute top-8 right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-20 group/close"
          >
            <X className="w-4 h-4 text-zinc-500 group-hover/close:text-white transition-colors" />
          </button>
        )}
      </motion.div>

      <div className="flex flex-col items-center gap-6 md:gap-8">
        <button
          disabled={!selectedFile || isAnalyzing}
          onClick={() => selectedFile && onUpload(selectedFile)}
          className={cn(
            "group relative w-full sm:w-auto px-10 md:px-20 py-5 md:py-6 rounded-full font-bold text-[10px] md:text-xs transition-all duration-500 flex items-center justify-center gap-4 overflow-hidden uppercase tracking-[0.4em]",
            selectedFile && !isAnalyzing
              ? "bg-white text-black hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_20px_60px_rgba(255,255,255,0.1)]"
              : "bg-white/5 text-zinc-800 cursor-not-allowed border border-white/5 opacity-50",
          )}
        >
          {isAnalyzing ? "Analyzing Core..." : "Initialize Recovery"}
          <ArrowRight
            className={cn(
              "w-4 h-4 transition-all duration-500",
              selectedFile && !isAnalyzing ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
            )}
          />
        </button>

        <div className="max-w-2xl space-y-3 text-center px-4">
          <p className="text-[10px] md:text-[11px] text-zinc-600 uppercase tracking-[0.25em] leading-relaxed">
            PDF only • up to {MAX_FILE_SIZE_MB}MB • up to {MAX_PDF_PAGE_COUNT} pages • scanned image PDFs are not OCR processed
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
