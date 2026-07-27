"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { IconPlus, IconEdit, IconTrash, IconSearch, IconExternalLink } from "../../components/icons";

const EMPTY_FORM = {
  name: "",
  city: "",
  min_gpa: "",
  min_ielts: "",
  annual_tuition_gbp: "",
  scholarship: "",
  intakes: "",
  courses: "",
  data_status: "Estimated - please verify",
  official_url: "",
};

function toFormValues(uni) {
  return {
    name: uni.name || "",
    city: uni.city || "",
    min_gpa: uni.min_gpa ?? "",
    min_ielts: uni.min_ielts ?? "",
    annual_tuition_gbp: uni.annual_tuition_gbp ?? "",
    scholarship: uni.scholarship || "",
    intakes: (uni.intakes || []).join(", "),
    courses: (uni.courses || []).join(", "),
    data_status: uni.data_status || "",
    official_url: uni.official_url || "",
  };
}

function toPayload(values) {
  return {
    name: values.name.trim(),
    city: values.city.trim(),
    min_gpa: values.min_gpa === "" ? null : Number(values.min_gpa),
    min_ielts: values.min_ielts === "" ? null : Number(values.min_ielts),
    annual_tuition_gbp: values.annual_tuition_gbp === "" ? null : Number(values.annual_tuition_gbp),
    scholarship: values.scholarship.trim(),
    intakes: values.intakes.split(",").map((s) => s.trim()).filter(Boolean),
    courses: values.courses.split(",").map((s) => s.trim()).filter(Boolean),
    data_status: values.data_status.trim(),
    official_url: values.official_url.trim(),
  };
}

function UniversityForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(toPayload(values));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-border rounded-lg p-4 space-y-3">
      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
          <input
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">City</label>
          <input
            required
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Min GPA (out of 5.0)</label>
          <input
            type="number"
            step="0.1"
            value={values.min_gpa}
            onChange={(e) => set("min_gpa", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Min IELTS</label>
          <input
            type="number"
            step="0.5"
            value={values.min_ielts}
            onChange={(e) => set("min_ielts", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Annual tuition (GBP)</label>
          <input
            type="number"
            value={values.annual_tuition_gbp}
            onChange={(e) => set("annual_tuition_gbp", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Data status</label>
          <input
            value={values.data_status}
            onChange={(e) => set("data_status", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">Scholarship</label>
          <input
            value={values.scholarship}
            onChange={(e) => set("scholarship", e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Intakes (comma-separated)</label>
          <input
            value={values.intakes}
            onChange={(e) => set("intakes", e.target.value)}
            placeholder="September, January"
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Courses (comma-separated)</label>
          <input
            value={values.courses}
            onChange={(e) => set("courses", e.target.value)}
            placeholder="Computer Science, Business & Management"
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">Official URL</label>
          <input
            value={values.official_url}
            onChange={(e) => set("official_url", e.target.value)}
            placeholder="https://www.example.ac.uk"
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium border border-border rounded-md px-4 py-2 hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const PAGE_SIZE = 40;

export default function AdminUniversitiesPage() {
  const [universities, setUniversities] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    api
      .get("/admin/universities")
      .then((data) => setUniversities(data.universities))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!universities) return [];
    const q = query.trim().toLowerCase();
    if (!q) return universities;
    return universities.filter(
      (u) => u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q)
    );
  }, [universities, query]);

  async function handleCreate(payload) {
    const data = await api.post("/admin/universities", payload);
    setUniversities(data.universities);
    setCreating(false);
  }

  async function handleUpdate(id, payload) {
    const data = await api.put(`/admin/universities/${id}`, payload);
    setUniversities(data.universities);
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this university? This can't be undone.")) return;
    try {
      const data = await api.delete(`/admin/universities/${id}`);
      setUniversities(data.universities);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Universities
        </h1>
        <button
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2 rounded-md transition-colors"
        >
          <IconPlus width={15} height={15} />
          Add university
        </button>
      </div>
      <p className="text-sm text-text-secondary mb-6">
        Every row here is served directly on the public site.
      </p>

      {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-4">{error}</p>}

      {creating && (
        <div className="mb-4">
          <UniversityForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
            submitLabel="Create"
          />
        </div>
      )}

      <div className="relative mb-4">
        <IconSearch width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or city…"
          className="focus-gold w-full sm:w-80 text-sm border border-border rounded-md pl-9 pr-3 py-2 bg-white"
        />
      </div>

      <div className="space-y-2">
        {filtered.slice(0, visibleCount).map((uni) =>
          editingId === uni.id ? (
            <UniversityForm
              key={uni.id}
              initial={toFormValues(uni)}
              onSubmit={(payload) => handleUpdate(uni.id, payload)}
              onCancel={() => setEditingId(null)}
              submitLabel="Save"
            />
          ) : (
            <div
              key={uni.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {uni.name}
                  {uni.official_url && (
                    <a
                      href={uni.official_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex ml-1.5 text-text-muted hover:text-gold-dark align-middle"
                      title={uni.official_url}
                    >
                      <IconExternalLink width={12} height={12} />
                    </a>
                  )}
                </p>
                <p className="text-xs text-text-muted">
                  {uni.city} · £{uni.annual_tuition_gbp?.toLocaleString()}/yr · GPA {uni.min_gpa}+ ·
                  IELTS {uni.min_ielts}+
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingId(uni.id);
                  setCreating(false);
                }}
                aria-label="Edit"
                className="shrink-0 text-text-muted hover:text-navy transition-colors"
              >
                <IconEdit width={16} height={16} />
              </button>
              <button
                onClick={() => handleDelete(uni.id)}
                aria-label="Delete"
                className="shrink-0 text-text-muted hover:text-danger transition-colors"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
          )
        )}
      </div>

      {filtered.length > visibleCount && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="text-sm font-semibold border border-border bg-surface hover:bg-background px-5 py-2.5 rounded-md transition-colors"
          >
            Show more ({filtered.length - visibleCount} left)
          </button>
        </div>
      )}
    </div>
  );
}
