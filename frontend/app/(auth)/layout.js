import Link from "next/link";
import Logo from "../components/Logo";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <div className="hero-grid absolute inset-0 pointer-events-none" />
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link
          href="/"
          className="text-white mb-8 group hover:opacity-90 transition-opacity"
        >
          <Logo size={46} inverse tagline />
        </Link>

        <div className="w-full max-w-md bg-surface rounded-xl shadow-lg border border-white/10 p-8 animate-pop-in">
          {children}
        </div>
      </div>
    </div>
  );
}
