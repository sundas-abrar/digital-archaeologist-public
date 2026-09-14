import { Layers, Compass, Search, FlaskConical, FileDown, MessageSquare, Bot } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
        <span className="h-px w-6 bg-brass-400" />
        Field notes
      </p>
      <h1 className="text-4xl font-bold uppercase tracking-tight text-bone-100">
        How the dig works
      </h1>
      <p className="mt-5 leading-relaxed text-bone-400">
        Most tools that "summarize a folder" describe each file in isolation.
        Digital Archaeologist tries to do what an actual archaeologist does:
        treat the files as evidence, investigate like an agent, and
        reconstruct what happened between them &mdash; showing its work at every
        step.
      </p>

      <div className="mt-12 divide-y divide-white/10 border-t border-white/10">
        <div className="flex gap-4 py-8">
          <Layers size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              01 &middot; Extraction, not reading
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              File names, timestamps, sizes, functions, imports, TODO
              comments, and git history (when present) are pulled out as
              structured evidence &mdash; not fed wholesale to a model. Upload a
              ZIP or a batch of loose files; both are handled the same way.
            </p>
          </div>
        </div>

        <div className="flex gap-4 py-8">
          <Compass size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              02 &middot; Investigate like an agent
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              Instead of one black-box pass, the agent works in visible
              steps: plan &rarr; gather evidence &rarr; analyze &rarr; detect
              contradictions &rarr; report. You can watch each step run and
              see exactly what it found.
            </p>
          </div>
        </div>

        <div className="flex gap-4 py-8">
          <Bot size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              03 &middot; Agent Mode
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              Give the agent your own goal instead of the default dig, and
              watch the full pipeline &mdash; plan &rarr; scan &rarr; extract
              evidence &rarr; find relationships &rarr; test &rarr; interpret
              &rarr; report &mdash; stream live, one step at a time, so you
              see it think instead of waiting on a single black-box answer.
            </p>
          </div>
        </div>

        <div className="flex gap-4 py-8">
          <Search size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              04 &middot; Findings, not a file list
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              Timeline anomalies, revised-and-forgotten files, contradictions
              between documents &mdash; the things you'd only notice if you
              read everything at once. Only this structured evidence goes to
              the AI interpretation step, so every finding traces back to
              specific files and timestamps, not a guess.
            </p>
          </div>
        </div>

        <div className="flex gap-4 py-8">
          <FlaskConical size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              05 &middot; Test what still runs
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              A dedicated Testing / QA pass detects the project's own test
              commands, runs them, and &mdash; when something fails &mdash; proposes a
              fix for you to review before it's applied.
            </p>
          </div>
        </div>

        <div className="flex gap-4 py-8">
          <FileDown size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              06 &middot; Take it with you
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              The full investigation &mdash; site summary, reconstructed story,
              and every finding with its evidence &mdash; downloads as a single
              PDF report.
            </p>
          </div>
        </div>

        <div className="flex gap-4 py-8">
          <MessageSquare size={20} className="mt-1 shrink-0 text-brass-400" />
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-bone-100">
              07 &middot; Help it improve
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-400">
              Rate any finding, flag one as incorrect, or leave general
              feedback from the dashboard's "Help Us Improve" tab. Every
              report is a record a human can review and build on.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
