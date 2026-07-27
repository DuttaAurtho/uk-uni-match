"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import ChatWidget from "../../components/ChatWidget";
import {
  IconAlert,
  IconAward,
  IconCalendar,
  IconChat,
  IconCheck,
  IconExternalLink,
  IconGraduationCap,
  IconPin,
  IconStar,
  IconWallet,
} from "../../components/icons";
import { api, API_URL } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";

// The written sections, in the order a student actually works through them:
// what it is, whether they'd get in, what it costs, then the admin of applying.
const SECTIONS = [
  ["overview", "Overview"],
  ["entry_requirements", "Entry requirements"],
  ["tuition_breakdown", "Tuition & living costs"],
  ["scholarships", "Scholarships"],
  ["application_deadlines", "Deadlines & process"],
  ["notable_strengths", "Notable strengths"],
  ["visa_notes", "Visa (CAS) notes"],
];

/** One row of the fit analysis: where the student stands against a
 *  requirement, as a bar plus the margin in words. This is the part no
 *  course-listing site can show — it needs the numbers from the search. */
function FitRow({ label, you, needs, unit = "", higherIsBetter = true, format }) {
  if (you == null || Number.isNaN(you) || needs == null) return null;

  const show = format || ((v) => `${unit}${v}`);
  const clears = higherIsBetter ? you >= needs : you <= needs;
  const margin = higherIsBetter ? you - needs : needs - you;
  // Scale the bar against the requirement, capped so a huge budget doesn't
  // squash the interesting part of the range.
  const pct = Math.max(4, Math.min(100, (you / Math.max(needs, 1)) * 62));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className={`font-semibold ${clears ? "text-success" : "text-danger"}`}>
          {show(you)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full ${clears ? "bg-success" : "bg-danger"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {clears ? "Clears" : "Short of"} {show(needs)} by{" "}
        {show(Math.abs(Number(margin.toFixed(2))))}
      </p>
    </div>
  );
}

function StatRow({ label, value, suffix = "" }) {
  if (value == null) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-bold text-text-primary">
        {typeof value === "number" ? Math.round(value).toLocaleString() : value}
        {suffix}
      </span>
    </div>
  );
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="px-4 py-3">
      <p className="fact-label flex items-center gap-1.5">
        {Icon && <Icon width={12} height={12} />}
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-text-primary">{value}</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <>
      <Header />
      <main className="flex-1 mx-auto max-w-6xl px-6 py-10 space-y-4 w-full">
        <div className="skeleton h-8 w-2/3 rounded" />
        <div className="skeleton h-24 w-full rounded" />
        <div className="skeleton h-64 w-full rounded" />
      </main>
      <Footer />
    </>
  );
}

// useSearchParams needs a Suspense boundary above it, or the whole route
// opts out of static rendering at build time.
export default function UniversityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UniversityPageInner />
    </Suspense>
  );
}

function UniversityPageInner() {
  const { id } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();

  const [uni, setUni] = useState(null);
  const [uniStatus, setUniStatus] = useState("loading");
  const [details, setDetails] = useState(null);
  const [detailStatus, setDetailStatus] = useState("loading");
  const [isFavorited, setIsFavorited] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [saved, setSaved] = useState("");

  // The search that led here, carried in the URL so the fit panel can show
  // this student's numbers against this university's requirements.
  const profile = useMemo(
    () => ({
      gpa: search.get("gpa") || "",
      ielts: search.get("ielts") || "",
      budget: search.get("budget") || "",
      course: search.get("course") || "",
      level: search.get("level") || "",
      intake: search.get("intake") || "",
    }),
    [search]
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/universities/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setUni(data.university);
        setUniStatus("success");
      })
      .catch(() => !cancelled && setUniStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The written profile is a separate, slower lookup — the stored facts above
  // render immediately rather than waiting on it.
  useEffect(() => {
    if (!uni) return;
    let cancelled = false;
    fetch(`${API_URL}/universities/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: uni.name,
        city: uni.city,
        course: profile.course || null,
        level: profile.level || null,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setDetailStatus("success");
      })
      .catch(() => !cancelled && setDetailStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [uni, profile.course, profile.level]);

  useEffect(() => {
    if (!user || !uni) return;
    let cancelled = false;
    api
      .get("/me/favorites")
      .then((data) => {
        if (!cancelled) {
          setIsFavorited(data.favorites.some((f) => f.id === uni.id));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, uni]);

  const toggleFavorite = useCallback(async () => {
    if (!user) {
      router.push(`/login?next=/university/${id}`);
      return;
    }
    try {
      if (isFavorited) {
        await api.delete(`/me/favorites/${uni.id}`);
        setIsFavorited(false);
      } else {
        await api.post("/me/favorites", { university_id: uni.id });
        setIsFavorited(true);
      }
    } catch {
      /* non-fatal — the button just doesn't flip */
    }
  }, [user, uni, isFavorited, id, router]);

  async function addToChecklist() {
    if (!user) {
      router.push(`/login?next=/university/${id}`);
      return;
    }
    try {
      await api.post("/me/todos", {
        title: `Apply to ${uni.name}${profile.course ? ` — ${profile.course}` : ""}`,
        university_id: uni.id,
      });
      setSaved("Added to your to-do list");
    } catch {
      setSaved("Couldn't add that right now");
    }
  }

  if (uniStatus === "error") {
    return (
      <>
        <Header />
        <main className="flex-1 mx-auto max-w-3xl px-6 py-24 text-center">
          <IconAlert width={30} height={30} className="mx-auto mb-4 text-danger" />
          <h1 className="text-xl font-bold">University not found</h1>
          <p className="text-sm text-text-secondary mt-2">
            It may have been removed from the dataset.
          </p>
          <Link href="/" className="link-blue text-sm mt-5 inline-block">
            ← Back to search
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  if (uniStatus === "loading" || !uni) {
    return (
      <>
        <Header />
        <main className="flex-1 mx-auto max-w-6xl px-6 py-10 space-y-4">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-24 w-full rounded" />
          <div className="skeleton h-64 w-full rounded" />
        </main>
        <Footer />
      </>
    );
  }

  const live =
    typeof uni.data_status === "string" && uni.data_status.startsWith("Live data");
  const levels = uni.levels?.length ? uni.levels : [];
  const heading = [profile.level, profile.course].filter(Boolean).join(" ");
  const num = (v) => (v === "" || v == null ? null : Number(v));

  return (
    <>
      <Header />

      {/* Identity band. The portal opens on white; leading with the deep blue
          keeps this page recognisably part of *this* site. */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-7">
          <nav aria-label="Breadcrumb" className="text-xs text-white/60 mb-3">
            <Link href="/" className="hover:text-white">
              Search
            </Link>
            <span className="mx-1.5">›</span>
            <span>{uni.city}</span>
            <span className="mx-1.5">›</span>
            <span className="text-white">{uni.name}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                {uni.name}
              </h1>
              <p className="mt-1 text-white/75 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <IconPin width={13} height={13} />
                  {uni.city}, United Kingdom
                </span>
                {heading && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconGraduationCap width={13} height={13} />
                    {heading}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                    live ? "bg-success text-white" : "bg-white/15 text-white/80"
                  }`}
                >
                  {live ? "Live data" : "Estimated figures"}
                </span>
              </p>
            </div>

            <button
              onClick={toggleFavorite}
              className={`inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-semibold transition-colors ${
                isFavorited
                  ? "bg-gold text-white hover:bg-gold-dark"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <IconStar
                width={15}
                height={15}
                fill={isFavorited ? "currentColor" : "none"}
              />
              {isFavorited ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1">
        {/* Facts first, prose second — the one habit from the reference worth
            keeping outright. */}
        <div className="border-b border-border bg-surface">
          <dl className="mx-auto max-w-6xl px-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border">
            <Fact
              icon={IconWallet}
              label="Tuition"
              value={`£${Number(uni.annual_tuition_gbp || 0).toLocaleString()}/yr`}
            />
            <Fact icon={IconGraduationCap} label="Degree levels" value={levels.join(" · ") || "—"} />
            <Fact icon={IconChat} label="Min IELTS" value={uni.min_ielts ?? "—"} />
            <Fact icon={IconAward} label="Min GPA" value={uni.min_gpa ?? "—"} />
            <Fact
              icon={IconCalendar}
              label="Intakes"
              value={(uni.intakes || []).join(", ") || "—"}
            />
          </dl>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ---- Written profile -------------------------------------- */}
          <div className="min-w-0 order-2 lg:order-1">
            {detailStatus === "loading" && (
              <div className="space-y-4">
                <p className="text-xs text-text-muted">
                  Researching this university live…
                </p>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-surface border border-border rounded-md p-5 space-y-3">
                    <div className="skeleton h-4 w-1/3 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-5/6 rounded" />
                  </div>
                ))}
              </div>
            )}

            {detailStatus === "error" && (
              <div className="bg-surface border border-danger/30 rounded-md p-6 text-center">
                <IconAlert width={24} height={24} className="mx-auto mb-2 text-danger" />
                <p className="text-sm text-text-secondary">
                  Couldn&apos;t load the written profile. The figures above are
                  still accurate — check the official site for the rest.
                </p>
              </div>
            )}

            {detailStatus === "success" && details && (
              <div className="space-y-4">
                {details.source && details.source !== "gemini" && (
                  <p className="text-xs font-medium text-gold-dark bg-gold/10 border border-gold/30 rounded px-3 py-2">
                    {details.source === "fallback"
                      ? "Live lookup unavailable — showing offline estimated data"
                      : "Live details unavailable right now"}
                  </p>
                )}

                {SECTIONS.map(([key, label]) =>
                  details[key] ? (
                    <section
                      key={key}
                      id={key}
                      className="scroll-mt-20 bg-surface border border-border border-l-2 border-l-navy-light rounded-md p-5"
                    >
                      <h2 className="text-base font-bold text-text-primary">
                        {label}
                      </h2>
                      <p className="mt-2 text-sm text-text-primary leading-relaxed">
                        {details[key]}
                      </p>
                    </section>
                  ) : null
                )}

                {uni.courses?.length > 0 && (
                  <section className="bg-surface border border-border border-l-2 border-l-navy-light rounded-md p-5">
                    <h2 className="text-base font-bold text-text-primary">
                      Subject areas taught
                    </h2>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {uni.courses.map((c) => (
                        <span
                          key={c}
                          className="text-xs bg-background border border-border rounded px-2 py-1 text-text-secondary"
                        >
                          {profile.level ? `${profile.level} ${c}` : c}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <p className="text-xs text-text-muted">
                  {uni.data_status}
                </p>
              </div>
            )}
          </div>

          {/* ---- Rail: fit, official stats, actions -------------------- */}
          <aside className="order-1 lg:order-2 space-y-4 lg:sticky lg:top-20 h-fit">
            <div className="bg-surface border border-border rounded-md p-5">
              <h2 className="text-base font-bold text-text-primary">
                How you compare
              </h2>
              {num(profile.gpa) || num(profile.ielts) || num(profile.budget) ? (
                <div className="mt-4 space-y-4">
                  <FitRow
                    label="Your GPA"
                    you={num(profile.gpa)}
                    needs={uni.min_gpa}
                    format={(v) => v.toFixed(2)}
                  />
                  <FitRow
                    label="Your IELTS"
                    you={num(profile.ielts)}
                    needs={uni.min_ielts}
                    format={(v) => v.toFixed(1)}
                  />
                  <FitRow
                    label="Your budget"
                    you={num(profile.budget)}
                    needs={uni.annual_tuition_gbp}
                    higherIsBetter
                    format={(v) => `£${Number(v).toLocaleString()}`}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-text-secondary">
                  Run a search with your GPA, IELTS and budget and this panel
                  shows exactly where you stand against this university.{" "}
                  <Link href="/#match-form" className="link-blue">
                    Enter your numbers
                  </Link>
                </p>
              )}
            </div>

            {uni.official && (
              <div className="bg-surface border border-border rounded-md p-5">
                <h2 className="text-base font-bold text-text-primary">
                  Official statistics
                </h2>
                <p className="text-xs text-text-muted mt-0.5 mb-2">
                  Verified government data (Discover Uni)
                </p>
                <StatRow label="Student satisfaction" value={uni.official.nss_satisfaction} suffix="%" />
                <StatRow label="In work or study" value={uni.official.employment_pct} suffix="%" />
                <StatRow
                  label="Median salary"
                  value={
                    uni.official.median_salary_gbp
                      ? `£${Number(uni.official.median_salary_gbp).toLocaleString()}`
                      : null
                  }
                />
                <StatRow label="Continuation rate" value={uni.official.continuation_pct} suffix="%" />
                <StatRow label="Courses listed" value={uni.official.course_count} />
              </div>
            )}

            <div className="bg-surface border border-border rounded-md p-5 space-y-2">
              {(details?.official_url || uni.official_url) && (
                <a
                  href={details?.official_url || uni.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-gold hover:bg-gold-dark transition-colors text-white font-semibold px-4 py-2.5 rounded text-sm"
                >
                  Visit official website
                  <IconExternalLink width={14} height={14} />
                </a>
              )}
              <button
                onClick={addToChecklist}
                className="w-full inline-flex items-center justify-center gap-1.5 border border-border hover:bg-background transition-colors px-4 py-2.5 rounded text-sm font-medium"
              >
                <IconCheck width={15} height={15} />
                Add to my to-do list
              </button>
              <button
                onClick={() => setChatOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 border border-border hover:bg-background transition-colors px-4 py-2.5 rounded text-sm font-medium"
              >
                <IconChat width={15} height={15} />
                Ask AI about this university
              </button>
              {saved && (
                <p className="text-xs text-text-secondary text-center pt-1">{saved}</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <ChatWidget
        open={chatOpen}
        onOpenChange={setChatOpen}
        profile={profile}
        university={uni}
      />
      <Footer />
    </>
  );
}
