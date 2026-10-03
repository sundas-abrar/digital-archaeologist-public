"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { API_BASE } from "@/lib/api";
import {
  MEMORY_OPTIONS,
  MemoryPanel,
  Segmented,
  memoryForRequest,
  pushHistory,
  useMemoryMode,
} from "@/components/AgentControls";

type Msg = { role: "user" | "agent"; text: string; sources?: string[] };

const SUGGESTIONS = [
  "How did this project evolve?",
  "Which files changed the most?",
  "What do the docs get wrong about the code?",
];

export default function AskPanel({ sessionId }: { sessionId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memory, setMemory] = useMemoryMode();

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;

    const history = memoryForRequest(sessionId, memory);
    pushHistory(sessionId, question);
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setError("");
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE}/api/ask/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, memory, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 404
            ? "The /api/ask endpoint isn't available on the backend yet."
            : data.detail || "The backend couldn't answer that.",
        );
        return;
      }
      setMsgs((m) => [
        ...m,
        { role: "agent", text: data.answer ?? "No answer returned.", sources: data.sources },
      ]);
    } catch {
      setError("Can't reach the backend. Is FastAPI running (or still waking up)?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="border border-white/10 bg-soil-900/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <MessageCircle size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Ask the dig site</h3>
        </div>
        <p className="mt-2 text-sm text-bone-500">
          Answers are drawn from the extracted evidence only, with the source files cited.
        </p>

        <div className="mt-4">
          <Segmented
            label="Memory"
            value={memory}
            onChange={setMemory}
            options={MEMORY_OPTIONS}
            disabled={busy}
          />
        </div>

        <div className="mt-4 space-y-3">
          {msgs.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="min-h-[44px] border border-white/15 px-3 text-left text-sm text-bone-300 transition-colors hover:border-brass-400 active:border-brass-400"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            msgs.map((m, i) => (
              <div
                key={i}
                className={`min-w-0 border p-3 ${
                  m.role === "user" ? "ml-6 border-brass-500/40" : "mr-6 border-white/10"
                }`}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-600">
                  {m.role === "user" ? "You" : "Archaeologist"}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-bone-200">
                  {m.text}
                </p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.sources.map((src) => (
                      <span
                        key={src}
                        className="break-all border border-brass-500/40 px-2 py-0.5 font-mono text-[11px] text-brass-400"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {busy && (
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-500">
              <Loader2 size={13} className="animate-spin text-brass-400" />
              Reading the evidence&hellip;
            </p>
          )}
          {error && (
            <p className="border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            maxLength={1000}
            placeholder="Ask about this project…"
            className="min-h-[44px] min-w-0 flex-1 border border-white/15 bg-soil-950 px-3 text-sm text-bone-200 placeholder:text-bone-700 focus:border-brass-400 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="flex min-h-[44px] w-11 shrink-0 items-center justify-center border border-brass-500/60 text-brass-400 transition-colors hover:bg-brass-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      <MemoryPanel key={msgs.length} sessionId={sessionId} mode={memory} />
    </div>
  );
}
