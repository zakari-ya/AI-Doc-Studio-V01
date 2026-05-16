import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Download, 
  Copy, 
  FileText, 
  Code as CodeIcon, 
  Eye, 
  X,
  Check,
  ChevronDown
} from "lucide-react";
import { renderAsync } from "docx-preview";
import { cn } from "../lib/utils";
import { ExportSchema } from "../lib/schemas";
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  BorderStyle, 
  WidthType,
  AlignmentType,
  VerticalAlign
} from "docx";

// Helper to parse inline formatting like bold
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Match bold: **text** or __text__
  const boldRegex = /(\*\*|__)(.*?)\1/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    // Add bold text
    runs.push(new TextRun({ text: match[2], bold: true }));
    lastIndex = boldRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

interface EditorWorkspaceProps {
  markdown: string;
  original: string;
  fileName: string;
  onBack: () => void;
}

export function EditorWorkspace({ markdown, original, fileName, onBack }: EditorWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"original" | "markdown" | "preview">("markdown");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [liveMarkdown, setLiveMarkdown] = useState(markdown);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const generateDocx = async (md: string) => {
    const children: any[] = [];
    const lines = md.split("\n");
    let currentTableRows: TableRow[] = [];
    let inTable = false;

    const flushTable = () => {
      if (inTable && currentTableRows.length > 0) {
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: currentTableRows,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
          }
        }));
        children.push(new Paragraph({ text: "" }));
        inTable = false;
        currentTableRows = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Table detection
      const isTableLine = trimmedLine.startsWith("|") && trimmedLine.endsWith("|");
      const isTableSeparator = isTableLine && trimmedLine.includes("-") && !/[a-zA-Z0-9]/.test(trimmedLine);

      if (isTableLine) {
        if (isTableSeparator) {
          inTable = true;
          continue; 
        }
        
        const cellsData = trimmedLine.slice(1, -1).split("|").map(c => c.trim());
        const row = new TableRow({
          children: cellsData.map(cellText => new TableCell({
            children: [new Paragraph({ 
              children: parseInlineFormatting(cellText),
              alignment: AlignmentType.LEFT 
            })],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }))
        });
        currentTableRows.push(row);
        inTable = true;
        continue;
      } else {
        flushTable();
      }

      if (!trimmedLine) {
        children.push(new Paragraph({ text: "" }));
        continue;
      }

      // Headings
      const hMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];
        
        let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1;
        let fontSize = 32;
        
        if (level === 2) { 
          headingLevel = HeadingLevel.HEADING_2;
          fontSize = 28;
        } else if (level === 3) {
          headingLevel = HeadingLevel.HEADING_3;
          fontSize = 24;
        } else if (level >= 4) {
          headingLevel = HeadingLevel.HEADING_4;
          fontSize = 20;
        }

        children.push(new Paragraph({
          heading: headingLevel,
          children: [new TextRun({ text, bold: true, size: fontSize })],
          spacing: { before: 400, after: 200 }
        }));
        continue;
      }

      // Bullet Lists
      const bulletMatch = trimmedLine.match(/^[\-\+\*]\s+(.*)$/);
      if (bulletMatch) {
        const text = bulletMatch[1];
        children.push(new Paragraph({
          children: parseInlineFormatting(text),
          bullet: { level: 0 },
          spacing: { before: 100, after: 100 }
        }));
        continue;
      }

      // Plain Paragraph
      children.push(new Paragraph({
        children: parseInlineFormatting(trimmedLine),
        spacing: { before: 150, after: 150 }
      }));
    }
    
    // Final flush
    flushTable();

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Helvetica",
              size: 22, // 11pt
              color: "262626", // zinc-800
            },
            paragraph: {
              spacing: {
                line: 360, // 1.5 line spacing
              },
            },
          },
        },
      },
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    return await Packer.toBlob(doc);
  };

  useEffect(() => {
    setIsPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const blob = await generateDocx(liveMarkdown);
        setDocxBlob(blob);
      } catch (err) {
        console.error("Docx Generation Error:", err);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 800); // Debounce DOCX generation
    return () => clearTimeout(timer);
  }, [liveMarkdown]);

  useEffect(() => {
    let isMounted = true;
    
    async function render() {
      if (activeTab === "preview" && previewRef.current && docxBlob) {
        try {
          // Clear previous content
          previewRef.current.innerHTML = "";
          await renderAsync(docxBlob, previewRef.current, undefined, {
            className: "docx-render",
            inWrapper: false,
          });
        } catch (err) {
          if (isMounted) console.error("Docx Preview Error:", err);
        }
      }
    }

    render();
    return () => { isMounted = false; };
  }, [docxBlob, activeTab]);

  const getCurrentMarkdown = async () => {
    return liveMarkdown;
  };

  const handleTabChange = async (tab: "original" | "markdown" | "preview") => {
    if (tab === "markdown") {
      const currentMd = await getCurrentMarkdown();
      setLiveMarkdown(currentMd);
    }
    setActiveTab(tab);
  };

  const handleCopy = async () => {
    const currentMd = await getCurrentMarkdown();
    navigator.clipboard.writeText(currentMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAsMd = async () => {
    const currentMd = await getCurrentMarkdown();
    const validation = ExportSchema.safeParse({
      markdown: currentMd,
      fileName,
      format: "md",
    });

    if (!validation.success) {
      alert(`Export Error: ${validation.error.issues[0].message}`);
      return;
    }

    const blob = new Blob([currentMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(".pdf", ".md");
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsTxt = async () => {
    const currentMd = await getCurrentMarkdown();
    const validation = ExportSchema.safeParse({
      markdown: currentMd,
      fileName,
      format: "txt",
    });

    if (!validation.success) {
      alert(`Export Error: ${validation.error.issues[0].message}`);
      return;
    }

    const blob = new Blob([currentMd], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(".pdf", ".txt");
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsDocx = async () => {
    setIsExporting(true);
    try {
      const currentMd = await getCurrentMarkdown();
      const validation = ExportSchema.safeParse({
        markdown: currentMd,
        fileName,
        format: "docx",
      });

      if (!validation.success) {
        alert(`Export Error: ${validation.error.issues[0].message}`);
        setIsExporting(false);
        return;
      }

      const blob = await generateDocx(currentMd);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(".pdf", ".docx");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Docx Export Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#030303] text-zinc-300 font-sans overflow-hidden select-none">
      {/* Header Navigation */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#030303] backdrop-blur-xl z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-sm"></div>
            </div>
            <span className="font-bold text-white tracking-tighter uppercase text-xs">RECON STUDIO</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block"></div>
          <nav className="hidden md:flex items-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <button onClick={onBack} className="hover:text-white transition-colors">WORKSPACE</button>
            <span className="text-zinc-800">/</span>
            <span className="text-zinc-400 truncate max-w-[200px]">{fileName}</span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-1.5 px-4 py-2 border border-white/5 rounded-full bg-white/[0.02] text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            <div className={cn("w-1.5 h-1.5 rounded-full", copied ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-blue-500/40")}></div>
            {copied ? "Buffer Copied" : "Fidelity: High"}
          </div>

          <div className="relative group">
            <button className="flex items-center gap-3 bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95">
              <span>Export</span>
              <Download className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden opacity-0 translate-y-2 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-all z-50 shadow-2xl">
              <div className="p-2 space-y-1">
                <button onClick={exportAsMd} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">Markdown (.md)</button>
                <button onClick={exportAsTxt} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">Plain Text (.txt)</button>
                <button onClick={exportAsDocx} disabled={isExporting} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all flex justify-between items-center">
                  <span>Word (.docx)</span>
                  {isExporting && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                </button>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onBack}
            className="p-3 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#030303] relative">
        {/* Tab Bar */}
        <div className="h-12 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-950/30 backdrop-blur-md">
          <div className="flex gap-8">
            <button 
              onClick={() => handleTabChange("markdown")}
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative pb-4 pt-1",
                activeTab === "markdown" ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Output Stream
              {activeTab === "markdown" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
            </button>
            <button 
              onClick={() => handleTabChange("original")}
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative pb-4 pt-1",
                activeTab === "original" ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Raw Structure
              {activeTab === "original" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
            </button>
            <button 
              onClick={() => handleTabChange("preview")}
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative pb-4 pt-1 flex items-center gap-2",
                activeTab === "preview" ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <Eye className="w-3 h-3" />
              Hardware Preview
              {activeTab === "preview" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
            </button>
          </div>
          <button onClick={handleCopy} className="text-zinc-600 hover:text-white transition-colors flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold">
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Stream</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "preview" ? (
            <div 
              ref={contentRef}
              className="flex-1 overflow-auto bg-[#0a0a0a] custom-scrollbar relative"
            >
              <div className="flex flex-col items-center py-20 gap-10">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-[210mm] bg-white shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-black min-h-[297mm] rounded-sm relative flex flex-col"
                >
                  {isPreviewLoading && !docxBlob && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm animate-pulse">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-bold text-black uppercase tracking-widest">Compiling Hardware Preview...</span>
                      </div>
                    </div>
                  )}
                  <div ref={previewRef} className="w-full h-full p-8 overflow-visible docx-preview-container flex-1" />
                </motion.div>
                
                {/* Information Footer for Preview */}
                <div className="w-[210mm] flex justify-between items-center px-2 opacity-30">
                  <span className="text-[8px] font-bold uppercase tracking-[0.4em] text-white">RECON_UNIT_01 // A4_SPEC</span>
                  <div className="h-px flex-1 mx-8 bg-white/10" />
                  <span className="text-[8px] font-bold uppercase tracking-[0.4em] text-white">V_4.5_STABLE</span>
                </div>
              </div>
              <div className="absolute inset-0 dashed-grid opacity-5 pointer-events-none" />
            </div>
          ) : (
            <div 
              ref={contentRef}
              className="flex-1 p-10 font-mono text-[12px] leading-relaxed overflow-y-auto selection:bg-white/10 custom-scrollbar bg-[#030303]"
            >
              {activeTab === "markdown" ? (
                <div className="max-w-5xl mx-auto h-full">
                  <textarea
                    value={liveMarkdown}
                    onChange={(e) => setLiveMarkdown(e.target.value)}
                    spellCheck={false}
                    className="w-full h-full bg-transparent text-zinc-300 font-mono text-[12px] leading-relaxed focus:outline-none resize-none custom-scrollbar pb-20"
                    placeholder="Engineering stream active..."
                  />
                </div>
              ) : (
                original.split("\n").map((line, i) => (
                  <div key={i} className="flex group max-w-5xl mx-auto">
                    <div className="w-16 text-zinc-800 select-none text-left pr-4 shrink-0 font-mono text-[10px] group-hover:text-zinc-600 transition-colors uppercase tracking-tighter">
                      {String(i + 1).padStart(4, '0')}
                    </div>
                    <div className={cn(
                      "break-words whitespace-pre-wrap transition-colors text-zinc-600 font-normal italic"
                    )}>
                      {line}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-10 border-t border-white/5 flex items-center justify-between px-8 bg-[#030303] text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
            <span className="text-zinc-400">Pipeline Ready</span>
          </div>
          <div className="flex gap-6">
            <span>Payload: {liveMarkdown.split(/\s+/).filter(Boolean).length} UTF-8 Units</span>
            <span>Density: {liveMarkdown.length} Characters</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-zinc-800">Engine:</span>
            <span className="text-zinc-500 font-mono">RECON-GLM-4.5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-800">Access:</span>
            <span className="text-zinc-500 font-mono">OPEN-ROUTER-SECURE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

