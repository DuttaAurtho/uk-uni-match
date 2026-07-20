"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [form, setForm] = useState({
    gpa: "",
    ielts: "",
    budget: "",
    course: "",
    city: "",
  });
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [courses, setCourses] = useState([]);
  const [cities, setCities] = useState([]);

  // Load course/city options once, for the dropdowns
  useEffect(() => {
    async function loadFilters() {
      try {
        const [coursesRes, citiesRes] = await Promise.all([
          fetch(`${API_URL}/courses`),
          fetch(`${API_URL}/cities`),
        ]);
        const coursesData = await coursesRes.json();
        const citiesData = await citiesRes.json();
        setCourses(coursesData.courses || []);
        setCities(citiesData.cities || []);
      } catch (err) {
        // Non-fatal — filters just won't be populated
        console.error("Failed to load filter options", err);
      }
    }
    loadFilters();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");

    const params = new URLSearchParams();
    if (form.gpa) params.set("gpa", form.gpa);
    if (form.ielts) params.set("ielts", form.ielts);
    if (form.budget) params.set("budget", form.budget);
    if (form.course) params.set("course", form.course);
    if (form.city) params.set("city", form.city);

    try {
      const res = await fetch(`${API_URL}/universities?${params.toString()}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setResults(data.results);
      setStatus("success");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase mb-4">
            For Bangladeshi students applying to the UK
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl leading-tight max-w-2xl">
            Find out which UK universities actually fit your GPA, IELTS, and
            budget.
          </h1>
          <p className="mt-5 text-white/70 max-w-xl leading-relaxed">
            No more digging through ten different admissions pages. Enter
            your numbers once, and see every university you&apos;re
            realistically eligible for.
          </p>
        </div>
      </section>

      {/* Form + Results */}
      <section className="mx-auto max-w-5xl px-6 py-12 grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="h-fit lg:sticky lg:top-8 bg-surface border border-border rounded-lg p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="gpa">
              HSC / GPA <span className="text-text-secondary">(out of 5.0)</span>
            </label>
            <input
              id="gpa"
              name="gpa"
              type="number"
              step="0.01"
              min="0"
              max="5"
              required
              value={form.gpa}
              onChange={handleChange}
              placeholder="e.g. 4.50"
              className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="ielts">
              IELTS overall band
            </label>
            <input
              id="ielts"
              name="ielts"
              type="number"
              step="0.5"
              min="0"
              max="9"
              required
              value={form.ielts}
              onChange={handleChange}
              placeholder="e.g. 6.0"
              className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="budget">
              Max budget <span className="text-text-secondary">(£/year tuition)</span>
            </label>
            <input
              id="budget"
              name="budget"
              type="number"
              step="500"
              min="0"
              required
              value={form.budget}
              onChange={handleChange}
              placeholder="e.g. 15000"
              className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="course">
              Course / subject{" "}
              <span className="text-text-secondary">(optional)</span>
            </label>
            <select
              id="course"
              name="course"
              value={form.course}
              onChange={handleChange}
              className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white"
            >
              <option value="">Any course</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="city">
              City / region <span className="text-text-secondary">(optional)</span>
            </label>
            <select
              id="city"
              name="city"
              value={form.city}
              onChange={handleChange}
              className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white"
            >
              <option value="">Any city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-gold hover:bg-gold-dark transition-colors text-navy font-semibold py-2.5 rounded-md disabled:opacity-60"
          >
            {status === "loading" ? "Searching…" : "Find my universities"}
          </button>
        </form>

        {/* Results */}
        <div>
          {status === "idle" && (
            <div className="border border-dashed border-border rounded-lg p-10 text-center text-text-secondary">
              Fill in the form and hit{" "}
              <span className="font-medium text-text-primary">
                Find my universities
              </span>{" "}
              to see your matches.
            </div>
          )}

          {status === "error" && (
            <div className="border border-border rounded-lg p-6 bg-white text-text-secondary">
              Couldn&apos;t reach the backend. Make sure the FastAPI server is
              running at{" "}
              <code className="font-mono text-sm bg-background px-1.5 py-0.5 rounded">
                {API_URL}
              </code>
              .
            </div>
          )}

          {status === "success" && (
            <>
              <p className="font-[family-name:var(--font-display)] text-2xl mb-6">
                <span className="text-gold-dark">{results.length}</span>{" "}
                {results.length === 1 ? "university matches" : "universities match"}{" "}
                your profile
              </p>

              {results.length === 0 && (
                <div className="border border-dashed border-border rounded-lg p-10 text-center text-text-secondary">
                  No matches yet — try lowering your IELTS requirement,
                  raising your budget, or clearing the course/city filter.
                </div>
              )}

              <div className="space-y-4">
                {results.map((uni) => (
                  <article
                    key={uni.id}
                    className="bg-surface border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] text-xl">
                        {uni.name}
                      </h2>
                      <p className="text-sm text-text-secondary mt-0.5">
                        {uni.city}
                      </p>
                      <p className="text-sm text-success bg-success-bg inline-block px-2 py-0.5 rounded mt-2">
                        {uni.scholarship}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {uni.intakes.map((m) => (
                          <span
                            key={m}
                            className="font-mono text-xs border border-border rounded px-2 py-0.5 text-text-secondary"
                          >
                            {m} intake
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {uni.courses.map((c) => (
                          <span
                            key={c}
                            className="font-mono text-xs bg-background rounded px-2 py-0.5 text-text-secondary"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg">
                        £{uni.annual_tuition_gbp.toLocaleString()}
                      </p>
                      <p className="text-xs text-text-secondary">per year</p>
                      <p className="text-xs text-text-secondary mt-2">
                        Needs GPA {uni.min_gpa}+ · IELTS {uni.min_ielts}+
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}