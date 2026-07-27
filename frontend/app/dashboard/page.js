"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { api } from "../lib/api";
import { IconTarget, IconCalendar, IconBook, IconArrowRight } from "../components/icons";

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get("/me/favorites"), api.get("/me/todos"), api.get("/me/requirements")]).then(
      ([favorites, todos, requirements]) => {
        if (cancelled) return;
        setStats({
          favorites: favorites.favorites.length,
          todosOpen: todos.todos.filter((t) => !t.is_done).length,
          requirementsOpen: requirements.requirements.filter((r) => !r.is_ready).length,
        });
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      href: "/dashboard/favorites",
      icon: IconTarget,
      label: "Favorited universities",
      value: stats?.favorites,
    },
    {
      href: "/dashboard/todos",
      icon: IconCalendar,
      label: "Open to-do items",
      value: stats?.todosOpen,
    },
    {
      href: "/dashboard/requirements",
      icon: IconBook,
      label: "Documents still needed",
      value: stats?.requirementsOpen,
    },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Welcome back
      </h1>
      <p className="text-sm text-text-secondary mb-8">{user?.email}</p>

      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map(({ href, icon: Icon, label, value }) => (
          <Link
            key={href}
            href={href}
            className="card-hover bg-surface border border-border rounded-xl p-5 flex flex-col gap-3"
          >
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-navy/5 text-navy-light">
              <Icon width={18} height={18} />
            </span>
            <div>
              <p className="text-2xl font-semibold text-text-primary">
                {value === undefined ? "—" : value}
              </p>
              <p className="text-sm text-text-secondary">{label}</p>
            </div>
            <span className="text-xs text-gold-dark flex items-center gap-1 mt-auto">
              View <IconArrowRight width={12} height={12} />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-surface border border-border rounded-xl p-5">
        <p className="text-sm text-text-secondary">
          Looking for more universities?{" "}
          <Link href="/#match-form" className="text-gold-dark hover:underline font-medium">
            Run a new search
          </Link>{" "}
          — matches you find there are saved to your search history automatically.
        </p>
      </div>
    </div>
  );
}
