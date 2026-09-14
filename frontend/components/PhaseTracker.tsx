"use client";

export type Phase = {
  title: string;
  description: string;
  state: "active" | "done" | "pending";
};

export default function PhaseTracker({ phases }: { phases: Phase[] }) {
  return (
    <div className="grid grid-cols-2 divide-y divide-white/10 border border-white/10 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
      {phases.map((phase, i) => (
        <div key={phase.title} className="px-5 py-5">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em]">
            <span className="text-bone-600">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={
                phase.state === "active"
                  ? "text-brass-400"
                  : phase.state === "done"
                  ? "text-moss-400"
                  : "text-bone-600"
              }
            >
              {phase.state}
            </span>
          </div>
          <h3 className="mt-2 font-serif text-sm font-semibold uppercase tracking-wide text-bone-100">
            {phase.title}
          </h3>
          <p className="mt-1 text-xs text-bone-400">{phase.description}</p>
        </div>
      ))}
    </div>
  );
}
