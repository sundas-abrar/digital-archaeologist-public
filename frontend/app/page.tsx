import Link from "next/link";
import {
  Compass,
  Search,
  Clock,
  Code2,
  FlaskConical,
  FileDown,
  ArrowRight,
  Bot,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import EvidenceGraph from "@/components/EvidenceGraph";

const PHASES = [
  {
    depth: "0.4m",
    title: "Hand over the site",
    body: "Drop in a ZIP, or a batch of loose files \u2014 code, PDFs, docs, screenshots, notes. Whatever survived.",
  },
  {
    depth: "1.2m",
    title: "Extract the evidence",
    body: "File tree, timestamps, commit history, functions, imports, TODOs \u2014 every trace gets catalogued.",
  },
  {
    depth: "2.1m",
    title: "Investigate like an agent",
    body: "Plan \u2192 gather evidence \u2192 analyze \u2192 detect contradictions \u2192 report. Each step runs and shows its work.",
  },
  {
    depth: "3.0m",
    title: "Reconstruct and verify",
    body: "A timeline, code evolution, AI-backed findings you can trace to exact files \u2014 plus QA tests and a downloadable report.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="max-w-4xl">
          <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
            <span className="h-px w-6 bg-brass-400" />
            Site log &middot; agentic investigation, evidence-first
          </p>
          <h1 className="max-w-2xl text-5xl font-bold uppercase leading-[1.05] tracking-tight text-bone-100 sm:text-6xl">
            Every old project <br />
            <span className="text-brass-400">is a dig site.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone-400">
            Hand it a folder nobody's opened in years. An agent plans the
            dig, gathers evidence, tests what still runs, and reconstructs
            the timeline &mdash; showing its evidence for every claim it makes.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/upload"
              className="group inline-flex items-center gap-2 bg-brass-400 px-5 py-3 font-mono text-xs font-medium uppercase tracking-[0.1em] text-soil-950 transition-all hover:bg-brass-500 hover:pl-6"
            >
              Start an excavation
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 border border-white/15 px-5 py-3 font-mono text-xs uppercase tracking-[0.1em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
            >
              How it works
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        <Reveal delay={150} className="hidden lg:block">
          <EvidenceGraph />
        </Reveal>
      </section>

      {/* Stratigraphy scroll section */}
      <section className="border-t border-white/10 bg-soil-950">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <Reveal>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.15em] text-bone-600">
              &darr; Scroll down through the layers
            </h2>
          </Reveal>

          <div className="relative mt-10 border-l border-white/10 pl-8">
            {PHASES.map((phase, i) => (
              <Reveal key={phase.title} delay={i * 80}>
                <div className="group relative mb-14 last:mb-0">
                  <span className="absolute -left-[38px] top-1 h-2.5 w-2.5 rounded-full border-2 border-brass-400 bg-soil-950 transition-all group-hover:bg-brass-400" />
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-bone-600">
                    Depth <span className="text-brass-400">{phase.depth}</span>
                  </span>
                  <h3 className="mt-1 text-2xl font-bold uppercase tracking-tight text-bone-100">
                    {phase.title}
                  </h3>
                  <p className="mt-2 max-w-lg leading-relaxed text-bone-400">
                    {phase.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Reveal>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
              / 02
            </p>
            <h2 className="text-3xl font-bold uppercase tracking-tight text-bone-100">
              What comes out of the ground
            </h2>
          </Reveal>

          <div className="mt-10 grid divide-y divide-white/10 border border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              {
                icon: Compass,
                title: "Investigation",
                body: "A live agentic pipeline \u2014 plan, gather, analyze, detect contradictions, report \u2014 not a single black-box pass.",
              },
              {
                icon: Search,
                title: "Findings",
                body: "Anomalies, repeats, and contradictions, each backed by named evidence. Rate or correct any of them.",
              },
              {
                icon: Clock,
                title: "Timeline",
                body: "Every revision, in order \u2014 including the ones with misleading filenames.",
              },
            ].map((card) => (
              <Reveal key={card.title}>
                <div className="h-full p-6 transition-colors hover:bg-soil-900/60">
                  <card.icon size={20} className="text-brass-400" />
                  <h3 className="mt-3 font-semibold uppercase tracking-wide text-bone-100">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-bone-400">
                    {card.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-6 grid divide-y divide-white/10 border border-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {[
              {
                icon: Code2,
                title: "Code evolution",
                body: "How the idea moved from draft to prototype to whatever shipped.",
              },
              {
                icon: FlaskConical,
                title: "Testing / QA",
                body: "Detects and runs the project's own tests, then proposes fixes when something fails.",
              },
              {
                icon: Bot,
                title: "Agent Mode",
                body: "Give it your own goal and watch the full investigation run live, step by step, instead of a single black-box pass.",
              },
              {
                icon: FileDown,
                title: "Take it with you",
                body: "Download the whole investigation \u2014 summary, story, and findings \u2014 as a PDF.",
              },
            ].map((card) => (
              <Reveal key={card.title}>
                <div className="h-full p-6 transition-colors hover:bg-soil-900/60">
                  <card.icon size={20} className="text-brass-400" />
                  <h3 className="mt-3 font-semibold uppercase tracking-wide text-bone-100">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-bone-400">
                    {card.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 bg-soil-950">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold uppercase tracking-tight text-bone-100">
              Bring your oldest folder.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-bone-400">
              The messier and more abandoned, the better the dig.
            </p>
            <Link
              href="/upload"
              className="group mt-7 inline-flex items-center gap-2 bg-brass-400 px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.1em] text-soil-950 transition-all hover:bg-brass-500 hover:pl-7"
            >
              Start an excavation
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
