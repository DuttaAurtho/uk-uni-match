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
          <Icon width={15} height={15} className="text-navy-light" />
          {label}
          {hint && (
            <span className="text-text-secondary font-normal">{hint}</span>
          )}
        </label>
        <div className="flex items-center gap-1 font-mono text-sm bg-background border border-border rounded px-2 py-0.5">
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

/** Section heading in the filter rail — small, bold, uppercase-ish, the way
 *  portal sidebars label each block of controls. */
function FilterHeading({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
      {Icon && <Icon width={14} height={14} className="text-navy-light" />}
      {children}
    </h3>
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
  const activeChips = useMemo(
    () =>
      [
        form.q && { key: "q", label: form.q },
        form.level && { key: "level", label: form.level },
        form.course && { key: "course", label: form.course },
        form.city && { key: "city", label: form.city },
        form.intake && { key: "intake", label: `${form.intake} intake` },
      ].filter(Boolean),
    [form.q, form.level, form.course, form.city, form.intake]
  );
  const hasActiveFilters = activeChips.length > 0;

  return (
    <form
      id="match-form"
      onSubmit={onSubmit}
      className="h-fit lg:sticky lg:top-20 bg-surface border border-border rounded-md overflow-hidden scroll-mt-24"
    >
      <div className="p-5 space-y-5">
        {/* "Selected filters" panel: every active filter as a removable
            chip, with one Clear all — the portal's sidebar convention. */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-text-primary">
              {hasActiveFilters ? "Selected filters" : "Filters"}
            </h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="link-blue text-xs"
              >
                Clear all
              </button>
            )}
          </div>
          {hasActiveFilters ? (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onChange(chip.key, "")}
                  title={`Remove ${chip.label}`}
                  className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-navy-light/40 bg-navy-light/5 pl-3 pr-2 py-1 text-xs text-navy hover:bg-navy-light/10 transition-colors"
                >
                  <span className="truncate">{chip.label}</span>
                  <IconClose width={11} height={11} className="shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary mt-1">
              Set your numbers below to narrow the list.
            </p>
          )}
        </div>

        <div className="h-px bg-border" />

        <FilterHeading icon={IconSearch}>Your profile</FilterHeading>

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

        <FilterHeading icon={IconBook}>Programme</FilterHeading>

        <div>
          <span
            id={levelLabelId}
            className="flex items-center gap-1.5 text-sm font-medium mb-1.5"
          >
            <IconGraduationCap
              width={15}
              height={15}
              className="text-navy-light"
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
                  className={`rounded border px-2 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-navy-light bg-navy-light/10 text-navy"
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
            <IconBook width={15} height={15} className="text-navy-light" />
            Course / subject{" "}
            <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <select
            id="course"
            name="course"
            value={form.course}
            onChange={(e) => onChange("course", e.target.value)}
            className="focus-gold w-full rounded border border-border px-3 py-2 text-sm bg-white transition-shadow"
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
            <IconPin width={15} height={15} className="text-navy-light" />
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
            className="focus-gold w-full rounded border border-border px-3 py-2 text-sm bg-white transition-shadow"
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
            <IconCalendar width={15} height={15} className="text-navy-light" />
            Intake{" "}
            <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <select
            id="intake"
            name="intake"
            value={form.intake}
            onChange={(e) => onChange("intake", e.target.value)}
            className="focus-gold w-full rounded border border-border px-3 py-2 text-sm bg-white transition-shadow"
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
            className="flex-1 inline-flex items-center justify-center gap-2 bg-navy hover:bg-navy-light transition-colors text-white font-semibold py-2.5 rounded disabled:opacity-60"
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
              className="px-4 rounded border border-border text-sm text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
