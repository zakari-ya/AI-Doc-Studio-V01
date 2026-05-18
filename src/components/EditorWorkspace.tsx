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
  ChevronDown,
  Settings,
  History,
  Database,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { renderAsync } from "docx-preview";
import { cn } from "../lib/utils";
import { ExportSchema } from "../lib/schemas";
import { secureMarkdown } from "../lib/sanitizer";
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
  VerticalAlign,
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
  onHome?: () => void;
}

export function EditorWorkspace({
  markdown,
  original,
  fileName,
  onBack,
  onHome,
}: EditorWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    "original" | "markdown" | "preview"
  >("markdown");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [liveMarkdown, setLiveMarkdown] = useState(markdown);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const generateDocx = async (md: string) => {
    // 1. Sanitize input Markdown to remove dangerous HTML tags before parsing
    const securedMd = secureMarkdown(md);

    const children: any[] = [];
    const lines = securedMd.split("\n");
    let currentTableRows: TableRow[] = [];
    let inTable = false;

    const flushTable = () => {
      if (inTable && currentTableRows.length > 0) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: currentTableRows,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "E2E2E2" },
              insideHorizontal: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "E2E2E2",
              },
              insideVertical: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "E2E2E2",
              },
            },
          }),
        );
        children.push(new Paragraph({ text: "" }));
        inTable = false;
        currentTableRows = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Table detection
      const isTableLine =
        trimmedLine.startsWith("|") && trimmedLine.endsWith("|");
      const isTableSeparator =
        isTableLine &&
        trimmedLine.includes("-") &&
        !/[a-zA-Z0-9]/.test(trimmedLine);

      if (isTableLine) {
        if (isTableSeparator) {
          inTable = true;
          continue;
        }

        const cellsData = trimmedLine
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        const row = new TableRow({
          children: cellsData.map(
            (cellText) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: parseInlineFormatting(cellText),
                    alignment: AlignmentType.LEFT,
                  }),
                ],
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
              }),
          ),
        });
        currentTableRows.push(row);
        inTable = true;
        continue;
      } else {
        flushTable();
      }

      // Headings
      const hMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];

        let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] =
          HeadingLevel.HEADING_1;
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

        children.push(
          new Paragraph({
            heading: headingLevel,
            children: [new TextRun({ text, bold: true, size: fontSize })],
            spacing: { before: 400, after: 200 },
          }),
        );
        continue;
      }

      // Bullet Lists
      const bulletMatch = trimmedLine.match(/^[\-\+\*]\s+(.*)$/);
      if (bulletMatch) {
        const text = bulletMatch[1];
        children.push(
          new Paragraph({
            children: parseInlineFormatting(text),
            bullet: { level: 0 },
            spacing: { after: 120 },
          }),
        );
        continue;
      }

      // Plain Paragraph
      if (!trimmedLine) {
        continue;
      }

      children.push(
        new Paragraph({
          children: parseInlineFormatting(trimmedLine),
          spacing: { after: 120 },
        }),
      );
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
                line: 276, // 1.15 line spacing
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
      if (previewRef.current && docxBlob) {
        try {
          // Clear previous content
          previewRef.current.innerHTML = "";
          await renderAsync(docxBlob, previewRef.current, undefined, {
            className: "docx-render",
            inWrapper: false,
            ignoreWidth: true,
            ignoreHeight: true,
          });
        } catch (err) {
          if (isMounted) console.error("Docx Preview Error:", err);
        }
      }
    }

    render();
    return () => {
      isMounted = false;
    };
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

  const [markdownView, setMarkdownView] = useState<"edit" | "render">("edit");

  return (
    <div className="flex flex-col min-h-screen bg-[#030303] text-zinc-300 font-sans overflow-hidden select-none">
      {/* Header Navigation - Mobile Optimized PWA Style */}
      <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#030303] z-50 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/favicone.png" className="w-5 h-5 md:w-6 md:h-6 object-contain" alt="AI -Doc-Studio Logo" />
          <span
            onClick={onHome}
            className="font-bold text-white tracking-tight text-sm md:text-base cursor-pointer hover:opacity-80 active:scale-95 transition-all select-none"
          >
            AI-Doc-Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-1.5 px-4 py-2 border border-white/5 rounded-full bg-white/[0.02] text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  copied
                    ? "bg-emerald-500 shadow-[0_0_10px_#10b981]"
                    : "bg-blue-500/40",
                )}
              ></div>
              {copied ? "Buffer Copied" : "Fidelity: High"}
            </div>

            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="flex items-center gap-3 bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95"
              >
                <span>Export</span>
                <Download className="w-3 h-3" />
              </button>
              <div
                className={cn(
                  "absolute right-0 top-full mt-2 w-56 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden transition-all z-50 shadow-2xl",
                  isExportDropdownOpen
                    ? "opacity-100 translate-y-0 visible"
                    : "opacity-0 translate-y-2 invisible",
                )}
              >
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      exportAsMd();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    onClick={() => {
                      exportAsTxt();
                      setIsExportDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    Plain Text (.txt)
                  </button>
                  <button
                    onClick={() => {
                      exportAsDocx();
                      setIsExportDropdownOpen(false);
                    }}
                    disabled={isExporting}
                    className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-all flex justify-between items-center"
                  >
                    <span>Word (.docx)</span>
                    {isExporting && (
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* <button className="p-2 md:p-3 text-zinc-500 hover:text-white transition-colors">
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
          </button> */}

          <button
            onClick={onBack}
            className="p-2 md:p-3 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 transition-colors "
          >
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>
      </header>

      {/* Main Workspace - Adaptive Split View */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#030303] relative">
        {/* Tab Bar - Visible only on mobile to switch views */}
        <div className="h-12 border-b border-white/5 flex items-center bg-[#111111] lg:hidden shrink-0">
          <button
            onClick={() => setActiveTab("markdown")}
            className={cn(
              "flex-1 h-full text-[10px] font-bold uppercase tracking-widest transition-all relative flex items-center justify-center",
              activeTab === "markdown"
                ? "text-white"
                : "text-zinc-600 hover:text-zinc-400",
            )}
          >
            Markdown
            {activeTab === "markdown" && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
              />
            )}
          </button>
          <div className="w-px h-4 bg-white/5" />
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex-1 h-full text-[10px] font-bold uppercase tracking-widest transition-all relative flex items-center justify-center",
              activeTab === "preview"
                ? "text-white"
                : "text-zinc-600 hover:text-zinc-400",
            )}
          >
            Preview
            {activeTab === "preview" && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
              />
            )}
          </button>
        </div>

        {/* Panel 1: Editor / Markdown View */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 border-r border-white/5",
            activeTab !== "markdown" && "hidden lg:flex",
          )}
        >
          {/* Sub-header for Editor */}
          <div className="h-10 border-b border-white/5 flex items-center px-4 bg-[#030303] gap-2 overflow-x-auto no-scrollbar shrink-0">
            <div className="px-2 py-0.5 border border-white/10 rounded-sm text-[8px] font-mono text-zinc-600 bg-white/5 shrink-0 uppercase">
              EDITOR_STABLE
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex bg-white/5 p-0.5 rounded-md gap-1 border border-white/5">
                <button
                  onClick={() => setMarkdownView("edit")}
                  className={cn(
                    "px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-all",
                    markdownView === "edit"
                      ? "bg-white/10 text-white"
                      : "text-zinc-600",
                  )}
                >
                  Edit
                </button>
                <button
                  onClick={() => setMarkdownView("render")}
                  className={cn(
                    "px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-all",
                    markdownView === "render"
                      ? "bg-white/10 text-white"
                      : "text-zinc-600",
                  )}
                >
                  Read
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            <div className="max-w-5xl mx-auto h-full w-full flex md:flex-row p-4 md:p-8">
              {markdownView === "edit" ? (
                <div className="flex-1 flex overflow-hidden min-h-[400px] h-full">
                  <div className=" md:flex flex-col items-end pr-4 py-4 select-none border-r border-white/5 bg-[#030303]">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <div
                        key={i}
                        className="text-[10px] font-mono text-zinc-800 leading-relaxed h-[18px]"
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    id="markdown-editor"
                    name="markdown-editor"
                    value={liveMarkdown}
                    onChange={(e) => setLiveMarkdown(e.target.value)}
                    spellCheck={false}
                    className="flex-1  bg-transparent text-zinc-300 font-mono text-[13px] md:text-[14px] leading-relaxed focus:outline-none resize-none custom-scrollbar px-6 py-4 pb-40"
                    placeholder="Start typing..."
                  />
                </div>
              ) : (
                <div className="prose prose-invert prose-zinc max-w-none px-6 py-4 pb-40 rich-markdown-view w-full">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                  >
                    {liveMarkdown}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Preview Area */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative",
            activeTab !== "preview" && "hidden lg:flex",
          )}
        >
          {/* Sub-header for Preview */}
          <div className="h-10 border-b border-white/5 flex items-center px-4 bg-[#030303] gap-2 shrink-0">
            <div className="px-2 py-0.5 border border-white/10 rounded-sm text-[8px] font-mono text-zinc-600 bg-white/5 shrink-0 uppercase">
              HARDWARE_PREVIEW
            </div>
            {isPreviewLoading && (
              <div className="flex items-center gap-2 ml-4">
                <div className="w-2 h-2 border border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-[8px] font-mono text-zinc-700 animate-pulse">
                  Syncing...
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-8 flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-[210mm] min-h-0 md:min-h-[297mm] h-auto bg-white shadow-2xl text-black rounded-sm relative docx-preview-outer-container origin-top transform-gpu"
              style={{ paddingBottom: "20px" }}
            >
              {!docxBlob && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-black uppercase tracking-widest text-center px-4">
                      Initializing Render Pipe...
                    </span>
                  </div>
                </div>
              )}
              <div
                ref={previewRef}
                className="w-full h-auto py-4 md:py-12 px-0 docx-preview-container"
              />
            </motion.div>
          </div>
          <div className="absolute inset-0 dashed-grid opacity-5 pointer-events-none" />
        </div>
      </main>

      {/* Bottom Status Bar / Navigation */}
      <footer className="h-14 md:h-10 border-t border-white/5 flex items-center bg-[#030303] text-[8px] md:text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] relative">
        <div className="hidden md:flex flex-1 items-center justify-between px-8">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
              <span>Pipeline Ready</span>
            </div>
            <div className="flex gap-6">
              <span>
                Payload: {liveMarkdown.split(/\s+/).filter(Boolean).length}{" "}
                UTF-8 Units
              </span>
              <span>Density: {liveMarkdown.length} Chars</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-zinc-800">Engine:</span>
              <span className="text-zinc-500 font-mono">RECON-GLM</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-800">Access:</span>
              <span className="text-zinc-500 font-mono">OPEN-ROUTER</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Interface (PWA Style) */}
        {/* <div className="flex md:hidden w-full h-full">
          <button className="flex-1 flex flex-col items-center justify-center gap-1 text-white">
            <FileText className="w-4 h-4" />
            <span className="text-[7px]">Workspace</span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
            <Database className="w-4 h-4" />
            <span className="text-[7px]">Metadata</span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
            <History className="w-4 h-4" />
            <span className="text-[7px]">Versions</span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
            <Settings className="w-4 h-4" />
            <span className="text-[7px]">Layers</span>
          </button>
        </div> */}
      </footer>
    </div>
  );
}
