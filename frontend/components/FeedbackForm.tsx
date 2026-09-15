"use client";

import { useState } from "react";
import { Bug, Lightbulb, Star, FileQuestion, MessageSquare, Check } from "lucide-react";
import { submitFeedback, type FeedbackType } from "@/lib/api";

const CATEGORIES: { type: FeedbackType; label: string; icon: typeof Bug; placeholder: string }[] = [
  { type: "bug", label: "Report a bug", icon: Bug, placeholder: "What didn't work correctly?" },
  { type: "ai_suggestion", label: "AI suggestion", icon: Lightbulb, placeholder: "What capability should the agent have?" },
  { type: "missing_evidence", label: "Missing evidence", icon: FileQuestion, placeholder: "What did the AI miss?" },
  { type: "general", label: "General feedback", icon: MessageSquare, placeholder: "Anything else on your mind?" },
];

export default function FeedbackForm({ sessionId }: { sessionId?: string }) {
  const [category, setCategory] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!message.trim() && rating === null) return;
    setSubmitting(true);
    setError("");
    const res = await submitFeedback({
      session_id: sessionId,
      type: category,
      message: message.trim() || undefined,
    });
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSent(true);
    setMessage("");
  }

  async function handleRate(stars: number) {
    setRating(stars);
    await submitFeedback({ session_id: sessionId, type: "rating", rating: stars });
  }

  if (sent) {
    return (
      <div className="flex items-center gap-3 border border-moss-400/30 bg-soil-900/40 p-6 text-moss-400">
        <Check size={18} />
        <p className="font-mono text-sm">
          Thanks &mdash; your feedback helps Digital Archaeologist get more
          accurate over time.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/10 bg-soil-900/40 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-brass-400">
        Help us improve
      </p>
      <p className="mt-2 text-sm text-bone-400">
        Your feedback helps Digital Archaeologist become more accurate,
        reliable, and useful over time.
      </p>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-600">
          Rate this analysis
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              aria-label={`${star} stars`}
              className="-m-2 p-2 transition-colors sm:-m-0 sm:p-0"
            >
              <Star
                size={20}
                className={
                  rating !== null && star <= rating
                    ? "fill-brass-400 text-brass-400"
                    : "text-bone-700 hover:text-bone-500"
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.type}
            onClick={() => setCategory(c.type)}
            className={`flex flex-col items-center gap-1.5 border px-3 py-3 text-center transition-colors ${
              category === c.type
                ? "border-brass-400 text-brass-400"
                : "border-white/10 text-bone-500 hover:text-bone-200"
            }`}
          >
            <c.icon size={16} />
            <span className="font-mono text-[10px] uppercase tracking-[0.06em]">
              {c.label}
            </span>
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={CATEGORIES.find((c) => c.type === category)?.placeholder}
        rows={4}
        className="mt-4 w-full border border-white/15 bg-soil-950 px-3 py-2.5 text-sm text-bone-200 placeholder:text-bone-700 focus:border-brass-400 focus:outline-none"
      />

      {error && (
        <p className="mt-3 border border-rust-400/40 bg-soil-800 px-3 py-2 text-sm text-rust-400">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !message.trim()}
        className="mt-4 bg-brass-400 px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-soil-950 transition-all hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-bone-600"
      >
        {submitting ? "Sending\u2026" : "Submit feedback"}
      </button>
    </div>
  );
}
