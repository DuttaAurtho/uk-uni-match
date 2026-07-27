"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconGraduationCap, IconChevronDown } from "./icons";
import { useAuth } from "../lib/AuthContext";
import { avatarUrl } from "../lib/api";

export default function Header() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/");
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

        {loading ? (
          <div className="w-24 h-9" />
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            >
              <img
                src={avatarUrl(user.avatar_seed)}
                alt=""
                className="w-8 h-8 rounded-full bg-white/10 border border-white/20"
              />
              <IconChevronDown width={14} height={14} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-lg border border-border py-1.5 z-20 animate-fade-in">
                  <p className="px-3 py-1.5 text-xs text-text-muted truncate">{user.email}</p>
                  <Link
                    href={user.role === "admin" ? "/admin" : "/dashboard"}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                  >
                    {user.role === "admin" ? "Admin panel" : "Dashboard"}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-background transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2 rounded-md transition-colors"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
