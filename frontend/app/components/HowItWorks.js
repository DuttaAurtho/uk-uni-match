"use client";

import { IconTarget, IconSearch, IconAward } from "./icons";

const STEPS = [
  {
    icon: IconTarget,
    title: "Enter your profile",
    body: "Your HSC/GPA, IELTS band, and yearly budget — that's all it takes.",
  },
  {
    icon: IconSearch,
    title: "We match instantly",
    body: "We check your numbers against entry requirements at UK universities, live.",
  },
  {
    icon: IconAward,
    title: "Compare & shortlist",
    body: "See tuition, intakes, and scholarship notes side by side, sorted your way.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="text-center max-w-xl mx-auto mb-12">
        <p className="font-mono text-xs tracking-[0.2em] text-gold-dark uppercase mb-3">
          Simple by design
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          How it works
        </h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="relative bg-surface border border-border rounded-xl p-6 card-hover animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="absolute top-5 right-5 font-[family-name:var(--font-display)] text-3xl text-border select-none">
              {i + 1}
            </span>
            <div className="grid place-items-center w-11 h-11 rounded-lg bg-navy/5 text-navy-light mb-4">
              <step.icon width={20} height={20} />
            </div>
            <h3 className="font-semibold text-lg">{step.title}</h3>
            <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
