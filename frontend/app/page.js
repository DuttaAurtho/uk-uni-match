"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import MatchForm from "./components/MatchForm";
import ResultsList from "./components/ResultsList";
import UniversityDetailModal from "./components/UniversityDetailModal";
import ChatWidget from "./components/ChatWidget";
import Footer from "./components/Footer";
import { useAuth } from "./lib/AuthContext";
import { api } from "./lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const EMPTY_FORM = {
  gpa: "",
  ielts: "",
  budget: "",
  course: "",
  city: "",
  q: "",
  level: "",
  intake: "",
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [results, setResults] = useState(null);
  const [source, setSource] = useState(null); // "gemini" | "fallback"
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [courses, setCourses] = useState([]);
  const [cities, setCities] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [levels, setLevels] = useState([]);
  const [universityNames, setUniversityNames] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  // Favorites are only meaningful once we know who's logged in.
  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    api
      .get("/me/favorites")
      .then((data) => setFavoriteIds(new Set(data.favorites.map((f) => f.id))))
      .catch(() => {});
  }, [user]);

  async function handleToggleFavorite(uni) {
    if (!user) {
      router.push("/login?next=/");
      return;
    }
    const alreadyFavorited = favoriteIds.has(uni.id);
    try {
      if (alreadyFavorited) {
        await api.delete(`/me/favorites/${uni.id}`);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(uni.id);
          return next;
        });
      } else {
        await api.post("/me/favorites", { university_id: uni.id });
        setFavoriteIds((prev) => new Set(prev).add(uni.id));
      }
    } catch (err) {
      console.error("Failed to update favorite", err);
    }
  }

  // Load course/city options once, for the dropdowns
  useEffect(() => {
    async function loadFilters() {
      try {
        const [courses, cities, intakes, levels, names, stats] =
          await Promise.all(
            [
              "/courses",
              "/cities",
              "/intakes",
              "/levels",
              "/university-names",
              "/stats",
            ].map((path) => fetch(`${API_URL}${path}`).then((r) => r.json()))
          );
        setCourses(courses.courses || []);
        setCities(cities.cities || []);
        setIntakes(intakes.intakes || []);
        setLevels(levels.levels || []);
        setUniversityNames(names.names || []);
        setStats(stats);
      } catch (err) {
        // Non-fatal — filters just won't be populated
        console.error("Failed to load filter options", err);
      }
    }
    loadFilters();
  }, []);

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const runSearch = useCallback(async (activeForm) => {
    setStatus("loading");

    const params = new URLSearchParams();
    if (activeForm.gpa) params.set("gpa", activeForm.gpa);
    if (activeForm.ielts) params.set("ielts", activeForm.ielts);
    if (activeForm.budget) params.set("budget", activeForm.budget);
    if (activeForm.course) params.set("course", activeForm.course);
    if (activeForm.city) params.set("city", activeForm.city);
    if (activeForm.q) params.set("q", activeForm.q.trim());
    if (activeForm.level) params.set("level", activeForm.level);
    if (activeForm.intake) params.set("intake", activeForm.intake);

    try {
      const res = await fetch(`${API_URL}/universities?${params.toString()}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setResults(data.results);
      setSource(data.source || null);
      setStatus("success");
    } catch (err) {
      setStatus("error");
    }
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(form);
  }

  function handleHeroSearch(overrideQuery) {
    // Picking a suggestion passes its name through directly — `form` here is
    // this render's snapshot, so it still holds whatever was typed before.
    runSearch(
      typeof overrideQuery === "string" ? { ...form, q: overrideQuery } : form
    );
    // The hero fills the viewport, so a search from up there has to take the
    // user down to what it found.
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleReset() {
    setForm((prev) => ({
      ...prev,
      course: "",
      city: "",
      q: "",
      level: "",
      intake: "",
    }));
  }

  function scrollToForm() {
    document
      .getElementById("match-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero
          stats={stats}
          onStart={scrollToForm}
          q={form.q}
          onQChange={(v) => handleChange("q", v)}
          onSearch={handleHeroSearch}
          universityNames={universityNames}
        />
        {/* Results lead, explainer follows: on a portal the listing is the
            page, not something you scroll past marketing to reach. */}
        <section className="mx-auto max-w-6xl px-6 py-8 grid gap-6 lg:grid-cols-[300px_1fr]">
          <MatchForm
            form={form}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onReset={handleReset}
            courses={courses}
            cities={cities}
            intakes={intakes}
            levels={levels}
            status={status}
          />
          <div id="results" className="scroll-mt-24">
            <ResultsList
              status={status}
              results={results}
              form={form}
              source={source}
              onRetry={() => runSearch(form)}
              onSelectUniversity={setSelectedUniversity}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        </section>

        <HowItWorks />
      </main>

      <UniversityDetailModal
        key={selectedUniversity ? selectedUniversity.id : "none"}
        university={selectedUniversity}
        course={form.course}
        level={form.level}
        onClose={() => setSelectedUniversity(null)}
        onAskAi={() => setChatOpen(true)}
      />
      <ChatWidget
        open={chatOpen}
        onOpenChange={setChatOpen}
        profile={form}
        university={selectedUniversity}
      />

      <Footer />
    </>
  );
}
