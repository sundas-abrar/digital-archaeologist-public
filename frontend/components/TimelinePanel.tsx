"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Loader2,
  RefreshCw,
  GitCommit,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  scanSession,
  getInterpretation,
  type GitInfo,
  type AIInterpretation,
} from "@/lib/api";

type Status = "idle" | "loading" | "done" | "error";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function TimelinePanel({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [git, setGit] = useState<GitInfo | null>(null);
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(
    null
  );

  async function run() {
    setStatus("loading");
    setError("");

    const [scanRes, interpretRes] = await Promise.all([
      scanSession(sessionId),
      getInterpretation(sessionId),
    ]);

    if ("error" in scanRes) {
      setError(scanRes.error);
      setStatus("error");
      return;
    }

    setGit(scanRes.git);
    setInterpretation("error" in interpretRes ? null : interpretRes);
    setStatus("done");
  }

  useEffect(() => {
    if (sessionId) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex items-center gap-3 border border-white/10 bg-soil-900/40 p-5 text-bone-400">
        <Loader2 size={16} className="animate-spin text-brass-400" />
        <span className="font-mono text-sm">Digging through the layers&hellip;</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Clock size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Phase 6 &middot; Timeline</h3>
        </div>
        <p className="mt-2 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
          {error}
        </p>
        <button
          onClick={run}
          className="mt-4 inline-flex items-center gap-2 border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const hasEvolution = !!(
    interpretation?.available && interpretation.evolution?.length
  );
  const hasCommits = !!(git?.available && git.commits && git.commits.length > 0);

  if (!hasEvolution && !hasCommits) {
    return (
      <div className="border border-dashed border-white/15 bg-soil-900/30 px-6 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-bone-600">No timeline to reconstruct</p>
        <p className="mt-2 text-sm text-bone-400">
          This archive has no git history and the AI interpretation didn&apos;t
          surface evolution stages. Timeline needs at least one of the two.
        </p>
      </div>
    );
  }

  // git log gives newest-first; walk it oldest-to-newest for a real timeline
  const commits = hasCommits ? [...git!.commits!].reverse() : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-bone-500">
          {hasCommits
            ? `${git!.commit_count} commit${git!.commit_count !== 1 ? "s" : ""} reconstructed`
            : "Evolution reconstructed from evidence"}
        </h3>
        <button
          onClick={run}
          className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={12} />
          Re-dig
        </button>
      </div>

      {hasEvolution && (
        <div className="border border-white/10 bg-soil-900/40 p-4">
          <div className="flex items-center gap-2 text-bone-200">
            <Sparkles size={14} className="text-brass-400" />
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">Stages of evolution</p>
          </div>
          {interpretation?.estimated_timeline && (
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.05em] text-bone-600">
              Estimated span &middot;{" "}
              <span className="text-bone-400">
                {interpretation.estimated_timeline}
              </span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {interpretation!.evolution!.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                <span className="bg-soil-800 px-2.5 py-1 font-mono text-xs text-bone-300">
                  {stage}
                </span>
                {i < (interpretation!.evolution!.length ?? 0) - 1 && (
                  <ArrowRight size={12} className="text-bone-600" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasCommits && (
        <div className="relative pl-6">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" />

          <div className="space-y-5">
            {commits.map((commit, i) => (
              <div key={commit.hash + i} className="relative">
                <span className="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-brass-500 bg-soil-950" />
                <div className="border border-white/10 bg-soil-900/40 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-xs text-bone-600">
                      <GitCommit size={13} className="text-brass-400" />
                      {commit.hash}
                    </div>
                    <p className="font-mono text-xs text-bone-600">
                      {formatDate(commit.date)}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-bone-200">{commit.message}</p>
                  <p className="mt-1 font-mono text-xs text-bone-600">
                    {commit.author}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasCommits && (
        <p className="font-mono text-xs text-bone-600">
          {git?.error ? git.error : "No git history survived this archive."}
        </p>
      )}
    </div>
  );
}
