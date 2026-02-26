"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ExportPdfButton } from "./ExportPdfButton";
import { EditableDate } from "./EditableDate";
import { schedulePathwayNotifications } from "@/lib/notifications";

interface Step {
  id: string;
  stepOrder: number;
  title: string;
  description: string;
  stageLabel: string;
  definiteDate: string | null;
  definiteDateIso: string | null;
  timelineMonths: number | null;
  estimatedCost: number | null;
  tips: string | null;
  sources: unknown;
  checklist: string[] | null;
  costNote?: string | null;
  savingsTarget?: string | null;
  recommendations?: string[] | null;
}

interface PathwayViewProps {
  pathwayId: string;
  goal: string;
  summaryText: string | null;
  estimatedTotalCost: number | null;
  costContext: string | null;
  domain: string | null;
  steps: Step[];
}

function isoToUk(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return iso;
  const day = String(d).padStart(2, "0");
  const month = String(m).padStart(2, "0");
  return `${day}/${month}/${y}`;
}

function definiteDateToIso(definiteDate: string | null): string | null {
  if (!definiteDate) return null;
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const yearMatch = definiteDate.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  let month = 1;
  const monthMatch = definiteDate.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  if (monthMatch) month = months[monthMatch[1].toLowerCase().slice(0, 3)] ?? 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function PathwayView({
  pathwayId,
  goal,
  summaryText,
  estimatedTotalCost,
  costContext,
  domain,
  steps,
}: PathwayViewProps) {
  const [stepCompletions, setStepCompletions] = useState<Record<string, boolean[]>>({});
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/pathway/${pathwayId}/progress`);
      if (!res.ok) return;
      const data = await res.json();
      setStepCompletions(data.stepCompletions ?? {});
      setCustomDates(data.customDates ?? {});
    } catch {
      /* ignore */
    }
  }, [pathwayId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    if (steps.length === 0) return;
    schedulePathwayNotifications(
      pathwayId,
      goal,
      steps.map((s) => ({
        id: s.id,
        title: s.title,
        definiteDateIso: s.definiteDateIso,
        definiteDate: s.definiteDate,
      })),
      customDates
    );
  }, [pathwayId, goal, steps, customDates]);

  const saveProgress = useCallback(
    async (completions: Record<string, boolean[]>, dates: Record<string, string>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/pathway/${pathwayId}/progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepCompletions: completions, customDates: dates }),
        });
        if (res.ok) {
          setStepCompletions(completions);
          setCustomDates(dates);
        }
      } finally {
        setSaving(false);
      }
    },
    [pathwayId]
  );

  const toggleCheck = (stepId: string, index: number) => {
    const checklist = steps.find((s) => s.id === stepId)?.checklist ?? [];
    if (index >= checklist.length) return;
    const current = stepCompletions[stepId] ?? checklist.map(() => false);
    const next = [...current];
    next[index] = !next[index];
    const updated = { ...stepCompletions, [stepId]: next };
    saveProgress(updated, customDates);
  };

  const getDisplayDate = (step: Step) => {
    const custom = customDates[step.id];
    if (custom) return custom;
    const iso = step.definiteDateIso ?? definiteDateToIso(step.definiteDate);
    if (iso) return isoToUk(iso);
    return step.definiteDate ?? "";
  };

  const setDisplayDate = (stepId: string, ukDate: string) => {
    const updated = { ...customDates, [stepId]: ukDate };
    saveProgress(stepCompletions, updated);
  };

  const isStepComplete = (step: Step) => {
    const checklist = step.checklist ?? [];
    if (checklist.length === 0) return false;
    const completed = stepCompletions[step.id] ?? checklist.map(() => false);
    return completed.length === checklist.length && completed.every(Boolean);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard" className="text-sm text-[var(--gold)] hover:underline">
          ← Back
        </Link>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-[var(--muted)]">Saving...</span>
          )}
          <ExportPdfButton pathwayId={pathwayId} />
        </div>
      </div>
      <h1 className="mt-4 font-display text-3xl font-bold text-[var(--gold)]">
        {goal}
      </h1>
      {summaryText && (
        <div className="mt-4 rounded-xl bg-[var(--darker-bg)] p-6">
          <p className="prose-chat text-[var(--muted)]">{summaryText}</p>
        </div>
      )}
      {(estimatedTotalCost != null || costContext) && (
        <div className="mt-2 rounded-lg bg-[rgba(228,201,126,0.05)] p-4">
          {costContext && (
            <p className="text-sm text-[var(--light)]">{costContext}</p>
          )}
          {estimatedTotalCost != null && (
            <p className={`mt-1 text-sm font-medium text-[var(--gold)] ${costContext ? "mt-2" : ""}`}>
              Estimated total: £{estimatedTotalCost.toLocaleString()}
            </p>
          )}
        </div>
      )}
      <div className="mt-8 space-y-6">
        {steps.map((step) => {
          const costNote = step.costNote;
          const complete = isStepComplete(step);
          const checklist = step.checklist ?? [];
          const completed = stepCompletions[step.id] ?? checklist.map(() => false);

          return (
            <div
              key={step.id}
              className={`rounded-xl border bg-[var(--card-bg)] p-6 ${
                complete
                  ? "border-[var(--gold)]/50 ring-1 ring-[var(--gold)]/20"
                  : "border-[rgba(228,201,126,0.2)]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold text-[var(--gold)]">
                    {step.stepOrder}. {step.title}
                  </h3>
                  {complete && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--bright-green)]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--bright-green)]">
                      ★ Completed
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs font-medium text-[var(--muted)]">Achieve By</span>
                  <EditableDate
                    value={getDisplayDate(step)}
                    onChange={(v) => setDisplayDate(step.id, v)}
                  />
                  <span className="text-[10px] text-[var(--muted)]">click to edit</span>
                </div>
              </div>
              {step.stageLabel && (
                <p className="mt-1 text-xs text-[var(--muted)]">{step.stageLabel}</p>
              )}
              <div className="prose-chat mt-3 text-sm text-[var(--light)]">
                {step.description.split("\n").map((p, j) => (
                  <p key={j} className="mb-2 last:mb-0">
                    {p}
                  </p>
                ))}
              </div>
              {checklist.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-[var(--muted)]">Checklist</p>
                  {checklist.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex cursor-pointer items-start gap-3 rounded-lg bg-[rgba(228,201,126,0.05)] p-3 transition hover:bg-[rgba(228,201,126,0.08)]"
                    >
                      <input
                        type="checkbox"
                        checked={completed[idx] ?? false}
                        onChange={() => toggleCheck(step.id, idx)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-[rgba(228,201,126,0.3)] bg-transparent text-[var(--gold)] focus:ring-[var(--gold)]"
                      />
                      <span
                        className={`text-sm ${completed[idx] ? "line-through text-[var(--muted)]" : "text-[var(--light)]"}`}
                      >
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {(step.estimatedCost != null || costNote || step.savingsTarget || (step.recommendations?.length ?? 0) > 0) && (
                <div className="mt-2 rounded-lg bg-[rgba(228,201,126,0.05)] p-3 space-y-2">
                  {step.savingsTarget && (
                    <p className="text-sm font-medium text-[var(--gold)]">
                      {step.savingsTarget}
                    </p>
                  )}
                  {step.estimatedCost != null && (
                    <p className="text-sm font-medium text-[var(--gold)]">
                      Est. cost: £{step.estimatedCost.toLocaleString()}
                    </p>
                  )}
                  {costNote && (
                    <p className="text-sm text-[var(--muted)]">
                      {costNote}
                    </p>
                  )}
                  {step.recommendations && step.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[var(--gold)]">Recommendations</p>
                      <ul className="mt-1 space-y-1">
                        {step.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-[var(--light)]">
                            • {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {step.tips && (
                <div className="mt-3 rounded-lg bg-[rgba(228,201,126,0.05)] p-3">
                  <p className="text-xs font-medium text-[var(--gold)]">Tips</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{step.tips}</p>
                </div>
              )}
              {(() => {
                const s = step.sources as { sourceType?: string; names?: string[] } | string[] | null;
                const names = Array.isArray(s) ? s : (s?.names ?? []);
                if (names.length === 0) return null;
                return (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Sources: {names.join(", ")}
                  </p>
                );
              })()}
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        {domain === "FINANCE"
          ? "This is information, not financial advice. For personalised advice, speak to a regulated professional."
          : "For personalised support, consider speaking to a relevant professional."}
      </p>
    </div>
  );
}
