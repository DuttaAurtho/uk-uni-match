import Link from "next/link";
import { IconGraduationCap } from "../components/icons";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <div className="hero-grid absolute inset-0 pointer-events-none" />
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="flex items-center gap-2.5 text-white mb-8 group">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 text-gold group-hover:bg-gold/25 transition-colors">
            <IconGraduationCap width={17} height={17} />
          </span>
          <span className="font-[family-name:var(--font-display)] text-lg tracking-wide">
            UK Uni Match
          </span>
        </Link>

        <div className="w-full max-w-md bg-surface rounded-xl shadow-lg border border-white/10 p-8 animate-pop-in">
          {children}
        </div>
      </div>
    </div>
  );
}
