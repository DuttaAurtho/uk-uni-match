"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { IconBook, IconChat, IconArrowRight } from "../components/icons";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/admin/universities"), api.get("/admin/users"), api.get("/admin/chat/threads")]).then(
      ([unis, users, threads]) => {
        setStats({
          universities: unis.universities.length,
          users: users.users.length,
          unread: threads.threads.reduce((sum, t) => sum + t.unread_count, 0),
        });
      }
    );
  }, []);

  const cards = [
    { href: "/admin/universities", icon: IconBook, label: "Universities in the dataset", value: stats?.universities },
    { href: "/admin/users", icon: IconChat, label: "Registered users", value: stats?.users },
    { href: "/admin/users", icon: IconChat, label: "Unread messages", value: stats?.unread },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Admin overview
      </h1>
      <p className="text-sm text-text-secondary mb-8">Manage the dataset and talk to users.</p>

      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map(({ href, icon: Icon, label, value }, i) => (
          <Link
            key={i}
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
    </div>
  );
}
