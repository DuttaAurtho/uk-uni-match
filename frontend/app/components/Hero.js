"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconSparkle, IconSearch } from "./icons";

// How many name suggestions to show at once. The native <datalist> this
// replaces rendered all 166 in one unstyled slab over the page.
const MAX_SUGGESTIONS = 8;

export default function Hero({
  stats,
  onStart,
  q = "",
  onQChange,
  onSearch,
  universityNames = [],
}) {
  const listboxId = useId();
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Same rule the backend's own name search uses: every word typed has to
  // appear in the name, so what's suggested is what a search would return.
  const suggestions = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return universityNames
      .filter((name) => {
        const haystack = name.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [q, universityNames]);

  const showSuggestions = open && suggestions.length > 0;

  useEffect(() => {
    function handleClickOutside(e) {
      if (!searchRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function closeSuggestions() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function pick(name) {
    closeSuggestions();
    onQChange(name);
    // Passed explicitly: the state set above won't have landed by the time
    // the parent reads its own form, so the click would search the old text.
    onSearch(name);
  }

  function handleSearch(e) {
    e.preventDefault();
    closeSuggestions();
    onSearch();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggestions.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => {
        const next = i + step;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === "Enter" && showSuggestions && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    }
  }

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-navy text-white"
    >
      {/* Decorative glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-white/80 uppercase mb-4">
          <IconSparkle width={13} height={13} />
          For Bangladeshi students applying to the UK
        </div>

        <h1 className="text-2xl sm:text-4xl font-bold leading-tight max-w-3xl text-balance">
          Find UK universities that fit your GPA, IELTS and budget
        </h1>

        <p className="mt-3 text-white/75 max-w-2xl leading-relaxed text-sm sm:text-base">
          Search {stats ? `${stats.university_count} universities` : "the full list"} by
          name, or set your numbers and see everything you&apos;re eligible for.
        </p>

        {/* The primary way in: search a university by name straight from the
            hero, the way the big course-portal sites do it. The sidebar form
            is for narrowing by GPA/budget once results are on screen. */}
        <form
          ref={searchRef}
          onSubmit={handleSearch}
          role="search"
          className="relative mt-7 w-full max-w-3xl"
        >
          <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-white rounded-md p-1.5 shadow-md">
            <div className="flex items-center flex-1 min-w-0 gap-2 px-2">
              <IconSearch
                width={18}
                height={18}
                className="shrink-0 text-text-muted"
              />
              <input
                type="text"
                name="q"
                autoComplete="off"
                value={q}
                onChange={(e) => {
                  onQChange(e.target.value);
                  setOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  showSuggestions && activeIndex >= 0
                    ? `${listboxId}-${activeIndex}`
                    : undefined
                }
                aria-label="Search universities by name"
                placeholder="Search a university — e.g. Manchester Met"
                className="w-full bg-transparent text-text-primary placeholder:text-text-muted py-2.5 text-base focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark transition-colors text-white font-semibold px-8 py-2.5 rounded"
            >
              <IconSearch width={16} height={16} />
              Search
            </button>
          </div>

          {showSuggestions && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="University name suggestions"
              className="absolute left-0 right-0 top-full mt-2 z-20 overflow-hidden rounded-xl border border-border bg-white shadow-lg text-left animate-fade-in"
            >
              {suggestions.map((name, i) => (
                <li key={name} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // onMouseDown, not onClick: the input's blur would
                    // otherwise tear the list down before the click lands.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(name);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`block w-full px-4 py-2.5 text-sm transition-colors ${
                      i === activeIndex
                        ? "bg-gold/10 text-navy"
                        : "text-text-primary hover:bg-background"
                    }`}
                  >
                    <span className="block truncate text-left">{name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <button
            onClick={onStart}
            className="font-semibold text-white underline underline-offset-4 hover:text-white/80 transition-colors"
          >
            Or match by GPA, IELTS &amp; budget
          </button>
          <button
            onClick={() => scrollTo("how-it-works")}
            className="text-white/70 hover:text-white transition-colors"
          >
            How it works
          </button>
        </div>
      </div>

      {/* A thin stat strip closing the band, in place of the old three big
          gold numbers — portals state their scale in one quiet line. */}
      <div className="relative border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-3 flex flex-wrap justify-center gap-x-8 gap-y-1 text-xs text-white/70">
          <Stat value={stats ? stats.university_count : "—"} label="UK universities" />
          <Stat value={stats ? stats.city_count : "—"} label="cities & towns" />
          <Stat value={stats ? stats.course_count : "—"} label="subject areas" />
          <Stat value="Free" label="no signup needed" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <p>
      <span className="font-semibold text-white">{value}</span> {label}
    </p>
  );
}
