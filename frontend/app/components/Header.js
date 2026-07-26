"use client";

import { IconGraduationCap } from "./icons";

export default function Header() {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header className="sticky top-0 z-50 bg-navy/90 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => scrollTo("top")}
          className="flex items-center gap-2.5 text-white group"
        >
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 text-gold group-hover:bg-gold/25 transition-colors">
            <IconGraduationCap width={17} height={17} />
          </span>
          <span className="font-[family-name:var(--font-display)] text-lg tracking-wide">
            UK Uni Match
          </span>
        </button>

        <nav className="hidden sm:flex items-center gap-8 text-sm text-white/70">
          <button
            onClick={() => scrollTo("how-it-works")}
            className="hover:text-white transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => scrollTo("match-form")}
            className="hover:text-white transition-colors"
          >
            Universities
          </button>
        </nav>

        <button
          onClick={() => scrollTo("match-form")}
          className="text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2 rounded-md transition-colors"
        >
          Start matching
        </button>
      </div>
    </header>
  );
}
