"use client";

import { useMemo, useState } from "react";
import {
  IconInbox,
  IconAlert,
  IconChevronDown,
  IconCalendar,
  IconLayoutGrid,
  IconLayoutList,
  IconStar,
  IconGraduationCap,
} from "./icons";
import { formatTuition, isVerified } from "../lib/figures";

function matchTier(uni, form) {
  const gpa = form.gpa === "" ? null : Number(form.gpa);
  const ielts = form.ielts === "" ? null : Number(form.ielts);
  if (gpa === null || ielts === null || uni.min_gpa == null) {
    return { label: "Eligible", tone: "navy" };
  }
  const gpaMargin = gpa - uni.min_gpa;
  const ieltsMargin = ielts - uni.min_ielts;
  if (gpaMargin >= 0.5 && ieltsMargin >= 1) {
    return { label: "Strong fit", tone: "success" };
  }
  if (gpaMargin >= 0 && ieltsMargin >= 0.5) {
    return { label: "Good fit", tone: "gold" };
  }
  return { label: "Meets minimum", tone: "navy" };
}

const toneClasses = {
  success: "text-success bg-success-bg",
  gold: "text-gold-dark bg-gold/10",
  navy: "text-navy-light bg-navy/5",
};

const SORT_OPTIONS = [
  { value: "match", label: "Best match" },
  { value: "tuition-asc", label: "Lowest tuition" },
  { value: "tuition-desc", label: "Highest tuition" },
  { value: "az", label: "Name (A–Z)" },
];

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-md p-5 space-y-3">
      <div className="skeleton h-5 w-2/3 rounded" />
      <div className="skeleton h-3 w-1/3 rounded" />
      <div className="skeleton h-5 w-40 rounded" />
      <div className="flex gap-1.5">
        <div className="skeleton h-5 w-16 rounded" />
        <div className="skeleton h-5 w-20 rounded" />
        <div className="skeleton h-5 w-14 rounded" />
      </div>
    </div>
  );
}

function isLive(uni) {
  return typeof uni.data_status === "string" && uni.data_status.startsWith("Live data");
}

/** Initials standing in for the university crest the portals show. */
function CrestBadge({ name }) {
  const initials = name
    .replace(/\b(University|of|the|College|London|Metropolitan)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className="grid place-items-center shrink-0 w-10 h-10 rounded border border-border bg-background text-navy text-xs font-bold"
    >
      {initials || name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** The portal's "4.3 ★ (72)" line. We have no reviews, but Discover Uni's
 *  official student-satisfaction score is the same idea and is real data. */
function SatisfactionScore({ official }) {
  const nss = official?.nss_satisfaction;
  if (nss == null) return null;
  const outOfFive = (nss / 20).toFixed(1);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-text-secondary"
      title="Official student satisfaction (Discover Uni / NSS)"
    >
      <span className="font-semibold text-text-primary">{outOfFive}</span>
      <IconStar width={12} height={12} fill="currentColor" className="text-gold" />
      <span className="text-text-muted">({Math.round(nss)}% satisfied)</span>
    </span>
  );
}

function UniCard({ uni, index, form, expanded, onToggle, compact, onSelect, isFavorited, onToggleFavorite }) {
  const tier = matchTier(uni, form);
  const visibleCourses = compact ? uni.courses.slice(0, 3) : uni.courses;
  const remaining = uni.courses.length - visibleCourses.length;
  const live = isLive(uni);
  // Only the level the student asked for is worth repeating on every card;
  // with no level chosen, list what the university teaches instead.
  const levels = form.level ? [form.level] : uni.levels || [];

  const blurb = uni.why_it_matches || uni.scholarship;

  return (
    <article
      onClick={() => onSelect(uni)}
      className="animate-fade-in bg-surface border border-border rounded-md p-4 sm:p-5 card-hover cursor-pointer relative"
      style={{ animationDelay: `${Math.min(index, 8) * 0.03}s` }}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(uni);
          }}
          aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          className={`absolute top-4 right-4 transition-colors ${
            isFavorited ? "text-gold" : "text-text-muted hover:text-gold"
          }`}
        >
          <IconStar width={18} height={18} fill={isFavorited ? "currentColor" : "none"} />
        </button>
      )}

      {/* Institution line — crest, name, score, standing — above the title,
          exactly the hierarchy the portal result cards use. */}
      <div className="flex items-start gap-3 pr-8">
        <CrestBadge name={uni.name} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {uni.name}
          </p>
          <p className="text-xs text-text-secondary">
            {uni.city}, United Kingdom
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <SatisfactionScore official={uni.official} />
            {uni.official?.employment_pct != null && (
              <span className="text-xs font-semibold text-text-primary">
                {Math.round(uni.official.employment_pct)}% in work or study
              </span>
            )}
          </div>
        </div>
      </div>

      <h3 className="mt-3 text-lg font-bold text-navy leading-snug">
        {form.level || form.course
          ? [form.level, form.course || "programmes"].filter(Boolean).join(" ")
          : "Undergraduate & postgraduate programmes"}
      </h3>

      {blurb && (
        <p className="card-blurb mt-2 text-sm text-text-secondary line-clamp-2">
          {blurb}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {levels.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 text-xs font-semibold border border-border rounded bg-background px-2 py-1 text-text-primary"
            >
              <IconGraduationCap width={11} height={11} />
              {l === "BSc" ? "B.Sc." : l === "MSc" ? "M.Sc." : l}
            </span>
          ))}
          {uni.intakes.map((m) => (
            <span
              key={m}
              className={`inline-flex items-center gap-1 text-xs rounded px-2 py-1 border ${
                form.intake === m
                  ? "border-gold bg-gold/10 text-gold-dark font-semibold"
                  : "border-transparent bg-background text-text-secondary"
              }`}
            >
              <IconCalendar width={11} height={11} />
              {m}
            </span>
          ))}
        </div>

        <p className="text-right ml-auto">
          <span className="text-base font-bold text-text-primary">
            {formatTuition(uni)}
          </span>
          <span className="text-sm text-text-secondary">/yr</span>
          <span className="block text-[11px] text-text-muted">
            {isVerified(uni, "annual_tuition_gbp") ? "from official source" : "estimate"}
          </span>
        </p>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${toneClasses[tier.tone]}`}
          >
            {tier.label}
          </span>
          <span
            title={
              live
                ? "Figures verified against live web results just now"
                : "Estimated figures — open the university for a live lookup"
            }
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
              live
                ? "text-success bg-success-bg"
                : "text-text-muted bg-background border border-border"
            }`}
          >
            {live && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
            {live ? "Live data" : "Estimated"}
          </span>
          <span className="text-xs text-text-muted">
            Needs GPA {uni.min_gpa}+ · IELTS {uni.min_ielts}+
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(uni.id);
            }}
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-navy-light transition-colors"
          >
            {expanded ? "Less" : "More"}
            <IconChevronDown
              width={12}
              height={12}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <span className="link-blue text-sm">View University Information</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border animate-fade-in text-xs space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {visibleCourses.map((c) => (
              <span
                key={c}
                className="text-xs bg-background rounded px-2 py-0.5 text-text-secondary"
              >
                {form.level ? `${form.level} ${c}` : c}
              </span>
            ))}
            {remaining > 0 && (
              <span className="text-xs text-text-muted px-2 py-0.5">
                +{remaining} more
              </span>
            )}
          </div>
          {uni.scholarship && (
            <p className="text-text-secondary">{uni.scholarship}</p>
          )}
          <p className="text-text-muted">Data status: {uni.data_status}</p>
        </div>
      )}
    </article>
  );
}

const PAGE_SIZE = 24;

export default function ResultsList({
  status,
  results,
  form,
  onRetry,
  source,
  onSelectUniversity,
  favoriteIds,
  onToggleFavorite,
}) {
  const [sortBy, setSortBy] = useState("match");
  const [compact, setCompact] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // A new search (or a re-sort) should start back at the first page. Done as
  // an adjust-during-render rather than an effect, so the list never paints
  // one frame of the old page first.
  const [pageDeps, setPageDeps] = useState({ results, sortBy });
  if (pageDeps.results !== results || pageDeps.sortBy !== sortBy) {
    setPageDeps({ results, sortBy });
    setVisibleCount(PAGE_SIZE);
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortedResults = useMemo(() => {
    if (!results) return [];
    const list = [...results];
    switch (sortBy) {
      case "tuition-asc":
        return list.sort((a, b) => a.annual_tuition_gbp - b.annual_tuition_gbp);
      case "tuition-desc":
        return list.sort((a, b) => b.annual_tuition_gbp - a.annual_tuition_gbp);
      case "az":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "match":
      default: {
        const gpa = form.gpa === "" ? 0 : Number(form.gpa);
        const ielts = form.ielts === "" ? 0 : Number(form.ielts);
        const margin = (uni) =>
          (uni.min_gpa == null ? 0 : gpa - uni.min_gpa) + (ielts - uni.min_ielts);
        // Live-verified entries first — the backend already picked these as
        // the best matches, and it keeps the "top N verified" note accurate.
        return list.sort(
          (a, b) => isLive(b) - isLive(a) || margin(b) - margin(a)
        );
      }
    }
  }, [results, sortBy, form.gpa, form.ielts]);

  const visibleResults = useMemo(
    () => sortedResults.slice(0, visibleCount),
    [sortedResults, visibleCount]
  );
  const hiddenCount = sortedResults.length - visibleResults.length;
  const liveCount = useMemo(
    () => (results || []).filter(isLive).length,
    [results]
  );

  if (status === "idle") {
    return (
      <div className="border border-dashed border-border rounded-md bg-surface p-12 text-center text-text-secondary bg-surface/50 animate-fade-in">
        <IconInbox
          width={32}
          height={32}
          className="mx-auto mb-3 text-text-muted"
        />
        Fill in the form and hit{" "}
        <span className="font-medium text-text-primary">
          Find my universities
        </span>{" "}
        to see your matches.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-danger/30 rounded-md p-8 bg-danger-bg text-text-secondary text-center animate-fade-in">
        <IconAlert width={28} height={28} className="mx-auto mb-3 text-danger" />
        <p className="text-text-primary font-medium mb-1">
          Couldn&apos;t reach the server
        </p>
        <p className="text-sm">
          Make sure the FastAPI backend is running, then try again.
        </p>
        <button
          onClick={onRetry}
          className="mt-4 text-sm font-semibold bg-navy hover:bg-navy-light text-white px-4 py-2 rounded transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64 rounded" />
        <p className="text-xs text-text-muted -mt-2">
          Asking Gemini for live matches…
        </p>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {source === "fallback" && (
        <p className="text-xs font-medium text-gold-dark bg-gold/10 border border-gold/30 rounded px-3 py-2 mb-4 animate-fade-in">
          Live lookup unavailable right now — showing offline estimated data
        </p>
      )}

      {/* Breadcrumb + headline count + sort strip: the portal's standard
          results header, so the page states what it is listing before it
          lists it. */}
      <nav aria-label="Breadcrumb" className="text-xs text-text-secondary mb-2">
        <ol className="flex flex-wrap items-center gap-1.5">
          {["Home", form.level || "All degrees", form.course || "All subjects", form.city || "United Kingdom"].map(
            (crumb, i, all) => (
              <li key={`${crumb}-${i}`} className="flex items-center gap-1.5">
                <span className={i === all.length - 1 ? "text-text-primary font-medium" : ""}>
                  {crumb}
                </span>
                {i < all.length - 1 && <span className="text-text-muted">›</span>}
              </li>
            )
          )}
        </ol>
      </nav>

      <h2 className="text-2xl font-bold text-text-primary leading-snug">
        {results.length}{" "}
        {[form.level, form.course].filter(Boolean).join(" ") || "university"}
        {results.length === 1 ? " match" : " matches"}
        {form.city ? ` in ${form.city}` : " in the United Kingdom"}
      </h2>
      {liveCount > 0 && (
        <p className="text-xs text-text-secondary mt-1">
          Top {liveCount} verified against live web data · the rest show
          estimated figures until you open them
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 mb-5 pb-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-secondary">
            Showing{" "}
            <span className="font-semibold text-text-primary">
              {Math.min(visibleCount, sortedResults.length)}
            </span>{" "}
            of {sortedResults.length}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-xs font-semibold text-text-secondary">
              Sort
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="focus-gold text-sm border border-border rounded px-2.5 py-1.5 bg-white"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCompact((v) => !v)}
              title={compact ? "Show full details" : "Show compact view"}
              className="grid place-items-center w-9 h-9 rounded border border-border bg-white hover:bg-background transition-colors text-text-secondary"
            >
              {compact ? (
                <IconLayoutList width={16} height={16} />
              ) : (
                <IconLayoutGrid width={16} height={16} />
              )}
            </button>
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div className="border border-dashed border-border rounded-md bg-surface p-12 text-center text-text-secondary bg-surface/50 animate-fade-in">
          <IconInbox
            width={32}
            height={32}
            className="mx-auto mb-3 text-text-muted"
          />
          No matches yet &mdash; try lowering your IELTS requirement, raising
          your budget, or clearing the name search, course, city, level and
          intake filters.
        </div>
      )}

      <div className={compact ? "grid sm:grid-cols-2 gap-3" : "space-y-3"}>
        {visibleResults.map((uni, i) => (
          <UniCard
            key={uni.id}
            uni={uni}
            index={i}
            form={form}
            compact={compact}
            expanded={expandedIds.has(uni.id)}
            onToggle={toggleExpanded}
            onSelect={onSelectUniversity}
            isFavorited={favoriteIds?.has(uni.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="inline-flex items-center gap-2 border border-navy-light text-navy-light hover:bg-navy-light hover:text-white text-sm font-semibold px-6 py-2.5 rounded transition-colors"
          >
            Show {Math.min(hiddenCount, PAGE_SIZE)} more
            <span className="text-text-muted font-normal">
              ({hiddenCount} left)
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
