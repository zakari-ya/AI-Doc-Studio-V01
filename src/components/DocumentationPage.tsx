import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FolderLock,
  Gauge,
  KeyRound,
  Lock,
  Menu,
  Network,
  Server,
  ShieldCheck,
  TerminalSquare,
  X,
} from "lucide-react";

type DocLink = {
  id: string;
  label: string;
};

type DocGroup = {
  label: string;
  items: DocLink[];
};

const DOC_GROUPS: DocGroup[] = [
  {
    label: "Guide",
    items: [
      { id: "overview", label: "Overview" },
      { id: "quick-start", label: "Quick Start" },
      { id: "how-it-works", label: "How It Works" },
      { id: "authentication", label: "Authentication" },
      { id: "security-model", label: "Security Model" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "api-endpoints", label: "API Endpoints" },
      { id: "operational-limits", label: "Operational Limits" },
      { id: "environment-deployment", label: "Environment & Deployment" },
      { id: "rate-limit-verification", label: "Rate-Limit Verification" },
      { id: "faq", label: "FAQ" },
    ],
  },
];

const ALL_SECTION_IDS = DOC_GROUPS.flatMap((group) => group.items.map((item) => item.id));

interface DocumentationPageProps {
  authControls: ReactNode;
  isAuthenticated: boolean;
  onNavigateHome: () => void;
  onOpenStudio: () => void;
}

function SectionShell({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-white/6 pb-12 md:pb-16">
      <div className="space-y-5">
        <div className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">
            {eyebrow}
          </span>
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-light tracking-tight text-white">
              {title}
            </h2>
            <p className="max-w-3xl text-sm md:text-base leading-7 text-zinc-400">
              {description}
            </p>
          </div>
        </div>
        <div className="space-y-6 text-sm leading-7 text-zinc-300">{children}</div>
      </div>
    </section>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-3xl border border-white/8 bg-zinc-950/80 px-5 py-4 text-[12px] leading-6 text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

function InfoGrid({
  items,
}: {
  items: Array<{ title: string; description: string; icon: ReactNode }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
        >
          <div className="mb-4 flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              {item.icon}
            </div>
            <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
          </div>
          <p className="text-sm leading-7 text-zinc-400">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function SidebarLink({
  href,
  isActive,
  onClick,
  children,
}: {
  href: string;
  isActive: boolean;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`group flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm transition-all ${
        isActive
          ? "bg-white text-black"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <span>{children}</span>
      <ChevronRight
        className={`h-4 w-4 transition-transform ${
          isActive ? "translate-x-0 text-black" : "text-zinc-600 group-hover:translate-x-0.5"
        }`}
      />
    </a>
  );
}

export function DocumentationPage({
  authControls,
  isAuthenticated,
  onNavigateHome,
  onOpenStudio,
}: DocumentationPageProps) {
  const [activeSection, setActiveSection] = useState<string>(ALL_SECTION_IDS[0] ?? "overview");
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);

  const flatLinks = useMemo(() => DOC_GROUPS.flatMap((group) => group.items), []);

  useEffect(() => {
    const syncActiveSection = () => {
      const topOffset = 140;
      let visibleSection = ALL_SECTION_IDS[0];

      for (let index = ALL_SECTION_IDS.length - 1; index >= 0; index -= 1) {
        const candidate = ALL_SECTION_IDS[index];
        if (!candidate) {
          continue;
        }

        const element = document.getElementById(candidate);
        if (element && element.getBoundingClientRect().top <= topOffset) {
          visibleSection = candidate;
          break;
        }
      }

      if (visibleSection) {
        setActiveSection(visibleSection);
      }
    };

    const syncToHash = () => {
      const hashId = window.location.hash.replace(/^#/, "");
      if (!hashId) {
        return;
      }

      const target = document.getElementById(hashId);
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(hashId);
    };

    const rafId = window.requestAnimationFrame(() => {
      syncActiveSection();
      syncToHash();
    });

    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("hashchange", syncToHash);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("hashchange", syncToHash);
    };
  }, []);

  const handleSectionClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    event.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    window.history.replaceState(window.history.state, "", `/docs#${sectionId}`);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(sectionId);
    setIsMobileIndexOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300">
      <div className="pointer-events-none absolute inset-0 dashed-grid opacity-[0.04]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#030303]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-3 text-left"
          >
            <img src="/favicone.png" className="h-6 w-6 object-contain" alt="AI Doc Studio logo" />
            <div>
              <div className="text-sm font-bold tracking-tight text-white">AI-Doc-Studio</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                Documentation
              </div>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileIndexOpen((current) => !current)}
              className="flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white md:hidden"
            >
              {isMobileIndexOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              Index
            </button>
            {authControls}
            <button
              type="button"
              onClick={onOpenStudio}
              className="hidden rounded-2xl bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-black transition-colors hover:bg-zinc-200 md:inline-flex"
            >
              {isAuthenticated ? "Start Reconstructing" : "Open Studio"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-4 pb-24 pt-24 md:px-8">
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-[28px] border border-white/8 bg-zinc-950/75 p-5 shadow-[0_0_80px_rgba(0,0,0,0.25)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                Reading Map
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Built for engineers, operators, and teams that need the exact current behavior of
                the production pipeline.
              </p>
            </div>

            <nav className="space-y-6 rounded-[28px] border border-white/8 bg-white/[0.02] p-4">
              {DOC_GROUPS.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600">
                    {group.label}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <SidebarLink
                        key={item.id}
                        href={`#${item.id}`}
                        isActive={item.id === activeSection}
                        onClick={(event) => handleSectionClick(event, item.id)}
                      >
                        {item.label}
                      </SidebarLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="rounded-[28px] border border-white/8 bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Open the Studio</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Secure workflow
                  </p>
                </div>
              </div>
              <p className="mb-5 text-sm leading-6 text-zinc-400">
                The docs stay public. Upload, reconstruct, and export remain protected behind
                invite-only sign-in.
              </p>
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-black transition-colors hover:bg-zinc-200"
              >
                {isAuthenticated ? "Start Reconstructing" : "Open Studio"}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {isMobileIndexOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden">
            <div className="absolute inset-x-4 top-20 rounded-[28px] border border-white/8 bg-[#09090b] p-4 shadow-[0_0_80px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Documentation Index</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                    Jump to section
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileIndexOpen(false)}
                  className="rounded-2xl border border-white/10 p-2 text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[70vh] space-y-6 overflow-y-auto custom-scrollbar">
                {DOC_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <div className="px-3 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <SidebarLink
                          key={item.id}
                          href={`#${item.id}`}
                          isActive={item.id === activeSection}
                          onClick={(event) => handleSectionClick(event, item.id)}
                        >
                          {item.label}
                        </SidebarLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="relative min-w-0 flex-1">
          <div className="space-y-8 md:space-y-10">
            <section className="overflow-hidden rounded-[32px] border border-white/8 bg-zinc-950/70 shadow-[0_0_120px_rgba(0,0,0,0.35)]">
              <div className="border-b border-white/8 px-6 py-4 md:px-8">
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                  <span>AI Doc Studio Manual</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-700" />
                  <span>Public Docs</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-700" />
                  <span>Security First</span>
                </div>
              </div>
              <div className="space-y-8 px-6 py-10 md:px-8 md:py-12">
                <div className="max-w-4xl space-y-5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                    Reader-First Reference
                  </span>
                  <h1 className="text-4xl md:text-6xl font-light leading-tight tracking-tight text-white">
                    The production manual for a{" "}
                    <span className="font-serif italic text-zinc-500">
                      private PDF reconstruction pipeline
                    </span>
                    .
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-zinc-400 md:text-base">
                    This page documents the real deployed stack: public landing page, invite-only
                    Supabase magic-link auth, private storage-backed uploads, server-side PDF
                    extraction, OpenRouter reconstruction, and daily per-user rate limiting.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                      Access
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">
                      Public docs. Protected upload and reconstruction workspace.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                      Backend
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">
                      Vercel functions, Supabase Storage, Supabase Auth, OpenRouter.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                      Limits
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">
                      15 MB PDFs, 40 pages, 20 reconstructions per user per day.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-10 rounded-[32px] border border-white/8 bg-[#050505]/90 px-6 py-8 md:px-8 md:py-10">
              <SectionShell
                id="overview"
                eyebrow="01 / Overview"
                title="What AI Doc Studio is built to do"
                description="AI Doc Studio is a security-first reconstruction tool for turning uploaded PDFs into cleaner, more usable Markdown while preserving structure, hierarchy, and operator trust."
              >
                <InfoGrid
                  items={[
                    {
                      title: "For high-trust workflows",
                      description:
                        "The system is aimed at archival, research, technical, and operator workflows where users care about the origin, retention, and security posture of every uploaded file.",
                      icon: <ShieldCheck className="h-4 w-4" />,
                    },
                    {
                      title: "Not a public anonymous tool",
                      description:
                        "The landing page is public, but the actual upload and reconstruction pipeline is intentionally protected. Users cannot process files unless they are invited and authenticated.",
                      icon: <FolderLock className="h-4 w-4" />,
                    },
                    {
                      title: "Structure before polish",
                      description:
                        "The product tries to restore readable structure, not just dump OCR text. That includes handling extraction, reconstruction, and editor delivery as one controlled pipeline.",
                      icon: <Network className="h-4 w-4" />,
                    },
                    {
                      title: "Operationally simple",
                      description:
                        "The system stays lightweight by using Vercel functions, Supabase Auth and Storage, and a controlled cleanup window instead of long-lived server infrastructure.",
                      icon: <Server className="h-4 w-4" />,
                    },
                  ]}
                />
              </SectionShell>

              <SectionShell
                id="quick-start"
                eyebrow="02 / Quick Start"
                title="From invite to reconstructed output"
                description="The fastest user path is intentionally short: authenticate, upload a PDF, wait for server-side processing, then review the reconstructed Markdown in the editor."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    "Open the public landing page and sign in with an invited email address.",
                    "Wait for the Supabase magic link and complete the sign-in flow.",
                    "Upload a PDF that fits the platform limits.",
                    "The browser requests a signed upload slot, uploads the file privately, and asks the backend to reconstruct it.",
                    "Read, inspect, and export the generated Markdown after processing completes.",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
                    >
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600">
                        Step {String(index + 1).padStart(2, "0")}
                      </div>
                      <p className="text-sm leading-7 text-zinc-300">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">
                    Before You Start
                  </p>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Users should know the hard limits before uploading: 15 MB maximum PDF size, 40
                    pages maximum, extracted raw text capped at 200,000 characters, reconstructed
                    output capped at 250,000 characters, and a daily limit of 20 reconstructions
                    per authenticated user.
                  </p>
                </div>
              </SectionShell>

              <SectionShell
                id="how-it-works"
                eyebrow="03 / How It Works"
                title="Pipeline flow from browser to output"
                description="The browser never posts the raw PDF directly to the reconstruction endpoint. Upload and reconstruction are split so storage, ownership, and security checks can happen in the correct order."
              >
                <CodeBlock>
                  {`Browser
  -> POST /api/uploads/create
  -> signed upload slot returned
  -> direct upload to private Supabase Storage
  -> POST /api/documents/reconstruct { documentId }

Server
  -> verifies Supabase bearer token
  -> validates ownership and limits
  -> downloads the private PDF
  -> extracts text server-side
  -> reconstructs with OpenRouter
  -> stores result metadata and returns Markdown`}
                </CodeBlock>
                <p>
                  This split is deliberate. It keeps raw document storage private, gives the server
                  a stable document record to validate, and avoids treating the browser as the
                  long-term file lifecycle manager.
                </p>
              </SectionShell>

              <SectionShell
                id="authentication"
                eyebrow="04 / Authentication"
                title="Invite-only access with Supabase magic links"
                description="Authentication uses Supabase Auth with email magic links and account creation disabled at sign-in time."
              >
                <InfoGrid
                  items={[
                    {
                      title: "Magic link only",
                      description:
                        "The browser starts sign-in with `signInWithOtp` and `shouldCreateUser: false`, so unknown emails do not create accounts through the app.",
                      icon: <KeyRound className="h-4 w-4" />,
                    },
                    {
                      title: "Invite-only enforcement",
                      description:
                        "Allowed users must be invited or pre-created in Supabase Auth. Public visitors can read documentation and landing content, but they cannot process documents.",
                      icon: <Lock className="h-4 w-4" />,
                    },
                    {
                      title: "Bearer-protected APIs",
                      description:
                        "Protected backend routes accept `Authorization: Bearer <supabase access token>` and resolve the authenticated user before any document action is performed.",
                      icon: <ShieldCheck className="h-4 w-4" />,
                    },
                    {
                      title: "Session-aware UI",
                      description:
                        "Signed-out users see login controls and public content. Signed-in users can move into upload, processing, and editor flows without leaving the app shell.",
                      icon: <BookOpen className="h-4 w-4" />,
                    },
                  ]}
                />
              </SectionShell>

              <SectionShell
                id="security-model"
                eyebrow="05 / Security Model"
                title="Security controls that shape the product"
                description="The application is designed around storage privacy, authenticated API access, short retention, and server-only privileges."
              >
                <div className="overflow-x-auto rounded-3xl border border-white/8">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-white/[0.04] text-zinc-200">
                      <tr>
                        <th className="border-b border-white/8 px-4 py-3 font-semibold">Layer</th>
                        <th className="border-b border-white/8 px-4 py-3 font-semibold">
                          Control
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-400">
                      <tr>
                        <td className="border-b border-white/8 px-4 py-3 text-white">
                          File storage
                        </td>
                        <td className="border-b border-white/8 px-4 py-3">
                          PDFs are uploaded into a private Supabase Storage bucket with signed upload
                          URLs.
                        </td>
                      </tr>
                      <tr>
                        <td className="border-b border-white/8 px-4 py-3 text-white">
                          Server privileges
                        </td>
                        <td className="border-b border-white/8 px-4 py-3">
                          The service-role key is server-only and used for document row writes,
                          storage downloads, and protected maintenance work.
                        </td>
                      </tr>
                      <tr>
                        <td className="border-b border-white/8 px-4 py-3 text-white">
                          API access
                        </td>
                        <td className="border-b border-white/8 px-4 py-3">
                          Upload creation and reconstruction require a valid Supabase bearer token.
                        </td>
                      </tr>
                      <tr>
                        <td className="border-b border-white/8 px-4 py-3 text-white">
                          Retention
                        </td>
                        <td className="border-b border-white/8 px-4 py-3">
                          Uploaded PDFs are temporary. The current retention window is 24 hours and
                          cleanup runs through the maintenance endpoint.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-white">Abuse control</td>
                        <td className="px-4 py-3">
                          Daily per-user reconstruction limits apply before OpenRouter is used.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionShell>

              <SectionShell
                id="api-endpoints"
                eyebrow="06 / API Endpoints"
                title="Publicly visible routes and their role"
                description="The backend surface is intentionally small. Most logic is concentrated in a few authenticated routes."
              >
                <div className="space-y-4">
                  {[
                    {
                      route: "POST /api/uploads/create",
                      detail:
                        "Validates the authenticated user, checks file metadata, creates the `documents` row, and returns a signed upload descriptor for private storage.",
                    },
                    {
                      route: "POST /api/documents/reconstruct",
                      detail:
                        "Validates the user and document ownership, applies rate limiting, downloads the private PDF, extracts text, reconstructs with OpenRouter, and returns Markdown.",
                    },
                    {
                      route: "POST /api/maintenance/cleanup",
                      detail:
                        "Protected by `CRON_SECRET`. Removes expired storage objects and advances or clears expired document state.",
                    },
                    {
                      route: "POST /api/reconstruct",
                      detail:
                        "Legacy raw-text path is intentionally disabled and returns `410` so the app cannot bypass the storage-backed flow.",
                    },
                  ].map((item) => (
                    <div
                      key={item.route}
                      className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
                    >
                      <div className="mb-3 font-mono text-[12px] text-white">{item.route}</div>
                      <p className="text-sm leading-7 text-zinc-400">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </SectionShell>

              <SectionShell
                id="operational-limits"
                eyebrow="07 / Operational Limits"
                title="Hard limits enforced by the pipeline"
                description="These limits exist to control cost, runtime, and abuse while keeping output quality predictable."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "PDF file size", value: "15 MB maximum" },
                    { label: "PDF page count", value: "40 pages maximum" },
                    { label: "Raw extracted text", value: "200,000 characters maximum" },
                    { label: "Reconstructed output", value: "250,000 characters maximum" },
                    { label: "Daily reconstructions", value: "20 per authenticated user" },
                    { label: "File retention", value: "24 hours" },
                  ].map((limit) => (
                    <div
                      key={limit.label}
                      className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
                    >
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                        {limit.label}
                      </div>
                      <div className="text-lg font-semibold tracking-tight text-white">
                        {limit.value}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionShell>

              <SectionShell
                id="environment-deployment"
                eyebrow="08 / Environment & Deployment"
                title="Current configuration surface"
                description="The app is deployed on Vercel, uses Supabase for auth and storage, and requires a small set of browser and server environment variables."
              >
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Browser variables</h3>
                    <CodeBlock>
                      {`VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_STORAGE_BUCKET`}
                    </CodeBlock>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Server variables</h3>
                    <CodeBlock>
                      {`SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
SUPABASE_DATABASE_URL
SUPABASE_DATABASE_SSL
OPENROUTER_API_KEY
APP_BASE_URL
ALLOWED_ORIGINS
OPENROUTER_HTTP_REFERER
CRON_SECRET`}
                    </CodeBlock>
                  </div>
                </div>
                <p>
                  Vercel handles the public app shell and API routes. Supabase handles invited-user
                  authentication, private file storage, and document persistence. OpenRouter is only
                  called server-side after authentication, ownership, and limit checks pass.
                </p>
              </SectionShell>

              <SectionShell
                id="rate-limit-verification"
                eyebrow="09 / Rate-Limit Verification"
                title="How to prove the limiter works in production"
                description="The repository includes a dedicated production test script that exercises the real deployed path without changing application code."
              >
                <p>
                  Use the standalone script at{" "}
                  <span className="font-mono text-white">scripts/test-rate-limit.mjs</span>. It
                  runs the full loop: create upload, signed storage upload, then reconstruct. The
                  correct success signal is not a silent pass. It is an eventual HTTP{" "}
                  <span className="font-mono text-white">429</span>, which means{" "}
                  <span className="text-white">Too Many Requests</span>.
                </p>
                <CodeBlock>
                  {`ACCESS_TOKEN="paste_token_here" \\
PDF_PATH="/absolute/path/to/small-valid.pdf" \\
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \\
npm run test:rate-limit`}
                </CodeBlock>
                <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
                  <div className="mb-3 flex items-center gap-3 text-white">
                    <Gauge className="h-4 w-4" />
                    <span className="font-semibold">What 429 means</span>
                  </div>
                  <p className="text-sm leading-7 text-zinc-400">
                    A `429` response from `/api/documents/reconstruct` means the backend blocked
                    that authenticated user because the daily reconstruction quota was reached. That
                    is the expected signal that the limiter is enforcing correctly.
                  </p>
                </div>
              </SectionShell>

              <SectionShell
                id="faq"
                eyebrow="10 / FAQ"
                title="Answers to the recurring operational questions"
                description="These are the questions operators tend to ask once the pipeline is deployed and actively used."
              >
                <div className="space-y-4">
                  {[
                    {
                      question: "Why is sign-in required if the landing page is public?",
                      answer:
                        "Because the landing page is marketing and orientation. The document workflow is protected since uploads, reconstruction cost, and stored files need authenticated ownership and abuse controls.",
                    },
                    {
                      question: "Why do uploaded PDFs expire?",
                      answer:
                        "Temporary retention lowers storage exposure and operational risk. The current system keeps PDFs only long enough to process and support short-lived review or replay scenarios.",
                    },
                    {
                      question: "Why can a user hit the limit before 20 in a test run?",
                      answer:
                        "Because the quota belongs to the authenticated user, not the token string itself. If that same user already used part of the daily quota earlier, the limiter should trigger sooner.",
                    },
                    {
                      question: "What matters most between local and production behavior?",
                      answer:
                        "Production uses the real Vercel function runtime, deployed environment variables, real Supabase project settings, and the full storage-backed pipeline. Local success is necessary, but production is the final authority.",
                    },
                  ].map((item) => (
                    <div
                      key={item.question}
                      className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
                    >
                      <h3 className="text-base font-semibold tracking-tight text-white">
                        {item.question}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-400">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </SectionShell>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
