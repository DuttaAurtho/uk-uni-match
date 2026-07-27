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
  levels: "BSc, MSc",
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
    levels: (uni.levels || []).join(", "),
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
    levels: values.levels.split(",").map((s) => s.trim()).filter(Boolean),
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
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Degree levels (comma-separated) — drives the BSc/MSc search filter
          </label>
          <input
            value={values.levels}
            onChange={(e) => set("levels", e.target.value)}
            placeholder="BSc, MSc"
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

/** Read a university's own page and pull figures out of it.
 *
 *  Two steps by design. The server tries to fetch the URL itself; when the
 *  site blocks scripts or builds its fees table in JavaScript — both common —
 *  it says so and asks for the page text, which the admin's own browser can
 *  always supply. Whatever it finds is shown with the sentence it came from
 *  and saved only on confirmation, because an unlabelled figure on a fees
 *  page is as likely to be a home fee as an international one.
 */
function ImportPanel({ uni, onImported, onClose }) {
  const [url, setUrl] = useState(uni.official_url || "");
  const [pageText, setPageText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(apply) {
    setBusy(true);
    setError("");
    try {
      const data = await api.post(
        `/admin/universities/${uni.id}/import-official`,
        { url: url.trim(), page_text: pageText.trim() || null, apply }
      );
      setResult(data);
      if (data.applied) onImported(data.universities);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const proposal = result?.proposal || {};
  const needsPaste = result && !result.ok && result.source !== "pasted";

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-text-primary">
          Import figures from {uni.name}&apos;s own page
        </p>
        <button onClick={onClose} className="text-xs link-blue">
          Close
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Page URL — the international fees or entry-requirements page
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.example.ac.uk/international/fees"
          className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white"
        />
        <p className="text-[11px] text-text-muted mt-1">
          A course page often works better than a central fees page — that&apos;s
          usually where the actual number lives.
        </p>
      </div>

      {(needsPaste || pageText) && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Page text — open the URL, select all, paste here
          </label>
          <textarea
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
            rows={5}
            placeholder="Paste the page content…"
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2 bg-white font-mono"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2">{error}</p>
      )}

      {result && !result.ok && (
        <p className="text-sm text-gold-dark bg-gold/10 border border-gold/30 rounded-md px-3 py-2">
          {result.reason}
        </p>
      )}

      {result?.ok && (
        <div className="bg-surface border border-border rounded-md p-3 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">
            Found on the page ({result.source}, {result.chars} chars)
            {!result.confident && (
              <span className="ml-2 text-gold-dark">
                — no sentence said &quot;international&quot;, so check these are not home fees
              </span>
            )}
          </p>
          {proposal.tuition_min_gbp != null && (
            <p className="text-sm">
              <span className="font-bold">
                £{proposal.tuition_min_gbp.toLocaleString()}–£
                {proposal.tuition_max_gbp.toLocaleString()}
              </span>{" "}
              <span className="text-text-secondary">per year</span>
            </p>
          )}
          {proposal.min_ielts != null && (
            <p className="text-sm">
              IELTS <span className="font-bold">{proposal.min_ielts}</span>
            </p>
          )}
          {Object.entries(result.field_sources || {})
            .filter(([f]) => f === "annual_tuition_gbp" || f === "min_ielts")
            .map(([field, src]) => (
              <blockquote
                key={field}
                className="card-blurb text-xs text-text-secondary italic"
              >
                “{src.quote}”
              </blockquote>
            ))}
          {result.applied && (
            <p className="text-sm font-semibold text-success">Saved with its source.</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => run(false)}
          disabled={busy || !url.trim()}
          className="text-sm font-semibold border border-border bg-white hover:bg-background px-4 py-2 rounded-md transition-colors disabled:opacity-50"
        >
          {busy ? "Reading…" : "Read page"}
        </button>
        {result?.ok && !result.applied && (
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="text-sm font-semibold bg-gold hover:bg-gold-dark text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            Save these figures
          </button>
        )}
      </div>
    </div>
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
  const [importingId, setImportingId] = useState(null);

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
            <div key={uni.id} className="space-y-2">
              <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3">
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
                  {uni.city} ·{" "}
                  {uni.tuition_min_gbp && uni.tuition_max_gbp
                    ? `£${uni.tuition_min_gbp.toLocaleString()}–£${uni.tuition_max_gbp.toLocaleString()}`
                    : `£${uni.annual_tuition_gbp?.toLocaleString()}`}
                  /yr · GPA {uni.min_gpa}+ · IELTS {uni.min_ielts}+
                  {Object.keys(uni.field_sources || {}).length > 0 ? (
                    <span className="ml-1.5 text-success font-medium">· sourced</span>
                  ) : (
                    <span className="ml-1.5">· estimate</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setImportingId(importingId === uni.id ? null : uni.id);
                  setEditingId(null);
                }}
                title="Import figures from the university's own page"
                className="shrink-0 text-xs font-semibold text-navy-light hover:underline"
              >
                Import
              </button>
              <button
                onClick={() => {
                  setEditingId(uni.id);
                  setCreating(false);
                  setImportingId(null);
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
              {importingId === uni.id && (
                <ImportPanel
                  uni={uni}
                  onImported={setUniversities}
                  onClose={() => setImportingId(null)}
                />
              )}
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
