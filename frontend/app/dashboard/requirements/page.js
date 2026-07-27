"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { IconBook, IconCheck, IconTrash, IconPlus } from "../../components/icons";

function RequirementsView() {
  const params = useSearchParams();
  const [favorites, setFavorites] = useState(null);
  const [universityId, setUniversityId] = useState(params.get("university_id") || "");
  const [requirements, setRequirements] = useState([]);
  const [docName, setDocName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/me/favorites")
      .then((data) => {
        setFavorites(data.favorites);
        if (!universityId && data.favorites.length > 0) {
          setUniversityId(String(data.favorites[0].id));
        }
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!universityId) return;
    api
      .get(`/me/requirements?university_id=${universityId}`)
      .then((data) => setRequirements(data.requirements))
      .catch((err) => setError(err.message));
  }, [universityId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!docName.trim() || !universityId) return;
    try {
      const data = await api.post("/me/requirements", {
        university_id: Number(universityId),
        document_name: docName.trim(),
      });
      setRequirements(data.requirements);
      setDocName("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(req) {
    try {
      await api.patch(`/me/requirements/${req.id}`, { is_ready: !req.is_ready });
      setRequirements((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, is_ready: !r.is_ready } : r))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      const data = await api.delete(`/me/requirements/${id}`);
      setRequirements(data.requirements);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Document requirements
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Track the documents you need for each application.
      </p>

      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-4">{error}</p>}

      {favorites?.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <IconBook width={28} height={28} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            Favorite a university first from{" "}
            <Link href="/dashboard/favorites" className="text-gold-dark hover:underline font-medium">
              your favorites
            </Link>{" "}
            to start tracking its requirements.
          </p>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium text-text-primary mb-1.5">University</label>
          <select
            value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
            className="focus-gold w-full sm:w-80 text-sm border border-border rounded-md px-3 py-2.5 bg-white mb-6"
          >
            {favorites?.map((uni) => (
              <option key={uni.id} value={uni.id}>
                {uni.name}
              </option>
            ))}
          </select>

          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. IELTS certificate, personal statement…"
              className="focus-gold flex-1 text-sm border border-border rounded-md px-3 py-2.5 bg-white"
            />
            <button
              type="submit"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors"
            >
              <IconPlus width={15} height={15} />
              Add
            </button>
          </form>

          <div className="space-y-2">
            {requirements.length === 0 && (
              <p className="text-sm text-text-secondary text-center py-8">
                No documents tracked yet for this university.
              </p>
            )}
            {requirements.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3"
              >
                <button
                  onClick={() => handleToggle(req)}
                  aria-label={req.is_ready ? "Mark as not ready" : "Mark as ready"}
                  className={`shrink-0 grid place-items-center w-5 h-5 rounded border transition-colors ${
                    req.is_ready
                      ? "bg-success border-success text-white"
                      : "border-border text-transparent"
                  }`}
                >
                  <IconCheck width={12} height={12} />
                </button>
                <p
                  className={`flex-1 text-sm ${
                    req.is_ready ? "line-through text-text-muted" : "text-text-primary"
                  }`}
                >
                  {req.document_name}
                </p>
                <button
                  onClick={() => handleDelete(req.id)}
                  aria-label="Remove"
                  className="shrink-0 text-text-muted hover:text-danger transition-colors"
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function RequirementsPage() {
  return (
    <Suspense>
      <RequirementsView />
    </Suspense>
  );
}
