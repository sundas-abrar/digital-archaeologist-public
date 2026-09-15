"use client";

import { useEffect, useState } from "react";
import {
  FlaskConical,
  Loader2,
  Play,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  detectTestCommands,
  runQACommand,
  proposeQAFix,
  applyQAFix,
  type QASuggestion,
  type QARunResult,
  type QAFailure,
  type QAFixProposal,
} from "@/lib/api";

type RunStatus = "idle" | "running" | "done" | "error";
type FixStatus = "idle" | "proposing" | "proposed" | "applying" | "verifying" | "error";

function OutputBlock({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(true);
  if (!text.trim()) return null;
  return (
    <div className="border border-white/10 bg-soil-950">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600 hover:text-bone-300"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-white/10 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-bone-400">
          {text}
        </pre>
      )}
    </div>
  );
}

export default function QAPanel({ sessionId }: { sessionId: string }) {
  const [suggestions, setSuggestions] = useState<QASuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [command, setCommand] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runResult, setRunResult] = useState<QARunResult | null>(null);
  const [runError, setRunError] = useState("");

  const [fixStatus, setFixStatus] = useState<FixStatus>("idle");
  const [proposal, setProposal] = useState<QAFixProposal | null>(null);
  const [editedFix, setEditedFix] = useState("");
  const [fixError, setFixError] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectTestCommands(sessionId).then((res) => {
      if (cancelled) return;
      if (!("error" in res)) {
        setSuggestions(res.suggestions);
        if (res.suggestions.length > 0) setCommand(res.suggestions[0].command);
      }
      setLoadingSuggestions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const activeCommand = useCustom ? customCommand : command;

  async function execute() {
    if (!activeCommand.trim()) return;
    setRunStatus("running");
    setRunError("");
    setProposal(null);
    setFixStatus("idle");
    setApplied(false);

    const res = await runQACommand(sessionId, activeCommand);
    if ("error" in res) {
      setRunError(res.error);
      setRunStatus("error");
      return;
    }
    setRunResult(res);
    setRunStatus("done");
  }

  async function requestFix() {
    if (!runResult?.failure) return;
    setFixStatus("proposing");
    setFixError("");
    const res = await proposeQAFix(sessionId, runResult.failure);
    if ("error" in res) {
      setFixError(res.error ?? "Something went wrong proposing a fix.");
      setFixStatus("error");
      return;
    }
    if (!res.available) {
      setFixError(res.error || "No fix could be proposed.");
      setFixStatus("error");
      return;
    }
    setProposal(res);
    setEditedFix(res.proposed_file_content ?? "");
    setFixStatus("proposed");
  }

  async function applyAndRetest() {
    if (!proposal?.file) return;
    setFixStatus("applying");
    const applyRes = await applyQAFix(sessionId, proposal.file, editedFix);
    if ("error" in applyRes) {
      setFixError(applyRes.error);
      setFixStatus("error");
      return;
    }
    setApplied(true);
    setFixStatus("verifying");

    const rerun = await runQACommand(sessionId, activeCommand);
    if (!("error" in rerun)) {
      setRunResult(rerun);
      setRunStatus("done");
    }
    setFixStatus("idle");
    setProposal(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border border-brass-500/30 bg-brass-500/5 px-4 py-3">
        <ShieldAlert size={15} className="shrink-0 text-brass-400" />
        <p className="text-xs text-bone-400">
          This runs code from the uploaded project on your own machine.
          Only run commands here for archives you trust.
        </p>
      </div>

      <div className="border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <FlaskConical size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">
            Execute &middot; Test
          </h3>
        </div>

        {loadingSuggestions ? (
          <div className="mt-4 flex items-center gap-2 text-bone-500">
            <Loader2 size={14} className="animate-spin text-brass-400" />
            <span className="font-mono text-xs">Detecting test setup&hellip;</span>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {suggestions.length > 0 && !useCustom && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.command}
                    onClick={() => setCommand(s.command)}
                    className={`border px-3 py-1.5 font-mono text-xs transition-colors ${
                      command === s.command
                        ? "border-brass-400 text-brass-400"
                        : "border-white/15 text-bone-400 hover:border-brass-500/60 hover:text-bone-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {suggestions.length === 0 && !useCustom && (
              <p className="text-sm text-bone-500">
                No recognizable test setup detected. Enter a command manually.
              </p>
            )}

            <button
              onClick={() => setUseCustom((v) => !v)}
              className="font-mono text-[11px] uppercase tracking-[0.06em] text-bone-600 hover:text-brass-400"
            >
              {useCustom ? "Use suggested command" : "Enter a custom command"}
            </button>

            {useCustom && (
              <input
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="e.g. python -m pytest -q"
                className="w-full border border-white/15 bg-soil-950 px-3 py-2 font-mono text-sm text-bone-200 placeholder:text-bone-700 focus:border-brass-400 focus:outline-none"
              />
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={execute}
                disabled={!activeCommand.trim() || runStatus === "running"}
                className="inline-flex items-center gap-2 border border-brass-500/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bone-100 transition-colors hover:border-brass-400 hover:bg-brass-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {runStatus === "running" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Play size={13} />
                )}
                {runStatus === "running" ? "Running\u2026" : "Run"}
              </button>
              {activeCommand && (
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-bone-600">
                  {activeCommand}
                </code>
              )}
            </div>
          </div>
        )}

        {runError && (
          <p className="mt-4 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
            {runError}
          </p>
        )}

        {runResult && (
          <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              {runResult.result.passed ? (
                <>
                  <span className="border border-moss-400/40 p-1 text-moss-400">
                    <Check size={13} />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.08em] text-moss-400">
                    Verified &middot; tests passed
                  </span>
                </>
              ) : (
                <>
                  <span className="border border-rust-400/40 p-1 text-rust-400">
                    <X size={13} />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.08em] text-rust-400">
                    {runResult.result.timed_out ? "Timed out" : "Test failed"}
                  </span>
                </>
              )}
              {applied && runResult.result.passed && (
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-bone-600">
                  after applying fix
                </span>
              )}
            </div>

            <OutputBlock label="stdout" text={runResult.result.stdout} />
            <OutputBlock label="stderr" text={runResult.result.stderr} />

            {runResult.failure && (
              <div className="border border-rust-400/30 bg-rust-400/5 p-4">
                <div className="flex items-center gap-2 text-bone-200">
                  <AlertTriangle size={14} className="text-rust-400" />
                  <h4 className="font-mono text-xs uppercase tracking-[0.08em]">
                    Failure analysis
                  </h4>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                  <dt className="text-bone-600">type</dt>
                  <dd className="text-bone-200">
                    {runResult.failure.error_type ?? "unknown"}
                  </dd>
                  <dt className="text-bone-600">message</dt>
                  <dd className="text-bone-200">
                    {runResult.failure.error_message ?? "\u2014"}
                  </dd>
                  <dt className="text-bone-600">location</dt>
                  <dd className="text-bone-200">
                    {runResult.failure.file
                      ? `${runResult.failure.file}:${runResult.failure.line ?? "?"}`
                      : "not identified"}
                  </dd>
                </dl>

                {fixStatus === "idle" && (
                  <button
                    onClick={requestFix}
                    className="mt-3 inline-flex items-center gap-2 border border-brass-500/60 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-100 transition-colors hover:border-brass-400 hover:bg-brass-500/10"
                  >
                    <Sparkles size={13} />
                    Propose fix
                  </button>
                )}

                {fixStatus === "proposing" && (
                  <span className="mt-3 flex items-center gap-2 font-mono text-xs text-bone-500">
                    <Loader2 size={13} className="animate-spin text-brass-400" />
                    Analyzing error&hellip;
                  </span>
                )}

                {fixStatus === "error" && (
                  <div className="mt-3">
                    <p className="border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
                      {fixError}
                    </p>
                    <button
                      onClick={requestFix}
                      className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-bone-500 hover:text-brass-400"
                    >
                      <RefreshCw size={12} />
                      Retry
                    </button>
                  </div>
                )}

                {(fixStatus === "proposed" ||
                  fixStatus === "applying" ||
                  fixStatus === "verifying") &&
                  proposal && (
                    <div className="mt-4 border border-white/10 bg-soil-950 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
                        Proposed fix &middot; {proposal.file} &middot;{" "}
                        {proposal.confidence} confidence
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-bone-300">
                        {proposal.explanation}
                      </p>

                      {proposal.proposed_file_content != null ? (
                        <>
                          <textarea
                            value={editedFix}
                            onChange={(e) => setEditedFix(e.target.value)}
                            rows={10}
                            className="mt-3 w-full border border-white/15 bg-soil-900 px-3 py-2 font-mono text-xs text-bone-200 focus:border-brass-400 focus:outline-none"
                          />
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={applyAndRetest}
                              disabled={fixStatus === "applying" || fixStatus === "verifying"}
                              className="inline-flex items-center gap-2 border border-moss-400/50 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-moss-400 transition-colors hover:bg-moss-400/10 disabled:opacity-50"
                            >
                              {fixStatus === "applying" && (
                                <Loader2 size={12} className="animate-spin" />
                              )}
                              {fixStatus === "verifying" && (
                                <Loader2 size={12} className="animate-spin" />
                              )}
                              {fixStatus === "applying"
                                ? "Applying\u2026"
                                : fixStatus === "verifying"
                                  ? "Re-testing\u2026"
                                  : "Apply fix & re-test"}
                            </button>
                            <button
                              onClick={() => {
                                setProposal(null);
                                setFixStatus("idle");
                              }}
                              disabled={fixStatus !== "proposed"}
                              className="font-mono text-xs text-bone-600 hover:text-bone-300 disabled:opacity-40"
                            >
                              Discard
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 font-mono text-xs text-bone-600">
                          No file changes proposed &mdash; see explanation above.
                        </p>
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
