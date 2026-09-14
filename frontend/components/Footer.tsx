import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-soil-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 font-mono text-xs uppercase tracking-[0.1em] text-bone-600 sm:flex-row">
        <span>Digital Archaeologist &middot; dig site established 2026</span>
        <Link
          href="/status"
          className="text-bone-600 transition-colors hover:text-brass-400"
        >
          System status &rarr;
        </Link>
      </div>
    </footer>
  );
}
