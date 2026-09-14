"use client";

import { useMemo, useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  Search,
  X,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/api";

const CODE_EXTENSIONS = new Set([
  ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php",
  ".c", ".cpp", ".h", ".cs", ".html", ".css", ".sql", ".sh",
]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".tar", ".gz", ".rar", ".7z"]);
const DATA_EXTENSIONS = new Set([".json", ".yml", ".yaml", ".xml", ".toml"]);
const SHEET_EXTENSIONS = new Set([".csv", ".xls", ".xlsx"]);

function fileIcon(extension?: string) {
  const ext = (extension ?? "").toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return FileCode;
  if (IMAGE_EXTENSIONS.has(ext)) return FileImage;
  if (ARCHIVE_EXTENSIONS.has(ext)) return FileArchive;
  if (DATA_EXTENSIONS.has(ext)) return FileJson;
  if (SHEET_EXTENSIONS.has(ext)) return FileSpreadsheet;
  return FileText;
}

function nodeMatches(node: FileTreeNode, query: string): boolean {
  if (node.name.toLowerCase().includes(query)) return true;
  if (node.children) {
    return node.children.some((c) => nodeMatches(c, query));
  }
  return false;
}

function TreeNode({
  node,
  depth,
  query,
}: {
  node: FileTreeNode;
  depth: number;
  query: string;
}) {
  const [manuallyOpened, setManuallyOpened] = useState<boolean | null>(null);
  const hasMatch = query ? nodeMatches(node, query) : true;

  if (!hasMatch) return null;

  if (node.type === "file") {
    const Icon = fileIcon(node.extension);
    return (
      <div
        className="group flex items-center gap-2 px-2 py-1 transition-colors hover:bg-soil-800/60"
        style={{ paddingLeft: depth * 18 + 8 }}
      >
        <Icon size={14} className="shrink-0 text-bone-600 group-hover:text-brass-400" />
        <span className="truncate font-mono text-sm text-bone-300">
          {node.name}
        </span>
        {node.size_human && (
          <span className="ml-auto shrink-0 font-mono text-xs text-bone-600">
            {node.size_human}
          </span>
        )}
      </div>
    );
  }

  // Auto-expand folders while searching so matches are visible;
  // otherwise respect the user's manual toggle (default: top-level open).
  const open = manuallyOpened ?? (query ? true : depth < 1);

  return (
    <div>
      <button
        onClick={() => setManuallyOpened(!open)}
        className="group flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-soil-800/60"
        style={{ paddingLeft: depth * 18 + 8 }}
      >
        {open ? (
          <FolderOpen size={14} className="shrink-0 text-brass-400" />
        ) : (
          <Folder size={14} className="shrink-0 text-bone-500 group-hover:text-brass-400" />
        )}
        <span className="truncate font-mono text-sm text-bone-200">
          {node.name}
        </span>
        {node.children && (
          <span className="ml-auto shrink-0 font-mono text-xs text-bone-600">
            {node.children.length}
          </span>
        )}
      </button>
      {open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ root }: { root: FileTreeNode }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const visibleCount = useMemo(() => {
    if (!query || !root.children) return null;
    let count = 0;
    const walk = (n: FileTreeNode) => {
      if (n.type === "file" && nodeMatches(n, query)) count++;
      n.children?.forEach(walk);
    };
    root.children.forEach(walk);
    return count;
  }, [query, root.children]);

  return (
    <div className="border border-white/10 bg-soil-900/40">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Search size={13} className="shrink-0 text-bone-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter files by name…"
          className="w-full bg-transparent font-mono text-xs text-bone-300 placeholder:text-bone-700 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="shrink-0 text-bone-600 transition-colors hover:text-rust-400"
            aria-label="Clear filter"
          >
            <X size={13} />
          </button>
        )}
        {visibleCount !== null && (
          <span className="shrink-0 font-mono text-xs uppercase tracking-[0.08em] text-bone-600">
            {visibleCount} match{visibleCount !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto py-2">
        {root.children && root.children.length > 0 ? (
          root.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={0} query={query} />
          ))
        ) : (
          <p className="px-4 py-6 text-center font-mono text-sm text-bone-600">
            Empty archive.
          </p>
        )}
        {query && visibleCount === 0 && (
          <p className="px-4 py-6 text-center font-mono text-sm text-bone-600">
            No files match &ldquo;{search}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
