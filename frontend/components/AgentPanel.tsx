"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ListChecks,
  Search,
  Code2,
  Share2,
  FlaskConical,
  Sparkles,
  FileText,
  Loader2,
  Check,
  X,
  MinusCircle,
  Play,
} from "lucide-react";
import { API_BASE } from "@/lib/api";

type StepId =
  | "plan"
  | "scan"
  | "extract"
  | "relationships"
  | "test"
  | "interpret"
  | "report"
  | "error";

type StepStatus = "running" | "done" | "failed" | "skipped";

type AgentEvent = {
  step: StepId;
  status: StepStatus;
  detail: string;
  data: Record<string, unknown>;
};

const STEP_META: Record<StepId, { label: string; icon: typeof Bot }> = {
  plan: { label: "Plan", icon: ListChecks },
  scan: { label: "Scan", icon: Search },
  extract: { label: "Extract evidence", icon: Code2 },
  relationships: { label: "Find relationships", icon: Share2 },
  test: { label: "Test", icon: FlaskConical },
  interpret: { label: "Interpret", icon: Sparkles },
  report: { label: "Report", icon: FileText },
  error: { label: "Error", icon: X },
};

const STATUS_STYLE: Record<StepStatus, string> = {
  running: "border-brass-400 text-brass-400",
  done: "border-moss-400/50 text-moss-400",
  failed: "border-rust-400/50 text-rust-400",
  skipped: "border-white/15 text-bone-600",
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 size={13} className="animate-spin" />;
  if (status === "done") return <Check size={13} />;
  if (status === "failed") return <X size={13} />;
  return <MinusCircle size={13} />;
}

export default function AgentPanel({ sessionId }: { sessionId: string }) {
  const [goal, setGoal] = useState("Determine how this project evolved.");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<AgentEvent[]>([]);
  const [finalData, setFinalData] = useState<Record<string, unknown> | null>(null);
  const [connError, setConnError] = useState("");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  function start() {
    sourceRef.current?.close();
    setLog([]);
    setFinalData(null);
    setConnError("");
    setRunning(true);

    const url = `${API_BASE}/api/agent/${sessionId}/run?goal=${encodeURIComponent(goal)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (msg) => {
      try {
        const parsed: AgentEvent = JSON.parse(msg.data);
        setLog((prev) => {
          // Replace the last entry for the same step if it was "running",
          // so each step shows one settled line instead of two.
          if (
            prev.length > 0 &&
            prev[prev.length - 1].step === parsed.step &&
            prev[prev.length - 1].status === "running"
          ) {
            return [...prev.slice(0, -1), parsed];
          }
          return [...prev, parsed];
        });

        if (parsed.step === "report" || parsed.step === "error") {
          setFinalData(parsed.data);
          setRunning(false);
          source.close();
        }
      } catch {
        // ignore malformed chunks
      }
    };

    source.onerror = () => {
      setConnError("Connection to the agent stream dropped. Is the backend still running?");
      setRunning(false);
      source.close();
    };
  }

  const findings = finalData?.findings as
    | { total_findings: number; findings: { severity: string }[] }
    | undefined;
  const interpretation = finalData?.interpretation as
    | { available: boolean; narrative?: string; project_title?: string }
    | undefined;

  return (
    <div className="space-y-5">
      <div className="border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Bot size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">
            Agent mode
          </h3>
        </div>
        <p className="mt-2 text-sm text-bone-500">
          Give it a goal and it runs the full investigation autonomously
          &mdash; scan, extract, connect, test, interpret, report &mdash;
          without switching tabs yourself.
        </p>

        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={running}
          placeholder="e.g. Determine how this project evolved."
          className="mt-4 w-full border border-white/15 bg-soil-950 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-700 focus:border-brass-400 focus:outline-none disabled:opacity-60"
        />

        <button
          onClick={start}
          disabled={running || !goal.trim()}
          className="mt-3 inline-flex items-center gap-2 border border-brass-500/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bone-100 transition-colors hover:border-brass-400 hover:bg-brass-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} />
          )}
          {running ? "Investigating\u2026" : "Run agent"}
        </button>

        {connError && (
          <p className="mt-3 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
            {connError}
          </p>
        )}
      </div>

      {log.length > 0 && (
        <div className="border border-white/10 bg-soil-900/40 p-5">
          <h4 className="mb-4 font-mono text-xs uppercase tracking-[0.1em] text-bone-500">
            Run log
          </h4>
          <div className="space-y-0">
            {log.map((e, i) => {
              const meta = STEP_META[e.step] ?? STEP_META.error;
              const Icon = meta.icon;
              return (
                <div
                  key={`${e.step}-${i}`}
                  className="flex gap-3 border-l border-white/10 py-2.5 pl-4"
                >
                  <span
                    className={`-ml-[21px] flex h-8 w-8 shrink-0 items-center justify-center border bg-soil-950 ${STATUS_STYLE[e.status]}`}
                  >
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-[0.08em] text-bone-200">
                        {meta.label}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] ${STATUS_STYLE[e.status].split(" ")[1]}`}
                      >
                        <StatusIcon status={e.status} />
                        {e.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-bone-400">
                      {e.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {finalData && (
        <div className="border border-brass-500/30 bg-brass-500/5 p-5">
          <h4 className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">
            Investigation summary
          </h4>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="font-mono text-lg text-bone-100">
                {typeof finalData.summary === "object" && finalData.summary
                  ? (finalData.summary as { total_files: number }).total_files
                  : "\u2014"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
                files
              </p>
            </div>
            <div>
              <p className="font-mono text-lg text-bone-100">
                {findings?.total_findings ?? "\u2014"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
                findings
              </p>
            </div>
            <div>
              <p className="font-mono text-lg text-bone-100">
                {findings?.findings?.filter((f) => f.severity === "anomaly").length ?? 0}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
                anomalies
              </p>
            </div>
            <div>
              <p className="font-mono text-lg text-bone-100">
                {interpretation?.available ? "Yes" : "No"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
                AI narrative
              </p>
            </div>
          </div>

          {interpretation?.available && interpretation.narrative && (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-relaxed text-bone-200">
              {interpretation.narrative}
            </p>
          )}

          <p className="mt-4 text-xs text-bone-600">
            Full detail for each step is available in its own tab
            (Findings, Timeline, Code Evolution, Testing/QA).
          </p>
        </div>
      )}
    </div>
  );
}
