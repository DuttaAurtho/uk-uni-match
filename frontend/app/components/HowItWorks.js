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
    <section id="how-it-works" className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="max-w-xl mb-8">
        <h2 className="text-xl font-bold text-text-primary">How it works</h2>
        <p className="text-sm text-text-secondary mt-1">
          Three steps, no signup required.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="relative bg-background border border-border rounded-md p-5"
            >
            <span className="absolute top-4 right-5 text-2xl font-bold text-border select-none">
              {i + 1}
            </span>
            <div className="grid place-items-center w-10 h-10 rounded bg-navy/5 text-navy-light mb-3">
              <step.icon width={20} height={20} />
            </div>
            <h3 className="font-bold text-base">{step.title}</h3>
            <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
              {step.body}
            </p>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}
