"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileArchive,
  FileText,
  X,
  Loader2,
  Files,
  HardDrive,
  GitBranch,
  ArrowRight,
} from "lucide-react";
import { uploadFiles, type UploadResult } from "@/lib/api";
import FileTree from "@/components/FileTree";
import DeepScanPanel from "@/components/DeepScanPanel";

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".dll", ".so", ".dylib", ".bin", ".msi", ".apk", ".jar",
  ".sh", ".bat", ".cmd", ".com", ".scr", ".ps1", ".app",
]);

const MAX_FILES = 50;

type Status = "idle" | "uploading" | "done" | "error";

function extOf(name: string) {
  return name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
}

function fileKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const picked = Array.from(incoming);

    const blocked = picked.find((f) => BLOCKED_EXTENSIONS.has(extOf(f.name)));
    if (blocked) {
      setError(`'${extOf(blocked.name)}' files aren't accepted for safety reasons.`);
      return;
    }

    setError("");
    setResult(null);
    setStatus("idle");
    setFiles((prev) => {
      const existingKeys = new Set(prev.map(fileKey));
      const merged = [...prev, ...picked.filter((f) => !existingKeys.has(fileKey(f)))];
      if (merged.length > MAX_FILES) {
        setError(`Too many files at once (> ${MAX_FILES}). Zip them up instead.`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }, []);

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => fileKey(f) !== key));
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    setStatus("uploading");
    setError("");

    const res = await uploadFiles(files);

    if ("error" in res) {
      setError(res.error);
      setStatus("error");
      return;
    }

    setResult(res);
    setStatus("done");
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setStatus("idle");
    setError("");
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
        <span className="h-px w-6 bg-brass-400" />
        Step one
      </p>
      <h1 className="text-4xl font-bold uppercase tracking-tight text-bone-100">
        Hand over the site
      </h1>
      <p className="mt-4 max-w-lg leading-relaxed text-bone-400">
        Zip up the old project folder as it is — or hand over a batch of
        loose files: PDFs, Word docs, text files, screenshots, whatever
        survived. Don't clean it up first. The mess is evidence.
      </p>

      {!result && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`mt-10 flex flex-col items-center justify-center border-2 border-dashed px-6 py-16 text-center transition-colors ${
              dragging
                ? "border-brass-400 bg-soil-900/60"
                : "border-white/15 bg-soil-900/30"
            }`}
          >
            <UploadCloud
              size={32}
              className={dragging ? "text-brass-400" : "text-bone-600"}
            />
            <p className="mt-4 font-semibold uppercase tracking-wide text-bone-200">
              Drop your files here
            </p>
            <p className="mt-2 text-sm text-bone-400">
              Drag a <span className="font-mono text-brass-400">.zip</span>{" "}
              &mdash; or several files at once &mdash; here, or
            </p>
            <label className="mt-4 cursor-pointer border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400">
              Browse files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {["ZIP", "PDF", "DOCX", "TXT"].map((tag) => (
                <span
                  key={tag}
                  className="border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-500">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected &middot;{" "}
                  {(totalSize / 1024).toFixed(1)} KB total
                </p>
                <button
                  onClick={() => setFiles([])}
                  className="font-mono text-xs uppercase tracking-[0.08em] text-bone-600 transition-colors hover:text-rust-400"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {files.map((f) => {
                  const key = fileKey(f);
                  const isZip = f.name.toLowerCase().endsWith(".zip");
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between border border-white/10 bg-soil-900/50 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {isZip ? (
                          <FileArchive size={18} className="shrink-0 text-brass-400" />
                        ) : (
                          <FileText size={18} className="shrink-0 text-brass-400" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-bone-100">
                            {f.name}
                          </p>
                          <p className="font-mono text-xs text-bone-600">
                            {(f.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(key)}
                        className="shrink-0 text-bone-600 transition-colors hover:text-rust-400"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 border border-rust-400/40 bg-soil-800 px-4 py-3 text-sm text-rust-400">
              {error}
            </p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={files.length === 0 || status === "uploading"}
            className="mt-8 inline-flex items-center gap-2 bg-brass-400 px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.1em] text-soil-950 transition-all hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-soil-700 disabled:text-bone-600"
          >
            {status === "uploading" && (
              <Loader2 size={16} className="animate-spin" />
            )}
            {status === "uploading" ? "Excavating…" : "Begin excavation"}
          </button>
        </>
      )}

      {result && (
        <div className="mt-10">
          <div className="flex items-center justify-between border border-moss-400/40 bg-soil-900/50 px-4 py-3">
            <p className="font-mono text-sm text-bone-100">
              {result.filename} — extracted
            </p>
            <button
              onClick={reset}
              className="font-mono text-xs uppercase tracking-[0.08em] text-bone-500 transition-colors hover:text-brass-400"
            >
              Upload another
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-soil-900/40 p-4">
              <Files size={16} className="text-brass-400" />
              <p className="mt-2 text-xl font-semibold text-bone-100">
                {result.summary.total_files}
              </p>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-600">Files</p>
            </div>
            <div className="border border-white/10 bg-soil-900/40 p-4">
              <HardDrive size={16} className="text-brass-400" />
              <p className="mt-2 text-xl font-semibold text-bone-100">
                {result.summary.total_size_human}
              </p>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-600">Total size</p>
            </div>
            <div className="border border-white/10 bg-soil-900/40 p-4">
              <GitBranch size={16} className="text-brass-400" />
              <p className="mt-2 text-xl font-semibold text-bone-100">
                {result.summary.has_git_history ? "Yes" : "No"}
              </p>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-bone-600">Git history</p>
            </div>
          </div>

          {result.summary.top_extensions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.summary.top_extensions.map((ext) => (
                <span
                  key={ext.extension}
                  className="border border-white/10 bg-soil-900/40 px-2.5 py-1 font-mono text-xs text-bone-400"
                >
                  {ext.extension} &middot; {ext.count}
                </span>
              ))}
            </div>
          )}

          <h2 className="mb-3 mt-8 font-mono text-xs uppercase tracking-[0.12em] text-bone-500">
            File tree
          </h2>
          <FileTree root={result.file_tree} />

          <DeepScanPanel sessionId={result.session_id} />

          <Link
            href={`/dashboard?session=${result.session_id}`}
            className="group mt-6 inline-flex items-center gap-2 border border-white/15 px-5 py-3 font-mono text-xs uppercase tracking-[0.1em] text-bone-200 transition-colors hover:border-brass-400 hover:text-brass-400"
          >
            Continue to dashboard
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>
      )}
    </main>
  );
}
