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
      className="relative overflow-hidden bg-gradient-to-b from-navy-darker via-navy to-navy-light text-white"
    >
      {/* Decorative glows */}
      <div
        aria-hidden
        className="glow-orb pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gold/20 blur-3xl"
      />
      <div
        aria-hidden
        className="glow-orb pointer-events-none absolute top-1/3 -left-32 w-72 h-72 rounded-full bg-navy-light/60 blur-3xl"
        style={{ animationDelay: "3s" }}
      />
      <div aria-hidden className="hero-grid absolute inset-0" />

      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28 text-center flex flex-col items-center">
        <div
          className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-gold uppercase mb-6 border border-gold/30 bg-gold/10 rounded-full px-3 py-1.5 animate-fade-in-up"
        >
          <IconSparkle width={13} height={13} />
          For Bangladeshi students applying to the UK
        </div>

        <h1
          className="font-[family-name:var(--font-display)] text-4xl sm:text-6xl leading-[1.1] max-w-3xl text-balance animate-fade-in-up"
          style={{ animationDelay: "0.08s" }}
        >
          Find out which UK universities{" "}
          <span className="text-gold">actually fit</span> your GPA, IELTS,
          and budget.
        </h1>

        <p
          className="mt-6 text-white/70 max-w-xl leading-relaxed text-lg animate-fade-in-up"
          style={{ animationDelay: "0.16s" }}
        >
          No more digging through ten different admissions pages. Enter your
          numbers once, and see every university you&apos;re realistically
          eligible for &mdash; instantly.
        </p>

        {/* The primary way in: search a university by name straight from the
            hero, the way the big course-portal sites do it. The sidebar form
            is for narrowing by GPA/budget once results are on screen. */}
        <form
          ref={searchRef}
          onSubmit={handleSearch}
          role="search"
          className="relative mt-10 w-full max-w-3xl animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-white rounded-xl p-2 shadow-lg">
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
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-light active:scale-[0.98] transition-all text-navy font-semibold px-7 py-2.5 rounded-lg"
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

        <div
          className="mt-9 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up"
          style={{ animationDelay: "0.24s" }}
        >
          <button
            onClick={onStart}
            className="bg-gold hover:bg-gold-light active:scale-[0.98] transition-all text-navy font-semibold px-6 py-3 rounded-lg shadow-gold"
          >
            Find my universities
          </button>
          <button
            onClick={() => scrollTo("how-it-works")}
            className="text-white/80 hover:text-white border border-white/20 hover:border-white/40 px-6 py-3 rounded-lg transition-colors"
          >
            How it works
          </button>
        </div>

        <div
          className="mt-14 grid grid-cols-3 max-w-lg gap-6 animate-fade-in-up"
          style={{ animationDelay: "0.32s" }}
        >
          <Stat
            value={stats ? stats.university_count : "—"}
            label="UK universities"
          />
          <Stat
            value={stats ? stats.city_count : "—"}
            label="Cities & towns"
          />
          <Stat value="Free" label="No signup needed" />
        </div>
      </div>

      <div className="relative flex justify-center pb-6">
        <div className="scroll-cue text-white/40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14m0 0-6-6m6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl text-gold">
        {value}
      </p>
      <p className="text-xs text-white/50 mt-1 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
