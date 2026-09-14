"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

function GateInner() {
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const hadError = searchParams.get("error") === "1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    document.cookie = `site_auth=${encodeURIComponent(password)}; path=/; max-age=${60 * 60 * 24 * 7}`;
    const next = searchParams.get("next") || "/";
    window.location.href = next;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-soil-950 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border border-white/10 bg-soil-900/40 p-6"
      >
        <div className="flex items-center gap-2 text-bone-200">
          <Lock size={16} className="text-brass-400" />
          <h1 className="font-mono text-xs uppercase tracking-[0.15em]">
            Restricted access
          </h1>
        </div>
        <p className="mt-3 text-sm text-bone-500">
          This investigation runs and can execute uploaded code. Enter the
          access password to continue.
        </p>
        {hadError && (
          <p className="mt-3 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
            Incorrect password.
          </p>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="Password"
          className="mt-4 w-full border border-white/15 bg-soil-950 px-3 py-2 text-sm text-bone-200 placeholder:text-bone-700 focus:border-brass-400 focus:outline-none"
        />
        <button
          type="submit"
          className="mt-3 w-full border border-brass-500/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-bone-100 transition-colors hover:border-brass-400 hover:bg-brass-500/10"
        >
          Enter
        </button>
      </form>
    </main>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <GateInner />
    </Suspense>
  );
}
