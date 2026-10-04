"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

type Kind = "readme" | "plan" | "story" | "tests" | "diagram";
const KINDS: { id: Kind; label: string }[] = [
  { id: "readme", label: "README" },
  { id: "plan", label: "Resurrection plan" },
  { id: "story", label: "Story (3 tones)" },
  { id: "tests", label: "Tests for untested code" },
  { id: "diagram", label: "Diagram" },
];

type Result = {
  kind: Kind;
  ai_written: boolean;
  notice?: string;
  content?: string;
  mermaid?: string;
  tones?: { technical: string; plain: string; blurb: string };
  untested?: { file: string; name: string }[];
  note?: string;
  usage?: { total_tokens: number };
  seconds?: number;
  error?: string;
};

declare global {
  interface Window {
    mermaid?: {
      initialize: (c: object) => void;
      render: (id: string, src: string) => Promise<{ svg: string }>;
    };
  }
}

function loadMermaid(): Promise<void> {
  if (window.mermaid) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    s.onload = () => {
      window.mermaid?.initialize({ startOnLoad: false, theme: "dark" });
      resolve();
    };
    s.onerror = () => reject(new Error("Could not load the diagram library."));
    document.head.appendChild(s);
  });
}

/** Renders Mermaid source as an SVG inside the page (falls back to source). */
function MermaidDiagram({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadMermaid()
      .then(() => window.mermaid!.render(`m${Date.now()}`, source))
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [source]);
  if (failed) return <pre className="overflow-x-auto text-xs text-bone-400">{source}</pre>;
  return <div ref={ref} className="overflow-x-auto" />;
}

export default function GeneratePanel({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");

  async function run(kind: Kind) {
    setBusy(kind);
    setErr("");
    setRes(null);
    try {
      const r = await fetch(`${API_BASE}/api/generate/${sessionId}/${kind}`);
      if (!r.ok) throw new Error(String(r.status));
      setRes(await r.json());
    } catch {
      setErr("Couldn't generate that. Is the backend running?");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            disabled={busy !== null}
            onClick={() => run(k.id)}
            className="min-h-[44px] border border-brass-500/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bone-100 hover:bg-brass-500/10 disabled:opacity-40"
          >
            {busy === k.id ? "Working..." : k.label}
          </button>
        ))}
      </div>
      {err && <p className="text-sm text-rust-400">{err}</p>}
      {res?.error && <p className="text-sm text-rust-400">{res.error}</p>}
      {res && !res.error && (
        <div className="space-y-3 border border-white/10 p-4">
          {res.ai_written && res.notice && (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-brass-400">
              AI-written &middot; {res.notice}
            </p>
          )}
          {res.mermaid && <MermaidDiagram source={res.mermaid} />}
          {res.content && (
            <pre className="whitespace-pre-wrap break-words text-sm text-bone-300">{res.content}</pre>
          )}
          {res.tones &&
            (["technical", "plain", "blurb"] as const).map((t) => (
              <div key={t}>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-600">{t}</p>
                <p className="text-sm text-bone-300">{res.tones![t]}</p>
              </div>
            ))}
          {res.note && <p className="text-xs text-bone-600">{res.note}</p>}
          {res.usage && (
            <p className="font-mono text-[11px] text-bone-600">
              {res.seconds}s &middot; {res.usage.total_tokens} tokens
            </p>
          )}
        </div>
      )}
    </div>
  );
}
