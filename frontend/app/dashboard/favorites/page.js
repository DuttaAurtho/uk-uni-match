"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { IconTarget, IconTrash, IconBook } from "../../components/icons";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/me/favorites")
      .then((data) => setFavorites(data.favorites))
      .catch((err) => setError(err.message));
  }, []);

  async function handleRemove(id) {
    try {
      const data = await api.delete(`/me/favorites/${id}`);
      setFavorites(data.favorites);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Favorites
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Universities you&apos;ve whitelisted from your search results.
      </p>

      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-4">{error}</p>}

      {favorites?.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <IconTarget width={28} height={28} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            No favorites yet.{" "}
            <Link href="/#match-form" className="text-gold-dark hover:underline font-medium">
              Search universities
            </Link>{" "}
            and star the ones you like.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {favorites?.map((uni) => (
          <div key={uni.id} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-medium text-text-primary">{uni.name}</h2>
                <p className="text-xs text-text-muted">{uni.city}</p>
              </div>
              <button
                onClick={() => handleRemove(uni.id)}
                aria-label="Remove favorite"
                className="shrink-0 text-text-muted hover:text-danger transition-colors"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
              <span>£{uni.annual_tuition_gbp?.toLocaleString()}/yr</span>
              <span>IELTS {uni.min_ielts}+</span>
            </div>
            <Link
              href={`/dashboard/requirements?university_id=${uni.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-gold-dark hover:underline mt-3"
            >
              <IconBook width={13} height={13} />
              Track document requirements
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
