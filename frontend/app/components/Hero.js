"use client";

import { IconSparkle } from "./icons";

export default function Hero({ universityCount, onStart }) {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
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

      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
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

        <div
          className="mt-9 flex flex-wrap items-center gap-4 animate-fade-in-up"
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
          <Stat value={`${universityCount || 157}+`} label="UK universities" />
          <Stat value="10" label="Course categories" />
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
