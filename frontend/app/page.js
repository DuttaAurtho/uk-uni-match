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
        const [coursesRes, citiesRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/courses`),
          fetch(`${API_URL}/cities`),
          fetch(`${API_URL}/stats`),
        ]);
        const coursesData = await coursesRes.json();
        const citiesData = await citiesRes.json();
        const statsData = await statsRes.json();
        setCourses(coursesData.courses || []);
        setCities(citiesData.cities || []);
        setStats(statsData);
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

  function handleReset() {
    setForm((prev) => ({ ...prev, course: "", city: "" }));
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
        <Hero stats={stats} onStart={scrollToForm} />
        <HowItWorks />

        <section className="mx-auto max-w-5xl px-6 pb-20 grid gap-8 lg:grid-cols-[340px_1fr]">
          <MatchForm
            form={form}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onReset={handleReset}
            courses={courses}
            cities={cities}
            status={status}
          />
          <div>
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
      </main>

      <UniversityDetailModal
        key={selectedUniversity ? selectedUniversity.id : "none"}
        university={selectedUniversity}
        course={form.course}
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
