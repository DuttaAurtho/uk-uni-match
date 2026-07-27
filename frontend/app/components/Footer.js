import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-12">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo size={38} tagline className="text-text-primary" />
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
