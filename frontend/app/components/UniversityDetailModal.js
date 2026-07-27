"use client";

import { useEffect, useState } from "react";
import {
  IconClose,
  IconExternalLink,
  IconAlert,
  IconChat,
} from "./icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SECTIONS = [
  ["overview", "Overview"],
  ["entry_requirements", "Entry requirements"],
  ["tuition_breakdown", "Tuition & living costs"],
  ["scholarships", "Scholarships"],
  ["application_deadlines", "Application deadlines"],
  ["notable_strengths", "Notable strengths"],
  ["visa_notes", "Visa (CAS) notes"],
];

function Fact({ label, children }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="fact-label">{label}</dt>
      <dd className="text-sm font-bold text-text-primary mt-0.5 truncate">
        {children}
      </dd>
    </div>
  );
}

export default function UniversityDetailModal({ university, course, level, onClose, onAskAi }) {
  const [details, setDetails] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    if (!university) return;
    let cancelled = false;

    fetch(`${API_URL}/universities/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: university.name,
        city: university.city,
        course: course || null,
        level: level || null,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [university, course, level]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!university) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div aria-hidden className="absolute inset-0 bg-navy-darker/60 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface border border-border rounded-md shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-pop-in"
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {university.name}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {[university.city, [level, course].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 grid place-items-center w-8 h-8 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        {/* Key-facts strip, the way a portal programme page opens: the
            numbers a student is deciding on, before any prose. */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border-b border-border">
          <Fact label="Tuition">
            £{Number(university.annual_tuition_gbp || 0).toLocaleString()}
            <span className="font-normal text-text-secondary"> /yr</span>
          </Fact>
          <Fact label="Location">{university.city}</Fact>
          <Fact label="Min IELTS">{university.min_ielts ?? "—"}</Fact>
          <Fact label="Intakes">
            {(university.intakes || []).join(", ") || "—"}
          </Fact>
        </dl>

        <div className="p-6">
          {status === "loading" && (
            <div className="space-y-4">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
              <p className="text-xs text-text-muted pt-2">
                Asking Gemini for live details…
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-6">
              <IconAlert width={26} height={26} className="mx-auto mb-3 text-danger" />
              <p className="text-text-primary font-medium mb-1">
                Couldn&apos;t load details
              </p>
              <p className="text-sm text-text-secondary">
                Please try again in a moment, or check the university&apos;s
                official website directly.
              </p>
            </div>
          )}

          {status === "success" && details && (
            <div className="space-y-5">
              {details.source && details.source !== "gemini" && (
                <p className="text-xs font-medium text-gold-dark bg-gold/10 inline-block px-2.5 py-1 rounded">
                  {details.source === "fallback"
                    ? "Showing offline estimated data — live lookup unavailable right now"
                    : "Live details unavailable right now"}
                </p>
              )}

              {details.message && (
                <p className="text-sm text-text-secondary">{details.message}</p>
              )}

              {SECTIONS.map(([key, label]) =>
                details[key] ? (
                  <div key={key}>
                    <h3 className="text-base font-bold text-text-primary mb-1 pb-1 border-b border-border">
                      {label}
                    </h3>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {details[key]}
                    </p>
                  </div>
                ) : null
              )}

              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                {details.official_url && (
                  <a
                    href={details.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark transition-colors text-white font-semibold px-4 py-2 rounded text-sm"
                  >
                    Visit official website
                    <IconExternalLink width={14} height={14} />
                  </a>
                )}
                <button
                  onClick={() => onAskAi(university)}
                  className="inline-flex items-center gap-1.5 border border-border hover:bg-background transition-colors text-text-primary px-4 py-2 rounded text-sm"
                >
                  <IconChat width={15} height={15} />
                  Ask AI about this university
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
