const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Plain fetch passthrough. Kept as a named wrapper (rather than inlining
// fetch() at all 12 call sites) so nothing else needs to change if a
// cross-cutting concern (auth, retries, etc.) is ever needed again.
function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, init);
}

export type HealthStatus = {
  ok: boolean;
  status?: string;
  message?: string;
};

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await authFetch(`${API_BASE}/api/health`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, message: `Server responded with ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, status: data.status ?? "ok" };
  } catch (err) {
    return {
      ok: false,
      message: "Can't reach the backend. Is FastAPI running?",
    };
  }
}

export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  size_human?: string;
  extension?: string;
  children?: FileTreeNode[];
};

export type ScanSummary = {
  total_files: number;
  total_dirs: number;
  total_size: number;
  total_size_human: string;
  has_git_history: boolean;
  top_extensions: { extension: string; count: number }[];
};

export type UploadResult = {
  session_id: string;
  filename: string;
  file_tree: FileTreeNode;
  summary: ScanSummary;
};

export type UploadError = { error: string };

export async function uploadFiles(
  files: File[]
): Promise<UploadResult | UploadError> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  try {
    const res = await authFetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || `Upload failed (${res.status}).` };
    }

    return data as UploadResult;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type CodeLocation = { name: string; line: number };
export type TodoEntry = { tag: string; text: string; line: number };

export type ScannedFile = {
  path: string;
  extension: string;
  size: number;
  modified: string;
  functions?: CodeLocation[];
  classes?: CodeLocation[];
  imports?: string[];
  todos?: TodoEntry[];
};

export type GitCommit = {
  hash: string;
  author: string;
  date: string;
  message: string;
};

export type GitInfo = {
  available: boolean;
  error?: string;
  commit_count?: number;
  authors?: string[];
  first_commit?: GitCommit | null;
  last_commit?: GitCommit | null;
  commits?: GitCommit[];
};

export type DeepScanResult = {
  session_id: string;
  files_analyzed: number;
  files_with_findings: number;
  total_functions: number;
  total_classes: number;
  total_todos: number;
  files: ScannedFile[];
  git: GitInfo;
};

export async function scanSession(
  sessionId: string
): Promise<DeepScanResult | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/scan/${sessionId}`);
    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || `Scan failed (${res.status}).` };
    }

    return data as DeepScanResult;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type FindingSeverity = "info" | "notable" | "anomaly";

export type Finding = {
  id: string;
  category:
    | "timeline_anomaly"
    | "repeated_file"
    | "hotspot"
    | "contributor"
    | "artifact";
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: string[];
  confidence?: number;
};

export type FindingsResult = {
  session_id: string;
  generated_at: string;
  total_findings: number;
  findings: Finding[];
};

export async function getFindings(
  sessionId: string
): Promise<FindingsResult | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/findings/${sessionId}`);
    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || `Findings failed (${res.status}).` };
    }

    return data as FindingsResult;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type AIInterpretation = {
  session_id: string;
  available: boolean;
  error?: string;
  model?: string;
  project_title?: string;
  estimated_timeline?: string;
  evolution?: string[];
  narrative?: string;
  key_insight?: string;
};

export async function getInterpretation(
  sessionId: string
): Promise<AIInterpretation | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/interpret/${sessionId}`);
    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || `Interpretation failed (${res.status}).` };
    }

    return data as AIInterpretation;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type ImproveFindingResult = {
  session_id: string;
  finding_id: string;
  title: string;
  previous_confidence: number;
  revised_confidence: number;
  new_evidence: string[];
  new_evidence_count: number;
};

export async function improveFinding(
  sessionId: string,
  findingId: string
): Promise<ImproveFindingResult | UploadError> {
  try {
    const res = await authFetch(
      `${API_BASE}/api/findings/${sessionId}/improve/${findingId}`,
      { method: "POST" }
    );
    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || `Re-investigation failed (${res.status}).` };
    }

    return data as ImproveFindingResult;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type FeedbackType =
  | "correct"
  | "incorrect"
  | "improve"
  | "bug"
  | "ai_suggestion"
  | "rating"
  | "missing_evidence"
  | "general";

export type FeedbackPayload = {
  session_id?: string;
  finding_id?: string;
  type: FeedbackType;
  rating?: number;
  message?: string;
};

export async function submitFeedback(
  payload: FeedbackPayload
): Promise<{ ok: true } | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || `Feedback failed (${res.status}).` };
    }

    return { ok: true };
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type QASuggestion = { label: string; command: string };

export async function detectTestCommands(
  sessionId: string
): Promise<{ suggestions: QASuggestion[] } | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/qa/${sessionId}/detect`);
    const data = await res.json();
    if (!res.ok) {
      return { error: data.detail || `Detection failed (${res.status}).` };
    }
    return data;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type QAFailure = {
  error_type: string | null;
  error_message: string | null;
  file: string | null;
  line: number | null;
  code_snippet: string;
  raw_output: string;
};

export type QARunResult = {
  result: {
    command: string;
    returncode: number | null;
    passed: boolean;
    stdout: string;
    stderr: string;
    timed_out: boolean;
  };
  failure?: QAFailure;
};

export async function runQACommand(
  sessionId: string,
  command: string
): Promise<QARunResult | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/qa/${sessionId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.detail || `Run failed (${res.status}).` };
    }
    return data as QARunResult;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export type QAFixProposal = {
  available: boolean;
  error?: string;
  model?: string;
  file?: string;
  explanation?: string;
  proposed_file_content?: string | null;
  confidence?: "high" | "medium" | "low";
};

export async function proposeQAFix(
  sessionId: string,
  failure: QAFailure
): Promise<QAFixProposal | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/qa/${sessionId}/propose-fix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(failure),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.detail || `Proposal failed (${res.status}).` };
    }
    return data as QAFixProposal;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export async function applyQAFix(
  sessionId: string,
  file: string,
  newContent: string
): Promise<{ status: string; file: string; backup: string | null } | UploadError> {
  try {
    const res = await authFetch(`${API_BASE}/api/qa/${sessionId}/apply-fix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, new_content: newContent }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.detail || `Apply failed (${res.status}).` };
    }
    return data;
  } catch (err) {
    return { error: "Can't reach the backend. Is FastAPI running?" };
  }
}

export { API_BASE };
