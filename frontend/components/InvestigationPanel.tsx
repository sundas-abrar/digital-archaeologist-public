"use client";

import { useEffect, useRef, useState } from "react";
import {
  Compass,
  FileSearch,
  Sparkles,
  ShieldAlert,
  ScrollText,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  Download,
  Circle,
} from "lucide-react";
import {
  API_BASE,
  scanSession,
  getFindings,
  getInterpretation,
  type DeepScanResult,
  type FindingsResult,
  type AIInterpretation,
  type ScanSummary,
} from "@/lib/api";

type StepId = "plan" | "evidence" | "analyze" | "contradictions" | "report";
type StepStatus = "pending" | "running" | "done" | "error";

type StepMeta = {
  id: StepId;
  title: string;
  verb: string;
  icon: typeof Compass;
};

const STEPS: StepMeta[] = [
  { id: "plan", title: "Plan", verb: "Formulating investigation plan", icon: Compass },
  { id: "evidence", title: "Gather Evidence", verb: "Scanning files, metadata & history", icon: FileSearch },
  { id: "analyze", title: "Analyze", verb: "Reconstructing the narrative", icon: Sparkles },
  { id: "contradictions", title: "Detect Contradictions", verb: "Cross-checking findings for anomalies", icon: ShieldAlert },
  { id: "report", title: "Report", verb: "Compiling the final dossier", icon: ScrollText },
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATUS_DOT: Record<StepStatus, string> = {
  pending: "border-white/20 text-bone-700",
  running: "border-brass-400 text-brass-400",
  done: "border-moss-400 text-moss-400",
  error: "border-rust-400 text-rust-400",
};

export default function InvestigationPanel({
  sessionId,
  summary,
}: {
  sessionId: string;
  summary: ScanSummary | null;
}) {
  const [statuses, setStatuses] = useState<Record<StepId, StepStatus>>({
    plan: "pending",
    evidence: "pending",
    analyze: "pending",
    contradictions: "pending",
    report: "pending",
  });
  const [errors, setErrors] = useState<Partial<Record<StepId, string>>>({});
  const [deepScan, setDeepScan] = useState<DeepScanResult | null>(null);
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null);
  const [findings, setFindings] = useState<FindingsResult | null>(null);
  const [running, setRunning] = useState(false);
  const runToken = useRef(0);

  async function runInvestigation() {
    const token = ++runToken.current;
    setRunning(true);
    setErrors({});
    setStatuses({
      plan: "pending",
      evidence: "pending",
      analyze: "pending",
      contradictions: "pending",
      report: "pending",
    });
    setDeepScan(null);
    setInterpretation(null);
    setFindings(null);

    const setOne = (id: StepId, status: StepStatus) => {
      if (runToken.current !== token) return;
      setStatuses((prev) => ({ ...prev, [id]: status }));
    };

    // 1. Plan — the agent states its goal before touching anything.
    setOne("plan", "running");
    await wait(500);
    if (runToken.current !== token) return;
    setOne("plan", "done");

    // 2. Gather Evidence — reuses the existing deep-scan endpoint.
    setOne("evidence", "running");
    const scanRes = await scanSession(sessionId);
    if (runToken.current !== token) return;
    if ("error" in scanRes) {
      setOne("evidence", "error");
      setErrors((prev) => ({ ...prev, evidence: scanRes.error }));
      setRunning(false);
      return;
    }
    setDeepScan(scanRes);
    setOne("evidence", "done");

    // 3. Analyze — reuses the existing AI interpretation endpoint.
    setOne("analyze", "running");
    const interpRes = await getInterpretation(sessionId);
    if (runToken.current !== token) return;
    if ("error" in interpRes) {
      setOne("analyze", "error");
      setErrors((prev) => ({ ...prev, analyze: interpRes.error }));
      setRunning(false);
      return;
    }
    setInterpretation(interpRes);
    setOne("analyze", "done");

    // 4. Detect Contradictions — reuses the existing findings endpoint,
    // treating "anomaly" severity findings as contradictions in the hypothesis.
    setOne("contradictions", "running");
    const findingsRes = await getFindings(sessionId);
    if (runToken.current !== token) return;
    if ("error" in findingsRes) {
      setOne("contradictions", "error");
      setErrors((prev) => ({ ...prev, contradictions: findingsRes.error }));
      setRunning(false);
      return;
    }
    setFindings(findingsRes);
    setOne("contradictions", "done");

    // 5. Report — synthesis of everything gathered above.
    setOne("report", "running");
    await wait(500);
    if (runToken.current !== token) return;
    setOne("report", "done");
    setRunning(false);
  }

  useEffect(() => {
    if (sessionId) runInvestigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const contradictions = findings?.findings.filter((f) => f.severity === "anomaly") ?? [];
  const hasError = Object.values(errors).some(Boolean);
  const allDone = STEPS.every((s) => statuses[s.id] === "done");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">
            Investigation
          </p>
          <p className="mt-1 text-sm text-bone-400">
            Goal &middot; determine how this project evolved, evidence-first.
          </p>
        </div>
        <button
          onClick={runInvestigation}
          disabled={running}
          className="inline-flex shrink-0 items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-300 transition-colors hover:border-brass-400 hover:text-brass-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={12} className={running ? "animate-spin" : ""} />
          {running ? "Investigating\u2026" : "Re-run investigation"}
        </button>
      </div>

      <div className="border border-white/10 bg-soil-900/40">
        {STEPS.map((step, i) => {
          const status = statuses[step.id];
          const Icon = step.icon;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step.id} className="relative flex gap-4 px-5 py-4">
              {!isLast && (
                <span
                  className={`absolute left-[34px] top-[52px] h-[calc(100%-28px)] w-px ${
                    status === "done" ? "bg-moss-400/50" : "bg-white/10"
                  }`}
                />
              )}

              <span
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-soil-950 ${STATUS_DOT[status]}`}
              >
                {status === "running" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : status === "done" ? (
                  <Check size={14} />
                ) : status === "error" ? (
                  <AlertTriangle size={14} />
                ) : (
                  <Icon size={14} />
                )}
              </span>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-bone-100">
                    {String(i + 1).padStart(2, "0")} &middot; {step.title}
                  </h3>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                      status === "running"
                        ? "text-brass-400"
                        : status === "done"
                        ? "text-moss-400"
                        : status === "error"
                        ? "text-rust-400"
                        : "text-bone-700"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <p className="mt-1 text-sm text-bone-400">
                  {status === "pending" ? "Waiting\u2026" : step.verb}
                </p>

                {step.id === "plan" && status === "done" && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {["Scan files", "Extract metadata", "Compare versions", "Build timeline", "Verify"].map(
                      (t) => (
                        <span
                          key={t}
                          className="flex items-center gap-1 bg-soil-800 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.05em] text-bone-400"
                        >
                          <Circle size={5} className="fill-current text-brass-400" />
                          {t}
                        </span>
                      )
                    )}
                  </p>
                )}

                {step.id === "evidence" && status === "done" && deepScan && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MiniStat label="Files scanned" value={deepScan.files_analyzed} />
                    <MiniStat label="Functions" value={deepScan.total_functions} />
                    <MiniStat label="Classes" value={deepScan.total_classes} />
                    <MiniStat
                      label="Commits"
                      value={deepScan.git.available ? deepScan.git.commit_count ?? 0 : "\u2014"}
                    />
                  </div>
                )}

                {step.id === "analyze" && status === "done" && interpretation && (
                  <div className="mt-2">
                    {interpretation.available ? (
                      <>
                        {interpretation.key_insight && (
                          <p className="border-l-2 border-brass-500/40 pl-3 text-sm text-bone-300">
                            {interpretation.key_insight}
                          </p>
                        )}
                        {interpretation.estimated_timeline && (
                          <p className="mt-1.5 font-mono text-xs text-bone-600">
                            Estimated timeline &middot;{" "}
                            <span className="text-bone-400">{interpretation.estimated_timeline}</span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-bone-500">{interpretation.error || "AI interpretation unavailable."}</p>
                    )}
                  </div>
                )}

                {step.id === "contradictions" && status === "done" && findings && (
                  <div className="mt-2">
                    {contradictions.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-sm text-moss-400">
                        <Check size={13} />
                        No contradictions surfaced &mdash; hypothesis holds.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="font-mono text-xs uppercase tracking-[0.08em] text-rust-400">
                          {contradictions.length} contradiction{contradictions.length !== 1 ? "s" : ""} found
                        </p>
                        {contradictions.slice(0, 3).map((f) => (
                          <p key={f.id} className="border-l-2 border-rust-400/40 pl-3 text-sm text-bone-300">
                            {f.title}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 font-mono text-xs text-bone-600">
                      {findings.total_findings} total finding{findings.total_findings !== 1 ? "s" : ""} reviewed
                    </p>
                  </div>
                )}

                {step.id === "report" && status === "done" && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-bone-400">
                      Dossier assembled from {deepScan?.files_analyzed ?? summary?.total_files ?? 0} files,{" "}
                      {findings?.total_findings ?? 0} findings, {contradictions.length} contradiction
                      {contradictions.length !== 1 ? "s" : ""}.
                    </p>
                    <a
                      href={`${API_BASE}/api/report/${sessionId}?format=pdf`}
                      download
                      className="inline-flex shrink-0 items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
                    >
                      <Download size={12} />
                      Download report
                    </a>
                  </div>
                )}

                {status === "error" && errors[step.id] && (
                  <p className="mt-2 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
                    {errors[step.id]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasError && (
        <p className="text-sm text-bone-500">
          The investigation stalled on the step above. Fix the underlying endpoint and re-run.
        </p>
      )}

      {allDone && !hasError && (
        <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-moss-400">
          <Check size={13} />
          Investigation complete
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-white/10 bg-soil-800/60 px-2.5 py-2">
      <p className="text-sm font-semibold text-bone-100">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-bone-600">{label}</p>
    </div>
  );
}
