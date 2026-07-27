"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "../components/Header";
import { useAuth } from "../lib/AuthContext";
import { IconInbox, IconChat, IconBook, IconSpinner } from "../components/icons";

const NAV = [
  { href: "/admin", label: "Overview", icon: IconInbox, exact: true },
  { href: "/admin/universities", label: "Universities", icon: IconBook },
  { href: "/admin/users", label: "Users & chat", icon: IconChat },
];

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, user, pathname, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <IconSpinner width={24} height={24} className="text-navy animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1 flex flex-col md:flex-row gap-8">
        <aside className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-navy text-white"
                      : "text-text-secondary hover:bg-white hover:text-text-primary"
                  }`}
                >
                  <Icon width={16} height={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
