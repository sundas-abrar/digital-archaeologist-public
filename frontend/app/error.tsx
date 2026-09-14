"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <AlertTriangle size={32} className="text-rust-400" />
      <h1 className="mt-4 text-2xl font-bold uppercase tracking-tight text-bone-100">
        The dig site collapsed
      </h1>
      <p className="mt-3 max-w-md text-bone-400">
        Something went wrong while excavating this page. It&apos;s been
        logged &mdash; try again, or head back to solid ground.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-brass-400 px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.1em] text-soil-950 transition-colors hover:bg-brass-500"
        >
          <RefreshCw size={14} />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-white/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <Home size={14} />
          Home
        </Link>
      </div>
    </main>
  );
}
