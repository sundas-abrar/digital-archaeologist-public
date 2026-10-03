"use client";

import { useEffect, useState } from "react";
import { Brain, Check, Loader2, MinusCircle, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types + options                                                     */
/* ------------------------------------------------------------------ */

export type RunDepth = "half" | "full";
export type MemoryMode = "off" | "half" | "full";

/** Steps a half run skips: no code execution and no AI narrative. */
export const HALF_SKIPS = ["test", "interpret"];

export const DEPTH_OPTIONS: { value: RunDepth; title: string; hint: string }[] = [
  {
    value: "half",
    title: "Half run",
    hint: "Scan and findings only. No code execution, no AI narrative. Fast and safe.",
  },
  {
    value: "full",
    title: "Full run",
    hint: "Every step, including tests and the AI narrative. Slower, uses more tokens.",
  },
];

export const MEMORY_OPTIONS: { value: MemoryMode; title: string; hint: string }[] = [
  { value: "off", title: "Off", hint: "Every run starts from a blank slate." },
  { value: "half", title: "Half", hint: "Remembers your last 3 goals and questions." },
  { value: "full", title: "Full", hint: "Remembers up to the last 10. Most context, most tokens." },
];

const MEMORY_LIMIT: Record<MemoryMode, number> = { off: 0, half: 3, full: 10 };

/* ------------------------------------------------------------------ */
/* Memory: stored in this browser, per session, and sent to the API    */
/* ------------------------------------------------------------------ */

const MODE_KEY = "da:memory-mode";
const DEPTH_KEY = "da:run-depth";

function readLS(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage can be blocked; the setting just won't persist */
  }
}

export function useMemoryMode(): [MemoryMode, (m: MemoryMode) => void] {
  const [mode, setMode] = useState<MemoryMode>("half");
  useEffect(() => {
    const v = readLS(MODE_KEY);
    if (v === "off" || v === "half" || v === "full") setMode(v);
  }, []);
  return [
    mode,
    (m) => {
      setMode(m);
      writeLS(MODE_KEY, m);
    },
  ];
}

export function useRunDepth(): [RunDepth, (d: RunDepth) => void] {
  const [depth, setDepth] = useState<RunDepth>("full");
  useEffect(() => {
    const v = readLS(DEPTH_KEY);
    if (v === "half" || v === "full") setDepth(v);
  }, []);
  return [
    depth,
    (d) => {
      setDepth(d);
      writeLS(DEPTH_KEY, d);
    },
  ];
}

const historyKey = (sessionId: string) => `da:history:${sessionId}`;

export function loadHistory(sessionId: string): string[] {
  const raw = readLS(historyKey(sessionId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushHistory(sessionId: string, entry: string) {
  // 300 chars matches the server's per-item cap and keeps the SSE URL short.
  const next = [...loadHistory(sessionId), entry.trim().slice(0, 300)].slice(-20);
  writeLS(historyKey(sessionId), JSON.stringify(next));
}

/** What the model would actually be sent for the chosen memory mode. */
export function memoryForRequest(sessionId: string, mode: MemoryMode): string[] {
  const limit = MEMORY_LIMIT[mode];
  if (limit === 0) return [];
  return loadHistory(sessionId).slice(-limit);
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; hint: string }[];
  disabled?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-600">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-label={label}
        className={`mt-1.5 grid border border-white/15 ${disabled ? "opacity-50" : ""}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`min-h-[44px] px-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors sm:text-xs ${
                on
                  ? "bg-brass-400 text-soil-950"
                  : "text-bone-500 hover:text-brass-400 active:text-brass-400"
              }`}
            >
              {o.title}
            </button>
          );
        })}
      </div>
      {current && <p className="mt-1.5 text-xs text-bone-500 sm:text-sm">{current.hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Crew lanes: derived from the real agent stream, not a mock          */
/* ------------------------------------------------------------------ */

type CrewEvent = { step: string; status: string };

const CREW = [
  { name: "Surveyor", role: "Maps and hashes the site", steps: ["plan", "scan", "extract"] },
  { name: "Historian", role: "Links people, events, revisions", steps: ["relationships"] },
  { name: "Skeptic", role: "Runs tests, challenges claims", steps: ["test"] },
  { name: "Scribe", role: "Writes the story and report", steps: ["interpret", "report"] },
];

type LaneState = "idle" | "running" | "done" | "failed" | "skipped";

function laneState(steps: string[], log: CrewEvent[], depth: RunDepth, started: boolean): LaneState {
  const mine = log.filter((e) => steps.includes(e.step));
  if (mine.some((e) => e.status === "failed")) return "failed";
  const latest = steps.map((s) => [...mine].reverse().find((e) => e.step === s));
  if (latest.some((e) => e?.status === "running")) return "running";
  if (latest.every((e) => e && (e.status === "done" || e.status === "skipped"))) {
    return latest.every((e) => e?.status === "skipped") ? "skipped" : "done";
  }
  if (started && depth === "half" && steps.every((s) => HALF_SKIPS.includes(s))) return "skipped";
  return "idle";
}

export function CrewLanes({
  log,
  depth,
  started,
}: {
  log: CrewEvent[];
  depth: RunDepth;
  started: boolean;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {CREW.map((agent) => {
        const s = laneState(agent.steps, log, depth, started);
        return (
          <li key={agent.name} className="flex min-w-0 items-start gap-3 border border-white/10 bg-soil-950 p-3">
            <span className="mt-0.5 shrink-0">
              {s === "running" ? (
                <Loader2 size={15} className="animate-spin text-brass-400" />
              ) : s === "done" ? (
                <Check size={15} className="text-moss-400" />
              ) : s === "failed" ? (
                <X size={15} className="text-rust-400" />
              ) : s === "skipped" ? (
                <MinusCircle size={15} className="text-bone-600" />
              ) : (
                <span className="block h-2 w-2 translate-x-1 translate-y-1 rotate-45 bg-white/20" />
              )}
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-200">
                {agent.name}
                {s === "skipped" && <span className="ml-2 text-bone-600">skipped</span>}
              </p>
              <p className="text-xs text-bone-500 sm:text-sm">{agent.role}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Memory panel                                                        */
/* ------------------------------------------------------------------ */

export function MemoryPanel({ sessionId, mode }: { sessionId: string; mode: MemoryMode }) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    setItems(memoryForRequest(sessionId, mode));
  }, [sessionId, mode]);

  return (
    <div className="border border-white/10 bg-soil-900/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-bone-200">
          <Brain size={16} className="text-brass-400" />
          <h4 className="font-mono text-xs uppercase tracking-[0.1em]">Agent memory</h4>
        </div>
        <span className="border border-brass-500/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-brass-400">
          {mode} &middot; {items.length} sent
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-bone-500">
          {mode === "off"
            ? "Memory is off. The agent won't recall earlier goals or questions."
            : "Nothing remembered yet. Run the agent or ask a question first."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((m, i) => (
            <li key={i} className="border-l-2 border-brass-500/40 pl-3 text-sm text-bone-300">
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
