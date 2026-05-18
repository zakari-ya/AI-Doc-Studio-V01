import { motion } from "motion/react";
import { ArrowRight, Terminal, Globe, Lock, Check } from "lucide-react";
import { cn } from "../lib/utils";

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="w-full flex flex-col bg-[#030303] text-zinc-300 font-sans selection:bg-white/10 overflow-x-hidden">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#030303]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white tracking-tight text-sm md:text-lg">Studio</span>
        </div>
        <nav className="hidden md:flex items-center gap-12 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
          <a href="#features" className="hover:text-white transition-colors">Capabilities</a>
          <a href="#tech" className="hover:text-white transition-colors">Protocol</a>
        </nav>
        <div className="flex mr-2 md:mr-0">
           <button
             onClick={onStart}
             className="px-4 py-1.5 bg-white text-black rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all active:scale-95"
           >
             Initialize
           </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-12 px-6">
        <div className="absolute inset-0 dashed-grid opacity-5" />
        <div className="relative z-10 w-full max-w-7xl mx-auto text-center space-y-8 md:space-y-12">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 px-4 py-1.5 border border-white/10 rounded-full bg-white/[0.02] backdrop-blur-sm shadow-2xl"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em]">v3 engine now active</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight text-white leading-[1.1] md:leading-[1.05]"
            >
              Reconstruct <br className="hidden md:block" />
              documents with <br className="hidden md:block" />
              <span className="italic font-serif font-light text-zinc-500">surgical precision</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="text-sm sm:text-base md:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed font-light px-4"
            >
              Military-grade OCR and layout restoration for high-stakes archival workflows.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col gap-4 max-w-xs mx-auto w-full"
          >
            <button
              onClick={onStart}
              className="w-full px-8 py-4 bg-white text-black rounded-lg font-bold text-xs hover:bg-zinc-200 transition-all uppercase tracking-widest flex items-center justify-center"
            >
              Start Reconstructing
            </button>
            <button className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-lg font-bold text-xs hover:bg-white/10 transition-all text-white uppercase tracking-widest flex items-center justify-center">
              View Documentation
            </button>
          </motion.div>
        </div>
      </section>

      {/* Scroll Indicator */}
      <motion.div 
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30"
      >
        <div className="w-px h-12 bg-gradient-to-b from-transparent to-white" />
        <span className="text-[9px] font-bold uppercase tracking-[0.3em]">Vertical Scroll</span>
      </motion.div>

      {/* Mockup Preview Section */}
      <section className="px-6 py-24 md:py-40 bg-[#030303]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-12 md:mb-20 gap-8">
            <div className="space-y-4 text-center md:text-left">
               <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Laboratory Preview</span>
               <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white tracking-tight">Unified Reconstruction View</h2>
            </div>
            <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-600">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
                 Confidence Score: 99.8%
               </div>
               <div className="hidden sm:block w-px h-4 bg-white/10" />
               <span className="hidden sm:block">Latency: 240ms</span>
            </div>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-[#09090b] rounded-[24px] md:rounded-[40px] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="h-10 md:h-12 border-b border-white/5 flex items-center px-6 gap-2 bg-zinc-950 overflow-x-auto no-scrollbar">
              <div className="w-3 h-3 rounded-full bg-red-500/20 shrink-0" />
              <div className="w-3 h-3 rounded-full bg-amber-500/20 shrink-0" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/20 shrink-0" />
              <div className="ml-6 flex gap-6 text-[10px] md:text-[11px] font-mono text-zinc-500 shrink-0">
                 <span className="text-white/60 underline decoration-white/20 underline-offset-4">src/reconstruct.ts</span>
                 <span>raw_buffer.pdf</span>
                 <span>output.md</span>
              </div>
            </div>
            <div className="flex flex-col lg:flex-row h-auto lg:h-[700px]">
               <div className="hidden lg:flex flex-col w-1/2 border-r border-white/5 p-12 font-mono text-[11px] space-y-8 opacity-30 select-none bg-black/40">
                  <div className="space-y-3">
                    <div className="h-2 w-1/3 bg-white/20 rounded-full" />
                    <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                  </div>
                  <div className="aspect-[4/3] w-full bg-white/[0.02] border border-white/10 rounded-2xl flex items-center justify-center relative overflow-hidden">
                     <div className="absolute inset-0 dashed-grid opacity-10" />
                     <Globe className="w-16 h-16 text-white/5" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-white/10 rounded-full" />
                    <div className="h-2 w-3/4 bg-white/10 rounded-full" />
                    <div className="h-2 w-5/6 bg-white/10 rounded-full" />
                    <div className="h-2 w-1/2 bg-white/10 rounded-full" />
                  </div>
               </div>
               <div className="flex-1 p-8 md:p-12 lg:p-16 text-zinc-400 bg-[#030303]">
                  <div className="flex flex-col gap-10 max-w-2xl mx-auto">
                    <div className="space-y-6">
                       <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium text-white italic font-serif leading-tight">Executive Financial Overview</h3>
                       <p className="text-sm md:text-base leading-relaxed text-zinc-500">Analysis of quarterly performance based on structural extraction of tables from the annual report.</p>
                    </div>
                    
                    <div className="space-y-6 p-6 md:p-10 rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/5 font-mono text-[10px] md:text-[12px] overflow-x-auto">
                       <div className="flex justify-between border-b border-white/5 pb-4 text-zinc-600 min-w-[300px]">
                          <span>// Structural Table Reconstruction</span>
                          <span>[VALIDATED]</span>
                       </div>
                       <table className="w-full text-left min-w-[300px]">
                          <thead>
                             <tr className="text-zinc-500 italic">
                                <th className="py-4">Metric</th>
                                <th className="py-4">Previous</th>
                                <th className="py-4">Current</th>
                             </tr>
                          </thead>
                          <tbody className="text-zinc-400">
                             <tr>
                                <td className="py-4">Revenue</td>
                                <td className="py-4 text-zinc-600">$1.2M</td>
                                <td className="py-4 text-white font-bold">$1.48M</td>
                             </tr>
                             <tr>
                                <td className="py-4">EBITDA</td>
                                <td className="py-4 text-zinc-600">18.4%</td>
                                <td className="py-4 text-emerald-400 font-bold">22.1%</td>
                             </tr>
                          </tbody>
                       </table>
                    </div>

                    <div className="flex items-center gap-4 pt-12">
                       <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                             <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800" />
                          ))}
                       </div>
                       <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">Verified by 12k+ Engineers</span>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="features" className="py-20 md:py-40 px-4 bg-white text-black rounded-[30px] md:rounded-[80px]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-start">
             <div className="md:w-1/2 space-y-8 md:space-y-12 h-min md:sticky md:top-40">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.5em]">System Capabilities</span>
                <h2 className="text-4xl md:text-8xl font-light tracking-tighter leading-[0.8]">Built for <br /> <span className="italic font-serif">precision.</span></h2>
                <p className="text-base md:text-lg text-zinc-500 max-w-sm leading-relaxed">Most AI engines treat text as a flat stream. We treat documents as multi-layered structural architectures.</p>
             </div>
             
             <div className="md:w-1/2 space-y-12 md:space-y-24">
                {[
                  { 
                    title: "Spatial Intelligence", 
                    desc: "Our engine maps the exact coordinates of every text element, allowing for perfect restoration of complex tables and nested hierarchies.",
                    num: "01"
                  },
                  { 
                    title: "Semantic Layering", 
                    desc: "We go beyond OCR. Our model understands the logical intent of headings, captions, and references to build a true semantic map.",
                    num: "02"
                  },
                  { 
                    title: "Extreme Fidelity", 
                    desc: "From mathematical formulas to technical schematics, we preserve the precision required for professional and scientific workflows.",
                    num: "03"
                  },
                  { 
                    title: "Real-time Processing", 
                    desc: "Highly optimized streaming architecture reduces latency to milliseconds, making document reconstruction feel instantaneous.",
                    num: "04"
                  }
                ].map((f, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="flex gap-10 items-start group"
                  >
                    <span className="text-4xl font-light italic font-serif text-zinc-300 group-hover:text-black transition-colors">{f.num}</span>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold tracking-tight">{f.title}</h3>
                      <p className="text-zinc-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
             </div>
          </div>
        </div>
      </section>

      {/* Protocol Section */}
      <section id="tech" className="py-40 px-4 bg-[#030303]">
         <div className="max-w-4xl mx-auto text-center space-y-24">
            <div className="space-y-6">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Engine Protocol</span>
              <h2 className="text-5xl font-light text-white tracking-tight">The Modern Data Standard.</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
               {[
                 { label: "Extraction Rate", val: "1.2s", sub: "Avg per 10 pages" },
                 { label: "Accuracy", val: "99.8%", sub: "Validated Score" },
                 { label: "Security", val: "AES", sub: "256-bit Encryption" },
                 { label: "Confidence", val: "Zero", sub: "Retention Policy" }
               ].map((stat, i) => (
                 <div key={i} className="p-8 border border-white/5 space-y-2 bg-zinc-950 transition-colors hover:border-white/20">
                    <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest block">{stat.label}</span>
                    <span className="text-3xl font-light text-white block">{stat.val}</span>
                    <span className="text-[9px] text-zinc-700 uppercase tracking-widest block">{stat.sub}</span>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-40 px-4 border-t border-white/5 bg-zinc-950">
        <div className="max-w-3xl mx-auto space-y-20">
          <div className="text-center space-y-6">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Knowledge Base</span>
            <h2 className="text-5xl font-light text-white tracking-tight">Technical Clarifications</h2>
          </div>
          <div className="space-y-4">
            {[
              { 
                q: "What document formats are supported?", 
                a: "We currently support PDF, scanned images (JPEG, PNG), and multi-page TIFF documents. Our engine is optimized for high-density textual documents with complex layouts." 
              },
              { 
                q: "How accurate is the structural reconstruction?", 
                a: "Our engine achieves near-perfect fidelity on structural elements. It maps the spatial relationships of text blocks to ensure the Markdown logically mirrors the visual hierarchy of the original." 
              },
              { 
                q: "Is there a document size limit?", 
                a: "The standard engine supports documents up to 200MB. For larger archives, our batch processing protocol handles gigabyte-scale datasets via dedicated extraction nodes." 
              }
            ].map((item, i) => (
              <div key={i} className="p-10 rounded-2xl bg-[#030303] border border-white/5 space-y-4 group hover:border-white/20 transition-all cursor-pointer shadow-sm">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center justify-between">
                  {item.q}
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 group-hover:bg-emerald-500 transition-colors" />
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed font-light">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 px-4 bg-white text-black text-center relative overflow-hidden">
        <div className="absolute inset-0 dashed-grid opacity-5 pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-12">
           <h2 className="text-5xl md:text-7xl font-light tracking-tighter leading-none">Ready to recover your data.</h2>
           <button 
             onClick={onStart}
             className="px-12 py-6 bg-black text-white rounded-full font-bold text-sm uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-4 mx-auto"
           >
             Initialize Studio
             <ArrowRight className="w-5 h-5" />
           </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-8 border-t border-white/5 bg-[#030303]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                  <div className="w-3 h-3 bg-black rounded-sm"></div>
                </div>
                <span className="font-bold text-white tracking-tighter uppercase text-sm">RECON STUDIO</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed max-w-xs uppercase tracking-widest font-bold">
                The global standard for structural document recovery.
              </p>
            </div>
            
            <div className="flex flex-col gap-6">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Protocol</span>
              <ul className="text-xs text-zinc-600 space-y-4 font-mono">
                <li><a href="#" className="hover:text-white transition-colors">V2.0 STABLE</a></li>
                <li><a href="#" className="hover:text-white transition-colors">ACCURACY: 99.8%</a></li>
                <li><a href="#" className="hover:text-white transition-colors">LATENCY: 240MS</a></li>
              </ul>
            </div>

            <div className="flex flex-col gap-6">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Navigation</span>
              <ul className="text-xs text-zinc-600 space-y-4 font-mono">
                <li><a href="#features" className="hover:text-white transition-colors">CAPABILITIES</a></li>
                <li><a href="#tech" className="hover:text-white transition-colors">PROTOCOL</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">KNOWLEDGE</a></li>
              </ul>
            </div>

            <div className="flex flex-col gap-6">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Connect</span>
              <div className="flex items-center gap-4 text-xs text-white/40">
                 <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:text-white transition-all">XT</button>
                 <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:text-white transition-all">GH</button>
                 <button className="p-3 bg-white/5 rounded-full border border-white/10 hover:text-white transition-all">IN</button>
              </div>
            </div>
          </div>
          
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
             <div className="flex gap-12">
                <span>© 2024 ARCH-RECON INC.</span>
                <span className="hidden md:inline">VERSION: REL-2.4.0</span>
             </div>
             <div className="flex gap-12">
                <a href="#" className="hover:text-zinc-400 transition-colors">Security Specification</a>
                <a href="#" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
             </div>
          </div>
        </div>
      </footer>
      {/* PWA Navigation Mockup */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-white/5 md:hidden flex items-center justify-center z-50 px-4">
          <div className="flex w-full items-center justify-between text-zinc-600 font-bold text-[7px] uppercase tracking-widest">
             <div className="flex flex-col items-center gap-1.5 text-white">
                <Globe className="w-4 h-4" />
                <span>Workspace</span>
             </div>
             <div className="flex flex-col items-center gap-1.5 opacity-40">
                <Globe className="w-4 h-4" />
                <span>Metadata</span>
             </div>
             <div className="flex flex-col items-center gap-1.5 opacity-40">
                <Terminal className="w-4 h-4" />
                <span>History</span>
             </div>
             <div className="flex flex-col items-center gap-1.5 opacity-40">
                <Lock className="w-4 h-4" />
                <span>Settings</span>
             </div>
          </div>
      </div>
    </div>
  );
}

