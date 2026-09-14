"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  Code2,
  Box,
  AlertTriangle,
  GitCommit as GitCommitIcon,
} from "lucide-react";
import { scanSession, type DeepScanResult } from "@/lib/api";

const TAG_COLOR: Record<string, string> = {
  TODO: "text-brass-400 border-brass-500/40",
  FIXME: "text-rust-400 border-rust-400/40",
  HACK: "text-rust-400 border-rust-400/40",
  XXX: "text-rust-400 border-rust-400/40",
};

export default function DeepScanPanel({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [data, setData] = useState<DeepScanResult | null>(null);
  const [error, setError] = useState("");

  async function runScan() {
    setStatus("loading");
    setError("");
    const res = await scanSession(sessionId);
    if ("error" in res) {
      setError(res.error);
      setStatus("error");
      return;
    }
    setData(res);
    setStatus("done");
  }

  if (status === "idle" || status === "error") {
    return (
      <div className="mt-8 border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Search size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Phase 3 &middot; Archaeological scan</h3>
        </div>
        <p className="mt-2 text-sm text-bone-400">
          Go deeper: functions, classes, imports, TODO/FIXME comments, and
          git history (if the archive included a .git folder).
        </p>
        {error && (
          <p className="mt-3 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
            {error}
          </p>
        )}
        <button
          onClick={runScan}
          className="mt-4 border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          Run deep scan
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="mt-8 flex items-center gap-3 border border-white/10 bg-soil-900/40 p-5 text-bone-400">
        <Loader2 size={16} className="animate-spin text-brass-400" />
        <span className="font-mono text-sm">Brushing through the files…</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-8 space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Code2} label="Functions" value={data.total_functions} />
        <StatCard icon={Box} label="Classes" value={data.total_classes} />
        <StatCard icon={AlertTriangle} label="TODO/FIXME" value={data.total_todos} />
        <StatCard
          icon={GitCommitIcon}
          label="Git commits"
          value={data.git.available ? data.git.commit_count ?? 0 : "\u2014"}
        />
      </div>

      {data.git.available && data.git.commits && data.git.commits.length > 0 && (
        <div className="border border-white/10 bg-soil-900/40 p-4">
          <h4 className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">
            Git history &middot; {data.git.authors?.length ?? 0} contributor
            {data.git.authors && data.git.authors.length !== 1 ? "s" : ""}
          </h4>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {data.git.commits.slice(0, 30).map((c) => (
              <div key={c.hash} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 shrink-0 bg-soil-800 px-1.5 py-0.5 font-mono text-xs text-brass-400">
                  {c.hash}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-bone-200">{c.message}</p>
                  <p className="font-mono text-xs text-bone-600">
                    {c.author} &middot; {new Date(c.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.git.available && (
        <p className="border border-white/10 bg-soil-900/30 px-4 py-3 text-sm text-bone-600">
          No git history found in this archive — either it wasn't a git
          repo, or the .git folder wasn't included in the zip.
        </p>
      )}

      {data.total_todos > 0 && (
        <div className="border border-white/10 bg-soil-900/40 p-4">
          <h4 className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">
            TODO / FIXME comments
          </h4>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {data.files
              .filter((f) => f.todos && f.todos.length > 0)
              .flatMap((f) =>
                (f.todos ?? []).map((t) => (
                  <div
                    key={`${f.path}:${t.line}`}
                    className="flex items-start gap-3 border border-white/10 px-3 py-2 text-sm"
                  >
                    <span
                      className={`shrink-0 border px-1.5 py-0.5 font-mono text-xs ${
                        TAG_COLOR[t.tag] ?? "text-bone-400 border-white/10"
                      }`}
                    >
                      {t.tag}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-bone-200">
                        {t.text || "(no message)"}
                      </p>
                      <p className="font-mono text-xs text-bone-600">
                        {f.path}:{t.line}
                      </p>
                    </div>
                  </div>
                ))
              )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Code2;
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
