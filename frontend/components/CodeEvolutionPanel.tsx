"use client";

import { useEffect, useMemo, useState } from "react";
import { Code2, Loader2, RefreshCw, FileCode, ListTodo } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { scanSession, type DeepScanResult } from "@/lib/api";

type Status = "idle" | "loading" | "done" | "error";

const PALETTE = ["#C08A4E", "#BE5A45", "#7C9473", "#8A8A85", "#A8743D", "#5F7A57"];

function shortPath(path: string, max = 26) {
  if (path.length <= max) return path;
  return "\u2026" + path.slice(path.length - max + 1);
}

export default function CodeEvolutionPanel({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState<DeepScanResult | null>(null);

  async function run() {
    setStatus("loading");
    setError("");
    const res = await scanSession(sessionId);
    if ("error" in res) {
      setError(res.error);
      setStatus("error");
      return;
    }
    setData(res);
    setStatus("done");
  }

  useEffect(() => {
    if (sessionId) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const hotspots = useMemo(() => {
    if (!data) return [];
    return data.files
      .map((f) => ({
        path: f.path,
        short: shortPath(f.path),
        functions: f.functions?.length ?? 0,
        classes: f.classes?.length ?? 0,
        total: (f.functions?.length ?? 0) + (f.classes?.length ?? 0),
      }))
      .filter((f) => f.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [data]);

  const byExtension = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const f of data.files) {
      const count = (f.functions?.length ?? 0) + (f.classes?.length ?? 0);
      if (count === 0) continue;
      map.set(f.extension || "(none)", (map.get(f.extension || "(none)") ?? 0) + count);
    }
    return Array.from(map.entries())
      .map(([extension, value]) => ({ extension, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex items-center gap-3 border border-white/10 bg-soil-900/40 p-5 text-bone-400">
        <Loader2 size={16} className="animate-spin text-brass-400" />
        <span className="font-mono text-sm">Sifting through the code layer&hellip;</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-white/10 bg-soil-900/40 p-5">
        <div className="flex items-center gap-2 text-bone-200">
          <Code2 size={16} className="text-brass-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.1em]">Phase 6 &middot; Code evolution</h3>
        </div>
        <p className="mt-2 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
          {error}
        </p>
        <button
          onClick={run}
          className="mt-4 inline-flex items-center gap-2 border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  if (hotspots.length === 0) {
    return (
      <div className="border border-dashed border-white/15 bg-soil-900/30 px-6 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-bone-600">No code structure detected</p>
        <p className="mt-2 text-sm text-bone-400">
          No functions or classes were extracted from this archive &mdash; likely
          a non-code project (docs, assets, etc).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-bone-500">
          {data.files_analyzed} file{data.files_analyzed !== 1 ? "s" : ""} analyzed
        </h3>
        <button
          onClick={run}
          className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-brass-400 hover:text-brass-400"
        >
          <RefreshCw size={12} />
          Re-dig
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={FileCode} label="Functions" value={data.total_functions} />
        <StatCard icon={Code2} label="Classes" value={data.total_classes} />
        <StatCard icon={ListTodo} label="Todo / fixme" value={data.total_todos} />
        <StatCard
          icon={Code2}
          label="Files with code"
          value={data.files_with_findings}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="border border-white/10 bg-soil-900/40 p-4 lg:col-span-3">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">
            Hotspots &middot; functions + classes per file
          </p>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hotspots}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="short"
                  width={150}
                  tick={{ fill: "#8A8A85", fontSize: 11, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#232324" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#151516" }}
                  contentStyle={{
                    background: "#0D0D0E",
                    border: "1px solid #232324",
                    borderRadius: 0,
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#F3EFE6" }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "functions" ? "functions" : "classes",
                  ]}
                  labelFormatter={(_, payload) =>
                    (payload?.[0]?.payload as { path?: string } | undefined)
                      ?.path ?? ""
                  }
                />
                <Bar dataKey="functions" stackId="a" fill="#C08A4E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="classes" stackId="a" fill="#BE5A45" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-4 font-mono text-xs uppercase tracking-[0.05em] text-bone-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2" style={{ background: "#C08A4E" }} />
              Functions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2" style={{ background: "#BE5A45" }} />
              Classes
            </span>
          </div>
        </div>

        <div className="border border-white/10 bg-soil-900/40 p-4 lg:col-span-2">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-brass-400">Code by file type</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byExtension}
                  dataKey="value"
                  nameKey="extension"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {byExtension.map((entry, i) => (
                    <Cell key={entry.extension} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0D0D0E",
                    border: "1px solid #232324",
                    borderRadius: 0,
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#F3EFE6" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs text-bone-600">
            {byExtension.map((e, i) => (
              <span key={e.extension} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                {e.extension} &middot; {e.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Code2;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-white/10 bg-soil-900/40 p-4">
      <Icon size={16} className="text-brass-400" />
      <p className="mt-2 text-xl font-semibold text-bone-100">{value}</p>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-600">{label}</p>
    </div>
  );
}
