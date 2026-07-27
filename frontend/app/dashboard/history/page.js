"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { IconInbox } from "../../components/icons";

function summarize(entry) {
  const bits = [];
  if (entry.name_query) bits.push(`“${entry.name_query}”`);
  if (entry.gpa != null) bits.push(`GPA ${entry.gpa}`);
  if (entry.ielts != null) bits.push(`IELTS ${entry.ielts}`);
  if (entry.budget != null) bits.push(`Budget £${Number(entry.budget).toLocaleString()}`);
  // Level and course read as one degree ("MSc Computer Science") when both
  // are set, matching how the search form presents them.
  if (entry.course) bits.push([entry.level, entry.course].filter(Boolean).join(" "));
  else if (entry.level) bits.push(entry.level);
  if (entry.city) bits.push(entry.city);
  if (entry.intake) bits.push(`${entry.intake} intake`);
  return bits.length ? bits.join(" · ") : "No filters";
}

export default function HistoryPage() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/me/history")
      .then((data) => setHistory(data.history))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Search history
      </h1>
      <p className="text-sm text-text-secondary mb-6">Your last searches on the homepage.</p>

      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-4">{error}</p>}

      {history?.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <IconInbox width={28} height={28} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            No searches yet — run a search on the homepage while logged in.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {history?.map((entry) => (
          <div key={entry.id} className="bg-surface border border-border rounded-lg px-4 py-3">
            <p className="text-sm text-text-primary">{summarize(entry)}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {entry.result_count} {entry.result_count === 1 ? "match" : "matches"} ·{" "}
              {entry.created_at}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
