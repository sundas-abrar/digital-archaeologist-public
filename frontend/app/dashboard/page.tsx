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

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agent", label: "Agent Mode", icon: Bot },
  { id: "investigation", label: "Investigation", icon: Compass },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "evolution", label: "Code Evolution", icon: Code2 },
  { id: "findings", label: "Findings", icon: Search },
  { id: "qa", label: "Testing / QA", icon: FlaskConical },
  { id: "files", label: "File Explorer", icon: FolderTree },
  { id: "feedback", label: "Help Us Improve", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];


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
        <TabBar active={active} setActive={setActive} />
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

      <TabBar active={active} setActive={setActive} />

      {loadError && (
        <p className="mt-6 border border-rust-400/40 bg-soil-800 px-4 py-3 text-sm text-rust-400">
          {loadError}
        </p>
      )}

      <div className="mt-8">
        {active === "overview" && (
          <OverviewPanel
            sessionId={sessionId}
            summary={summary}
            onNavigate={setActive}
          />
        )}

        {active === "agent" && <AgentPanel sessionId={sessionId} />}

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

function TabBar({
  active,
  setActive,
}: {
  active: TabId;
  setActive: (id: TabId) => void;
}) {
  return (
    <div className="mt-8 flex gap-1 overflow-x-auto border-b border-white/10">
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
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
        <span className="h-px w-6 bg-brass-400" />
        Dig site
      </p>
      <h1 className="text-4xl font-bold uppercase tracking-tight text-bone-100">Dashboard</h1>

      <Suspense fallback={null}>
        <DashboardBody />
      </Suspense>
    </main>
  );
}
