"use client";

import {
  Files,
  HardDrive,
  GitBranch,
  Layers,
  Clock,
  Code2,
  Search,
  FolderTree,
  ChevronRight,
  Compass,
} from "lucide-react";
import type { ScanSummary } from "@/lib/api";
import InterpretationPanel from "@/components/InterpretationPanel";

const EXT_PALETTE = ["#C08A4E", "#BE5A45", "#7C9473", "#8A8A85", "#A8743D"];

type TabId =
  | "overview"
  | "investigation"
  | "timeline"
  | "evolution"
  | "findings"
  | "files";

export default function OverviewPanel({
  sessionId,
  summary,
  onNavigate,
}: {
  sessionId: string;
  summary: ScanSummary | null;
  onNavigate: (tab: TabId) => void;
}) {
  const topExtensions = summary?.top_extensions ?? [];
  const maxCount = Math.max(1, ...topExtensions.map((e) => e.count));

  return (
    <div className="space-y-5">
      <InterpretationPanel sessionId={sessionId} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Files} label="Files" value={summary?.total_files ?? "\u2014"} />
        <StatCard
          icon={HardDrive}
          label="Total size"
          value={summary?.total_size_human ?? "\u2014"}
        />
        <StatCard
          icon={GitBranch}
          label="Git history"
          value={summary ? (summary.has_git_history ? "Yes" : "No") : "\u2014"}
        />
        <StatCard
          icon={Layers}
          label="File types"
          value={summary?.top_extensions?.length ?? "\u2014"}
        />
      </div>

      {topExtensions.length > 0 && (
        <div className="border border-white/10 bg-soil-900/40 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">Top file types</p>
          <div className="mt-3 space-y-2">
            {topExtensions.slice(0, 6).map((ext, i) => (
              <div key={ext.extension} className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-xs text-bone-400">
                  {ext.extension || "(none)"}
                </span>
                <div className="h-2 flex-1 overflow-hidden bg-soil-800">
                  <div
                    className="h-full"
                    style={{
                      width: `${(ext.count / maxCount) * 100}%`,
                      background: EXT_PALETTE[i % EXT_PALETTE.length],
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-xs text-bone-600">
                  {ext.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.1em] text-brass-400">Explore the dig site</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            icon={Compass}
            title="Investigation"
            description="Watch the agent plan, gather evidence, analyze & report."
            onClick={() => onNavigate("investigation")}
          />
          <QuickLink
            icon={Clock}
            title="Timeline"
            description="Reconstructed evolution from git history and AI narrative."
            onClick={() => onNavigate("timeline")}
          />
          <QuickLink
            icon={Code2}
            title="Code Evolution"
            description="Function & class hotspots, file-type breakdown."
            onClick={() => onNavigate("evolution")}
          />
          <QuickLink
            icon={Search}
            title="Findings"
            description="Anomalies, revisions, and hidden connections."
            onClick={() => onNavigate("findings")}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Files;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-white/10 bg-soil-900/40 p-4">
      <Icon size={16} className="text-brass-400" />
      <p className="mt-2 text-xl font-semibold text-bone-100">{value}</p>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-600">{label}</p>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Clock;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start border border-white/10 bg-soil-900/40 p-4 text-left transition-colors hover:border-brass-400/70"
    >
      <div className="flex w-full items-center justify-between">
        <Icon size={16} className="text-brass-400" />
        <ChevronRight
          size={14}
          className="text-bone-600 transition-transform group-hover:translate-x-1 group-hover:text-brass-400"
        />
      </div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-bone-100">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-bone-500">{description}</p>
    </button>
  );
}
