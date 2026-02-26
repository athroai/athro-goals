"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function createPathway(data: {
  goal: string;
  targetDate?: string;
  targetAge?: number;
  attainments: string[];
}): Promise<{ pathwayId: string } | { limitReached: true }> {
  const res = await fetch("/api/pathway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 429) {
    return { limitReached: true };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create pathway");
  }
  return res.json();
}

const ATTAINMENT_EXAMPLES = [
  "sobriety",
  "a land rover",
  "a million pounds",
  "a big family",
  "good grades",
  "an A*",
  "a good night out",
  "a hot missus",
  "a nice holiday",
  "a better CV",
  "cutting my debt",
  "less sweat",
  "to understand politics",
  "to get into drama school",
  "to impress Oxford",
];

type Step = "goal" | "target" | "attainment";

export function GoalIntakeForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetAge, setTargetAge] = useState("");
  const [attainments, setAttainments] = useState(["", "", ""]);
  const [useDate, setUseDate] = useState(true);

  function handleGoalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setStep("target");
  }

  function handleTargetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (useDate ? !targetDate.trim() : !targetAge.trim()) return;
    setStep("attainment");
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAttainmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const filled = attainments.filter((a) => a.trim());
    try {
      const result = await createPathway({
        goal: goal.trim(),
        targetDate: useDate && targetDate.trim() ? targetDate.trim() : undefined,
        targetAge: !useDate && targetAge.trim() ? parseInt(targetAge, 10) : undefined,
        attainments: filled,
      });
      if ("limitReached" in result && result.limitReached) {
        router.push("/upgrade");
        return;
      }
      const { pathwayId } = result as { pathwayId: string };
      router.push(`/goal/new?resume=${pathwayId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  function setAttainment(i: number, v: string) {
    setAttainments((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-8">
      {/* Progress */}
      <div className="flex gap-2">
        {(["goal", "target", "attainment"] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              step === s ? "bg-[var(--gold)]" : s < step ? "bg-[var(--dark-green)]" : "bg-[rgba(228,201,126,0.2)]"
            }`}
          />
        ))}
      </div>

      {step === "goal" && (
        <form onSubmit={handleGoalSubmit} className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-[var(--gold)]">
            What is your goal?
          </h2>
          <p className="text-sm text-[var(--muted)]">
            The thing you want to achieve — a mortgage, a MacBook, sobriety, a marathon, anything.
          </p>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. I want to own a MacBook Pro"
            className="input-athro w-full px-4 py-3 text-lg"
            autoFocus
          />
          <button type="submit" disabled={!goal.trim()} className="btn-cta w-full py-3">
            Next
          </button>
        </form>
      )}

      {step === "target" && (
        <form onSubmit={handleTargetSubmit} className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-[var(--gold)]">
            By when?
          </h2>
          <p className="text-sm text-[var(--muted)]">
            This drives your whole pathway. A date or an age — pick one.
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setUseDate(true)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium ${
                useDate ? "bg-[var(--gold)] text-black" : "bg-[rgba(228,201,126,0.2)] text-[var(--muted)]"
              }`}
            >
              Date
            </button>
            <button
              type="button"
              onClick={() => setUseDate(false)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium ${
                !useDate ? "bg-[var(--gold)] text-black" : "bg-[rgba(228,201,126,0.2)] text-[var(--muted)]"
              }`}
            >
              Age
            </button>
          </div>
          {useDate ? (
            <input
              type="text"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              placeholder="e.g. December 2028"
              className="input-athro w-full px-4 py-3 text-lg"
              autoFocus
            />
          ) : (
            <input
              type="text"
              inputMode="numeric"
              value={targetAge}
              onChange={(e) => setTargetAge(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 30"
              className="input-athro w-full px-4 py-3 text-lg"
              autoFocus
            />
          )}
          <button
            type="submit"
            disabled={useDate ? !targetDate.trim() : !targetAge.trim()}
            className="btn-cta w-full py-3"
          >
            Next
          </button>
        </form>
      )}

      {step === "attainment" && (
        <form onSubmit={handleAttainmentSubmit} className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-[var(--gold)]">
            What do you hope to get?
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Up to three things — the why behind your goal. Could be anything: sobriety, a land rover,
            a million pounds, a big family, good grades, an A*, a good night out, a nice holiday, a
            better CV, cutting debt, to understand politics, to get into drama school, to impress
            Oxford...
          </p>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="text"
              value={attainments[i]}
              onChange={(e) => setAttainment(i, e.target.value)}
              placeholder={ATTAINMENT_EXAMPLES[i % ATTAINMENT_EXAMPLES.length]}
              className="input-athro w-full px-4 py-3"
            />
          ))}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-cta w-full py-3">
            {submitting ? "Creating..." : "Build my pathway"}
          </button>
        </form>
      )}
    </div>
  );
}
