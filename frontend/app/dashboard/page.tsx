"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Clock,
  Search,
  FolderTree,
  ArrowRight,
  Code2,
  Download,
  MessageSquare,
  Compass,
  FlaskConical,
  Bot,
  MessageCircle,
  MoreHorizontal,
  X,
} from "lucide-react";
import { API_BASE, type FileTreeNode, type ScanSummary } from "@/lib/api";
import FileTree from "@/components/FileTree";
import FindingsPanel from "@/components/FindingsPanel";
import TimelinePanel from "@/components/TimelinePanel";
import CodeEvolutionPanel from "@/components/CodeEvolutionPanel";
import OverviewPanel from "@/components/OverviewPanel";
import FeedbackForm from "@/components/FeedbackForm";
import InvestigationPanel from "@/components/InvestigationPanel";
import QAPanel from "@/components/QAPanel";
import AgentPanel from "@/components/AgentPanel";
import AskPanel from "@/components/AskPanel";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agent", label: "Agent Mode", icon: Bot },
  { id: "ask", label: "Ask the Dig Site", icon: MessageCircle },
  { id: "investigation", label: "Investigation", icon: Compass },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "evolution", label: "Code Evolution", icon: Code2 },
  { id: "findings", label: "Findings", icon: Search },
  { id: "qa", label: "Testing / QA", icon: FlaskConical },
  { id: "files", label: "File Explorer", icon: FolderTree },
  { id: "feedback", label: "Help Us Improve", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Shown in the fixed bottom bar on phones; everything else lives under "More".
const PRIMARY_MOBILE: TabId[] = ["overview", "agent", "findings", "files"];
const SHORT_LABEL: Partial<Record<TabId, string>> = { files: "Files", agent: "Agent" };


function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-10 flex min-h-[320px] flex-col items-center justify-center border border-dashed border-white/15 bg-soil-900/30 px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-bone-600">
        No excavation yet &middot; {label}
      </p>
      <p className="mt-3 max-w-sm text-bone-400">
        Upload a project first, then come back here through the &ldquo;Continue
        to dashboard&rdquo; link.
      </p>
      <Link
        href="/upload"
        className="group mt-6 inline-flex items-center gap-2 border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
      >
        Go to upload
        <ArrowRight
          size={14}
          className="transition-transform group-hover:translate-x-1"
        />
      </Link>
    </div>
  );
}

function DashboardBody() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";

  const [active, setActive] = useState<TabId>("overview");
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/upload/${sessionId}/tree`);
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.detail || "Could not load this session.");
          return;
        }
        setTree(data.file_tree);
        setSummary(data.summary);
      } catch {
        setLoadError("Can't reach the backend. Is FastAPI running?");
      }
    })();
  }, [sessionId]);

  if (!sessionId) {
    return (
      <>
        <Nav active={active} setActive={setActive} />
        <EmptyState label={TABS.find((t) => t.id === active)?.label ?? ""} />
      </>
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-full break-all font-mono text-xs uppercase tracking-[0.08em] text-bone-600">
          Session &middot; {sessionId}
        </p>
        <a
          href={`${API_BASE}/api/report/${sessionId}?format=pdf`}
          download
          className="group inline-flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-300 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <Download size={12} />
          Download report
        </a>
      </div>

      <Nav active={active} setActive={setActive} />

      {loadError && (
        <p className="mt-6 border border-rust-400/40 bg-soil-800 px-4 py-3 text-sm text-rust-400">
          {loadError}
        </p>
      )}

      <div className="mt-3 md:mt-8">
        {active === "overview" && (
          <OverviewPanel
            sessionId={sessionId}
            summary={summary}
            onNavigate={setActive}
          />
        )}

        {active === "agent" && <AgentPanel sessionId={sessionId} />}

        {active === "ask" && <AskPanel sessionId={sessionId} />}

        {active === "investigation" && (
          <InvestigationPanel sessionId={sessionId} summary={summary} />
        )}

        {active === "timeline" && <TimelinePanel sessionId={sessionId} />}

        {active === "evolution" && <CodeEvolutionPanel sessionId={sessionId} />}

        {active === "findings" && <FindingsPanel sessionId={sessionId} />}

        {active === "qa" && <QAPanel sessionId={sessionId} />}

        {active === "files" && tree && <FileTree root={tree} />}

        {active === "feedback" && <FeedbackForm sessionId={sessionId} />}
      </div>
    </>
  );
}

function Nav({
  active,
  setActive,
}: {
  active: TabId;
  setActive: (id: TabId) => void;
}) {
  return (
    <>
      <DesktopTabs active={active} setActive={setActive} />
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-brass-400 md:hidden">
        {TABS.find((t) => t.id === active)?.label}
      </p>
      <MobileNav active={active} setActive={setActive} />
    </>
  );
}

function MobileNav({
  active,
  setActive,
}: {
  active: TabId;
  setActive: (id: TabId) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const primary = TABS.filter((t) => PRIMARY_MOBILE.includes(t.id));
  const more = TABS.filter((t) => !PRIMARY_MOBILE.includes(t.id));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-soil-950/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primary.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
              active === t.id ? "text-brass-400" : "text-bone-500"
            }`}
          >
            <t.icon size={17} />
            {SHORT_LABEL[t.id] ?? t.label.split(" ")[0]}
          </button>
        ))}
        <button
          onClick={() => setSheet(true)}
          className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 font-mono text-[11px] uppercase tracking-[0.04em] ${
            more.some((t) => t.id === active) ? "text-brass-400" : "text-bone-500"
          }`}
        >
          <MoreHorizontal size={17} />
          More
        </button>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-soil-950/80"
            onClick={() => setSheet(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-soil-900 p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-600">
                More sections
              </p>
              <button
                aria-label="Close"
                onClick={() => setSheet(false)}
                className="flex h-11 w-11 items-center justify-center text-bone-500"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="mt-1">
              {more.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      setActive(t.id);
                      setSheet(false);
                    }}
                    className={`flex min-h-[48px] w-full items-center gap-3 border-b border-white/5 font-mono text-xs uppercase tracking-[0.08em] ${
                      active === t.id ? "text-brass-400" : "text-bone-300"
                    }`}
                  >
                    <t.icon size={15} className="shrink-0" />
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopTabs({
  active,
  setActive,
}: {
  active: TabId;
  setActive: (id: TabId) => void;
}) {
  return (
    <div className="mt-8 hidden gap-1 overflow-x-auto border-b border-white/10 md:flex">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-[0.08em] transition-colors ${
              isActive
                ? "border-brass-400 text-brass-400"
                : "border-transparent text-bone-500 hover:text-bone-200"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-6 md:pb-16 md:pt-16">
      <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
        <span className="h-px w-6 bg-brass-400" />
        Dig site
      </p>
      <h1 className="text-3xl font-bold uppercase tracking-tight text-bone-100 md:text-4xl">Dashboard</h1>

      <Suspense fallback={null}>
        <DashboardBody />
      </Suspense>
    </main>
  );
}
