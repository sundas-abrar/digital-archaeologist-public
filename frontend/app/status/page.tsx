"use client";

import { useEffect, useState } from "react";
import { checkHealth, API_BASE, type HealthStatus } from "@/lib/api";

type Phase = "checking" | "connected" | "disconnected";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState<string>("");
  const [lastChecked, setLastChecked] = useState<string>("");
  const [misses, setMisses] = useState(0);

  async function runCheck() {
    setPhase("checking");
    const result: HealthStatus = await checkHealth();
    setPhase(result.ok ? "connected" : "disconnected");
    setMisses((n) => (result.ok ? 0 : n + 1));
    setDetail(result.ok ? `status: ${result.status}` : result.message ?? "");
    setLastChecked(new Date().toLocaleTimeString());
  }

  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, 8000);
    return () => clearInterval(interval);
  }, []);

  const indicator = {
    checking: { color: "bg-brass-400", label: "Probing site\u2026" },
    connected: { color: "bg-moss-400", label: "Signal confirmed" },
    disconnected: { color: "bg-rust-400", label: "No signal" },
  }[phase];

  return (
    <main className="mx-auto flex max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-14">
        <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
          <span className="h-px w-6 bg-brass-400" />
          Site log &middot; excavation not yet begun
        </p>
        <h1 className="text-4xl font-bold uppercase leading-tight tracking-tight text-bone-100 sm:text-5xl">
          Digital Archaeologist
        </h1>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-bone-400">
          Hand it an old project, and it reconstructs the dig: the timeline,
          the false starts, the buried decisions. Right now it's just
          checking whether the ground beneath it is solid.
        </p>
      </header>

      <section className="border border-white/10 bg-soil-900/60 p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${indicator.color} opacity-40`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${indicator.color}`}
              />
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.08em] text-bone-200">
              {indicator.label}
            </span>
          </div>
          <button
            onClick={runCheck}
            className="border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-brass-400 hover:text-brass-400"
          >
            Re-probe
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 font-mono text-sm">
          <dt className="text-bone-600">Frontend</dt>
          <dd className="min-w-0 break-words text-bone-200">Next.js &middot; running</dd>

          <dt className="text-bone-600">Backend target</dt>
          <dd className="min-w-0 break-words text-bone-200">{API_BASE}/api/health</dd>

          <dt className="text-bone-600">Last probe</dt>
          <dd className="min-w-0 break-words text-bone-200">{lastChecked || "\u2014"}</dd>

          <dt className="text-bone-600">Detail</dt>
          <dd
            className={`min-w-0 break-words ${
              phase === "disconnected" ? "text-rust-400" : "text-bone-200"
            }`}
          >
            {detail || "\u2014"}
          </dd>
        </dl>

        {phase === "disconnected" && (
          <p className="mt-5 border border-white/10 bg-soil-800 px-4 py-3 text-sm text-bone-400">
            {misses <= 6
              ? "The backend may be waking up. Free hosting on Render sleeps when idle, so the first request can take up to a minute. This page keeps retrying automatically."
              : "Still no response. Check that the FastAPI service is running and that NEXT_PUBLIC_API_URL points at it."}
          </p>
        )}
      </section>

      <footer className="mt-10 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-bone-600">
        <span>Phase 1 &middot; Skeleton</span>
        <span className="h-px flex-1 bg-white/10" />
        <span>Next.js &rarr; FastAPI &rarr; /api/health</span>
      </footer>
    </main>
  );
}
