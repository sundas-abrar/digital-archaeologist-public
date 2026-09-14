import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <Compass size={32} className="text-brass-400" />
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">404</p>
      <h1 className="mt-1 text-2xl font-bold uppercase tracking-tight text-bone-100">
        Nothing excavated here
      </h1>
      <p className="mt-3 max-w-md text-bone-400">
        This trench came up empty &mdash; the page you&apos;re looking for
        doesn&apos;t exist, or has been reburied.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 border border-white/15 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
      >
        <Home size={14} />
        Back to site
      </Link>
    </main>
  );
}
