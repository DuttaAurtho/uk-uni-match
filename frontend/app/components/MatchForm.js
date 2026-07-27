"use client";

import { useId, useMemo } from "react";
import {
  IconTarget,
  IconChat,
  IconWallet,
  IconBook,
  IconPin,
  IconSpinner,
  IconSearch,
  IconCalendar,
  IconGraduationCap,
  IconClose,
} from "./icons";

function SliderField({
  icon: Icon,
  label,
  hint,
  id,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
  numberStep,
}) {
  const numericValue = value === "" ? min : Number(value);
  const fillPct = ((numericValue - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Icon width={15} height={15} className="text-gold-dark" />
          {label}
          {hint && (
            <span className="text-text-secondary font-normal">{hint}</span>
          )}
        </label>
        <div className="flex items-center gap-1 font-mono text-sm bg-background border border-border rounded-md px-2 py-0.5">
          <input
            id={id}
            type="number"
            step={numberStep ?? step}
            min={min}
            max={max}
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-14 bg-transparent text-right focus:outline-none"
          />
          {suffix && <span className="text-text-secondary">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        aria-labelledby={id}
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={(e) => onChange(e.target.value)}
        className="range-slider"
        style={{ "--fill": `${fillPct}%` }}
      />
      <div className="flex justify-between text-[11px] text-text-muted mt-1 font-mono">
        <span>
          {min}
          {suffix}
        </span>
        <span>
          {max}
          {suffix}
        </span>
      </div>
    </div>
  );
}

export default function MatchForm({
  form,
  onChange,
  onSubmit,
  onReset,
  courses,
  cities,
  intakes = [],
  levels = [],
  status,
}) {
  const cityListId = useId();
  const levelLabelId = useId();
  const hasActiveFilters = useMemo(
    () => Boolean(form.q || form.course || form.city || form.intake || form.level),
    [form.q, form.course, form.city, form.intake, form.level]
  );

  return (
    <form
      id="match-form"
      onSubmit={onSubmit}
      className="h-fit lg:sticky lg:top-24 bg-surface border border-border rounded-xl shadow-md overflow-hidden animate-fade-in-up scroll-mt-24"
    >
      <div className="h-1 bg-gradient-to-r from-gold via-gold-light to-gold" />
      <div className="p-6 space-y-6">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Your profile
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Drag the sliders or type exact numbers.
          </p>
        </div>

        {/* The name search itself lives in the hero; down here it only needs
            to show what's active and offer a way out of it. */}
        {form.q && (
          <div>
            <span className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
              <IconSearch width={15} height={15} className="text-gold-dark" />
              Searching for
            </span>
            <button
              type="button"
              onClick={() => onChange("q", "")}
              title="Clear the name search"
              className="inline-flex items-center gap-2 max-w-full rounded-full border border-gold bg-gold/10 pl-3 pr-2 py-1 text-sm text-navy hover:bg-gold/20 transition-colors"
            >
              <span className="truncate">{form.q}</span>
              <IconClose width={13} height={13} className="shrink-0" />
            </button>
          </div>
        )}

        <SliderField
          icon={IconTarget}
          label="HSC / GPA"
          hint="(out of 5.0)"
          id="gpa"
          min={0}
          max={5}
          step={0.01}
          numberStep={0.01}
          value={form.gpa}
          onChange={(v) => onChange("gpa", v)}
        />

        <SliderField
          icon={IconChat}
          label="IELTS overall band"
          id="ielts"
          min={0}
          max={9}
          step={0.5}
          value={form.ielts}
          onChange={(v) => onChange("ielts", v)}
        />

        <SliderField
          icon={IconWallet}
          label="Max budget"
          hint="(£/year tuition)"
          id="budget"
          min={0}
          max={40000}
          step={500}
          suffix="£"
          value={form.budget}
          onChange={(v) => onChange("budget", v)}
        />

        <div className="h-px bg-border" />

        <div>
          <span
            id={levelLabelId}
            className="flex items-center gap-1.5 text-sm font-medium mb-1.5"
          >
            <IconGraduationCap
              width={15}
              height={15}
              className="text-gold-dark"
            />
            Degree level{" "}
            <span className="text-text-secondary font-normal">(optional)</span>
          </span>
          <div
            className="grid grid-cols-3 gap-1.5"
            role="radiogroup"
            aria-labelledby={levelLabelId}
          >
            {[{ value: "", label: "Any" }, ...levels].map((opt) => {
              const active = form.level === opt.value;
              return (
                <button
                  key={opt.value || "any"}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={opt.description || "Any degree level"}
                  onClick={() => onChange("level", opt.value)}
                  className={`rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-gold bg-gold/10 text-navy"
                      : "border-border bg-white text-text-secondary hover:bg-background"
                  }`}
                >
                  {opt.value || opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-text-muted mt-1.5">
            {form.level
              ? levels.find((l) => l.value === form.level)?.description
              : "BSc = bachelor's, MSc = master's"}
          </p>
        </div>

        <div>
          <label
            className="flex items-center gap-1.5 text-sm font-medium mb-1.5"
            htmlFor="course"
          >
            <IconBook width={15} height={15} className="text-gold-dark" />
            Course / subject{" "}
            <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <select
            id="course"
            name="course"
            value={form.course}
            onChange={(e) => onChange("course", e.target.value)}
            className="focus-gold w-full rounded-md border border-border px-3 py-2.5 text-sm bg-white transition-shadow"
          >
            {/* Subjects read as "BSc Computer Science" once a level is
                picked, so the two fields visibly describe one degree. */}
            <option value="">
              {form.level ? `Any ${form.level} course` : "Any course"}
            </option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {form.level ? `${form.level} ${c}` : c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="flex items-center gap-1.5 text-sm font-medium mb-1.5"
            htmlFor="city"
          >
            <IconPin width={15} height={15} className="text-gold-dark" />
            City / region{" "}
            <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <input
            id="city"
            name="city"
            type="text"
            list={cityListId}
            autoComplete="off"
            value={form.city}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="Start typing… e.g. London, Wales"
            className="focus-gold w-full rounded-md border border-border px-3 py-2.5 text-sm bg-white transition-shadow"
          />
          <datalist id={cityListId}>
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label
            className="flex items-center gap-1.5 text-sm font-medium mb-1.5"
            htmlFor="intake"
          >
            <IconCalendar width={15} height={15} className="text-gold-dark" />
            Intake{" "}
            <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <select
            id="intake"
            name="intake"
            value={form.intake}
            onChange={(e) => onChange("intake", e.target.value)}
            className="focus-gold w-full rounded-md border border-border px-3 py-2.5 text-sm bg-white transition-shadow"
          >
            <option value="">Any intake</option>
            {intakes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-navy hover:bg-navy-light active:scale-[0.98] transition-all text-white font-semibold py-2.5 rounded-md disabled:opacity-60 disabled:active:scale-100"
          >
            {status === "loading" ? (
              <>
                <IconSpinner width={16} height={16} />
                Searching…
              </>
            ) : (
              "Find my universities"
            )}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 rounded-md border border-border text-sm text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
