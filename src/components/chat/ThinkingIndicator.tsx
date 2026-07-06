import { useEffect, useState } from "react";

// Rotating "what the agent is doing" copy so a multi-second backend call feels
// alive instead of a dead "Analyzing…". Advances through the phases and parks on
// the last one (we don't know the exact finish time). Re-mounts per request, so
// it always starts from the top.
const THINKING_PHRASES = [
  "Understanding your request…",
  "Finding the right information…",
  "Calling the compliance agent…",
  "Reviewing the results…",
  "Structuring the answer…",
  "Almost ready…",
];

interface Props {
  /** Optional override (e.g. a concrete tool name) shown instead of the rotation. */
  label?: string | null;
  className?: string;
  intervalMs?: number;
}

export default function ThinkingIndicator({ label, className, intervalMs = 2200 }: Props) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (label) return; // a concrete status was provided; no rotation
    const id = setInterval(() => setI((prev) => Math.min(prev + 1, THINKING_PHRASES.length - 1)), intervalMs);
    return () => clearInterval(id);
  }, [label, intervalMs]);

  const text = label || THINKING_PHRASES[i];

  return (
    <span key={text} className={`inline-block animate-in fade-in duration-500 ${className ?? ""}`}>
      {text}
    </span>
  );
}
