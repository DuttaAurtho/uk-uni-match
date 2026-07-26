import { IconGraduationCap } from "./icons";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-12">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-text-primary">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-navy/5 text-navy-light">
            <IconGraduationCap width={14} height={14} />
          </span>
          <span className="font-[family-name:var(--font-display)]">
            UK Uni Match
          </span>
        </div>
        <p className="text-xs text-text-muted text-center sm:text-right max-w-md">
          Tuition, entry requirements, and scholarship info are estimates for
          planning purposes &mdash; always verify final figures on each
          university&apos;s official admissions page before applying.
        </p>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 text-center text-xs text-text-muted">
          Built by Aurtho Dutta &middot;{" "}
          <a
            href="mailto:dutta.aurtho@gmail.com"
            className="text-navy-light hover:text-navy transition-colors"
          >
            dutta.aurtho@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
