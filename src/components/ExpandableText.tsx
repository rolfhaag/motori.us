"use client";

import { useState } from "react";

/** First sentence or so, with a "Show more" link that opens the rest. */
export default function ExpandableText({ text, limit = 140 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const clean = (text ?? "").trim();
  // The first sentence, but never longer than `limit` characters (cut at a word).
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(clean);
  let head = m ? m[0] : clean;
  if (head.length > limit) head = head.slice(0, limit).replace(/\s+\S*$/, "") + "\u2026";
  const hasMore = clean.length > head.length;
  if (!hasMore) return <>{clean}</>;
  return (
    <>
      {open ? clean : head}{" "}
      <button type="button" className="show-more" onClick={() => setOpen((v) => !v)}>
        {open ? "Show less" : "Show more"}
      </button>
    </>
  );
}
