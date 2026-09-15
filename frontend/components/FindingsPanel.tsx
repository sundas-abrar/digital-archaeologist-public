"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  Clock,
  Copy,
  Flame,
  Users,
  Archive,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  SearchCheck,
  Check,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  getFindings,
  submitFeedback,
  improveFinding,
  type Finding,
  type FindingsResult,
  type FeedbackType,
  type ImproveFindingResult,
} from "@/lib/api";

const CATEGORY_ICON: Record<Finding["category"], typeof Clock> = {
  timeline_anomaly: Clock,
  repeated_file: Copy,
  hotspot: Flame,
  contributor: Users,
  artifact: Archive,
};

const SEVERITY_STYLE: Record<Finding["severity"], string> = {
  info: "text-bone-400 border-white/10",
  notable: "text-brass-400 border-brass-500/40",
  anomaly: "text-rust-400 border-rust-400/40",
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-rust-400" : value >= 50 ? "bg-brass-400" : "bg-bone-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden bg-soil-800">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs text-bone-400">{value}%</span>
    </div>
  );
}

function ImproveAnalysis({
  sessionId,
  findingId,
}: {
  sessionId: string;
  findingId: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ImproveFindingResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setStatus("loading");
    setError("");
    const res = await improveFinding(sessionId, findingId);
    if ("error" in res) {
      setError(res.error);
      setStatus("error");
      return;
    }
    setResult(res);
    setStatus("done");
  }

  if (status === "idle") {
    return (
      <button
        onClick={run}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-500 transition-colors hover:text-brass-400"
        aria-label="Improve analysis"
      >
        <SearchCheck size={13} />
        Improve analysis
      </button>
    );
  }

  if (status === "loading") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-500">
        <Loader2 size={12} className="animate-spin text-brass-400" />
        Re-investigating&hellip;
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-rust-400">
        <AlertCircle size={12} />
        {error}
      </span>
    );
  }

  if (!result) return null;

  const delta = result.revised_confidence - result.previous_confidence;

  return (
    <div className="mt-1 border border-brass-500/30 bg-brass-500/5 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
            Previous conclusion
          </p>
          <ConfidenceBar value={result.previous_confidence} />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
            Revised conclusion
          </p>
          <ConfidenceBar value={result.revised_confidence} />
        </div>
        {delta !== 0 && (
          <span
            className={`flex items-center gap-1 font-mono text-xs ${
              delta > 0 ? "text-moss-400" : "text-rust-400"
            }`}
          >
            <TrendingUp size={12} className={delta < 0 ? "rotate-180" : ""} />
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>

      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
        {result.new_evidence_count > 0
          ? `${result.new_evidence_count} additional signal${result.new_evidence_count !== 1 ? "s" : ""} found`
          : "No additional evidence surfaced"}
      </p>
      {result.new_evidence.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {result.new_evidence.map((e) => (
            <li key={e} className="text-sm text-bone-300">
              &middot; {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FindingFeedback({
  sessionId,
  findingId,
}: {
  sessionId: string;
  findingId: string;
}) {
  const [sent, setSent] = useState<FeedbackType | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function send(type: FeedbackType, message?: string) {
    setSubmitting(true);
    const res = await submitFeedback({
      session_id: sessionId,
      finding_id: findingId,
      type,
      message,
    });
    setSubmitting(false);
    if (!("error" in res)) {
      setSent(type);
      setShowNote(false);
    }
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
          Is this finding accurate?
        </span>
        <button
          disabled={submitting || !!sent}
          onClick={() => send("correct")}
          className={`-m-2 flex items-center gap-1 p-2 transition-colors disabled:opacity-50 sm:-m-0 sm:p-0 ${
            sent === "correct" ? "text-moss-400" : "text-bone-500 hover:text-moss-400"
          }`}
          aria-label="Correct"
        >
          <ThumbsUp size={14} />
        </button>
        <button
          disabled={submitting || !!sent}
          onClick={() => setShowNote((v) => !v)}
          className={`-m-2 flex items-center gap-1 p-2 transition-colors disabled:opacity-50 sm:-m-0 sm:p-0 ${
            sent === "incorrect" ? "text-rust-400" : "text-bone-500 hover:text-rust-400"
          }`}
          aria-label="Incorrect"
        >
          <ThumbsDown size={14} />
        </button>

        <span className="h-3 w-px bg-white/10" />

        <ImproveAnalysis sessionId={sessionId} findingId={findingId} />
      </div>

      {sent === "correct" && (
        <p className="mt-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-moss-400">
          <Check size={12} />
          Thanks &mdash; feedback recorded
        </p>
      )}

      {showNote && !sent && (
        <div className="mt-2.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={"What's wrong? e.g. \u2018File B was actually copied from File A.\u2019"}
            rows={2}
            className="w-full border border-white/15 bg-soil-950 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-700 focus:border-brass-400 focus:outline-none"
          />
          <button
            disabled={submitting || !note.trim()}
            onClick={() => send("incorrect", note)}
            className="mt-2 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Sending\u2026" : "Submit"}
          </button>
        </div>
      )}

      {sent === "incorrect" && (
        <p className="mt-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-moss-400">
          <Check size={12} />
          Thanks &mdash; feedback recorded
        </p>
      )}
    </div>
  );
}

type Status = "idle" | "loading" | "done" | "error";

export default function FindingsPanel({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<FindingsResult | null>(null);
  const [error, setError] = useState("");

  async function runFindings() {
    setStatus("loading");
    setError("");
    const res = await getFindings(sessionId);
    if ("error" in res) {
      setError(res.error);
      setStatus("error");
      return;
    }
    setData(res);
    setStatus("done");
  }

  useEffect(() => {
    if (sessionId) runFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex items-center gap-3 border border-white/10 bg-soil-900/40 p-5 text-bone-400">
        <Loader2 size={16} className="animate-spin text-brass-400" />
        <span className="font-mono text-sm">Piecing the evidence together&hellip;</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Sparkles size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Phase 4 &middot; Findings engine</h3>
        </div>
        <p className="mt-2 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
          {error}
        </p>
        <p className="mt-3 text-sm text-bone-500">
          Expected until the backend&apos;s <code className="text-brass-400">/api/findings/&#123;session_id&#125;</code>{" "}
          route ships (Phase 4, point 2).
        </p>
        <button
          onClick={runFindings}
          className="mt-4 inline-flex items-center gap-2 border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  if (data.findings.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-soil-900/30 px-6 py-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-bone-600">No findings surfaced</p>
        <p className="mt-2 text-sm text-bone-400">
          The dig came up quiet &mdash; nothing anomalous in this archive yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-bone-500">
          {data.total_findings} finding{data.total_findings !== 1 ? "s" : ""}
        </h3>
        <button
          onClick={runFindings}
          className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={12} />
          Re-dig
        </button>
      </div>

      {data.findings.map((f, i) => {
        const Icon = CATEGORY_ICON[f.category] ?? Sparkles;
        return (
          <div
            key={f.id}
            className="border border-white/10 bg-soil-900/40 p-4"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 shrink-0 border p-1.5 ${SEVERITY_STYLE[f.severity]}`}
              >
                <Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="font-mono text-xs uppercase tracking-[0.08em] text-brass-400">
                    Finding #{String(i + 1).padStart(2, "0")}
                  </p>
                  {typeof f.confidence === "number" && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-bone-600">
                      {f.confidence}% confidence
                    </span>
                  )}
                </div>
                <h4 className="mt-0.5 text-sm font-medium text-bone-100">
                  {f.title}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-bone-400">
                  {f.description}
                </p>
                {f.evidence.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.evidence.map((e) => (
                      <span
                        key={e}
                        className="max-w-full break-words bg-soil-800 px-1.5 py-0.5 font-mono text-xs text-bone-500"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                )}
                <FindingFeedback sessionId={sessionId} findingId={f.id} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
