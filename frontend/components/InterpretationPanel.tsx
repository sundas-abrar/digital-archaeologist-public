"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { getInterpretation, type AIInterpretation } from "@/lib/api";

type Status = "idle" | "loading" | "done" | "error";

export default function InterpretationPanel({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<AIInterpretation | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setStatus("loading");
    setError("");
    const res = await getInterpretation(sessionId);
    if ("error" in res) {
      setError(res.error ?? "Something went wrong.");
      setStatus("error");
      return;
    }
    setData(res);
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
        <span className="font-mono text-sm">Reconstructing the story&hellip;</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Sparkles size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Phase 5 &middot; AI interpretation</h3>
        </div>
        <p className="mt-2 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  if (!data.available) {
    return (
      <div className="border border-dashed border-white/15 bg-soil-900/30 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Sparkles size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Phase 5 &middot; AI interpretation</h3>
        </div>
        <p className="mt-2 text-sm text-bone-400">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="border border-white/10 bg-soil-900/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-bone-200">
          <Sparkles size={16} className="shrink-0 text-brass-400" />
          <h3 className="truncate font-mono text-sm font-semibold">
            {data.project_title || "Project reconstructed"}
          </h3>
        </div>
        <button
          onClick={run}
          className="inline-flex shrink-0 items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={12} />
          Re-interpret
        </button>
      </div>

      {data.estimated_timeline && (
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.05em] text-bone-600">
          Estimated timeline &middot;{" "}
          <span className="text-bone-400">{data.estimated_timeline}</span>
        </p>
      )}

      {data.narrative && (
        <p className="mt-3 text-sm leading-relaxed text-bone-300">
          {data.narrative}
        </p>
      )}

      {data.evolution && data.evolution.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {data.evolution.map((stage, i) => (
            <span key={stage} className="flex items-center gap-2">
              <span className="bg-soil-800 px-2.5 py-1 font-mono text-xs text-bone-300">
                {stage}
              </span>
              {i < (data.evolution?.length ?? 0) - 1 && (
                <ArrowRight size={12} className="text-bone-600" />
              )}
            </span>
          ))}
        </div>
      )}

      {data.key_insight && (
        <div className="mt-4 border border-brass-500/30 bg-brass-500/5 px-3 py-2">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-brass-400">Key insight</p>
          <p className="mt-1 text-sm text-bone-300">{data.key_insight}</p>
        </div>
      )}

      {data.model && (
        <p className="mt-4 font-mono text-xs text-bone-700">via {data.model}</p>
      )}
    </div>
  );
}
