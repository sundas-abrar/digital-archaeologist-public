import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
        <span className="h-px w-6 bg-brass-400" />
        Dig site
      </p>
      <h1 className="text-4xl font-bold uppercase tracking-tight text-bone-100">Dashboard</h1>
      <div className="mt-10 flex items-center gap-3 text-bone-400">
        <Loader2 size={16} className="animate-spin text-brass-400" />
        <span className="font-mono text-sm">Setting up the excavation&hellip;</span>
      </div>
    </main>
  );
}
