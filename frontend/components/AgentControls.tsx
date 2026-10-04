"use client";

import { useEffect, useState } from "react";
import { Brain, Check, Loader2, MinusCircle, Trash2, X } from "lucide-react";
import { API_BASE } from "@/lib/api";

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
  { value: "off", title: "Off", hint: "Every run starts from a blank slate. Nothing is saved." },
  { value: "half", title: "Half", hint: "Uses the last 3 goals and questions saved for this project." },
  { value: "full", title: "Full", hint: "Uses the last 10. Most context, most tokens." },
];


/* ------------------------------------------------------------------ */
/* Settings kept in this browser (memory itself lives on the server)   */
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
/* Memory panel: reads what the SERVER saved for this project          */
/* ------------------------------------------------------------------ */

type MemoryItem = { id: number; kind: "goal" | "question"; text: string };

export function MemoryPanel({
  sessionId,
  mode,
  refreshKey = 0,
}: {
  sessionId: string;
  mode: MemoryMode;
  /** Change this to make the panel re-read the server (e.g. after a run). */
  refreshKey?: number;
}) {
  const [sent, setSent] = useState<MemoryItem[]>([]);
  const [stored, setStored] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/memory/${sessionId}?mode=${mode}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((d) => {
        if (cancelled) return;
        setSent(d.sent ?? []);
        setStored(d.stored ?? 0);
        setError("");
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load memory from the server.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, mode, refreshKey]);

  async function forget() {
    if (!window.confirm("Forget everything the agent remembers about this project?")) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/memory/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setSent([]);
      setStored(0);
      setError("");
    } catch {
      setError("Couldn't clear memory. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-white/10 bg-soil-900/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-bone-200">
          <Brain size={16} className="text-brass-400" />
          <h4 className="font-mono text-xs uppercase tracking-[0.1em]">Agent memory</h4>
        </div>
        <span className="border border-brass-500/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-brass-400">
          {mode} &middot; {sent.length} used &middot; {stored} saved
        </span>
      </div>

      {error && (
        <p className="mt-3 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
          {error}
        </p>
      )}

      {!error && !loaded ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-500">
          Loading memory&hellip;
        </p>
      ) : sent.length === 0 ? (
        <p className="mt-3 text-sm text-bone-500">
          {mode === "off"
            ? "Memory is off: nothing is read or saved."
            : stored > 0
              ? "Nothing to use yet in this mode."
              : "Nothing saved yet. Run the agent or ask a question first."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sent.map((m) => (
            <li key={m.id} className="border-l-2 border-brass-500/40 pl-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-600">
                {m.kind}
              </p>
              <p className="break-words text-sm text-bone-300">{m.text}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-bone-600">
        Saved on the server for this project. Open the same dashboard link on another device to
        see it there.
      </p>

      {stored > 0 && (
        <button
          type="button"
          onClick={forget}
          disabled={busy}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 border border-white/15 px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-500 transition-colors hover:border-rust-400 hover:text-rust-400 disabled:opacity-50"
        >
          <Trash2 size={13} />
          Forget all
        </button>
      )}
    </div>
  );
}
