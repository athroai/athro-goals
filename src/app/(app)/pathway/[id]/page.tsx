import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { PathwayGenerating } from "@/components/pathway/PathwayGenerating";

export default async function PathwayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });
  if (!dbUser) return null;

  const { id } = await params;
  const pathway = await prisma.pathway.findFirst({
    where: { id, userId: dbUser.id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!pathway) notFound();

  if (pathway.status === "GENERATING") {
    return (
      <PathwayGenerating
        pathwayId={pathway.id}
        startedAt={pathway.updatedAt.toISOString()}
      />
    );
  }

  if (pathway.status === "ERROR") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
        <p className="mt-2 text-[var(--muted)]">Pathway generation failed. Try again.</p>
        <Link href="/goal/new" className="btn-cta mt-4 inline-block">
          Start over
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-[var(--gold)] hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-[var(--gold)]">
        {pathway.goal}
      </h1>
      {pathway.summaryText && (
        <div className="mt-4 rounded-xl bg-[var(--darker-bg)] p-6">
          <p className="prose-chat text-[var(--muted)]">{pathway.summaryText}</p>
        </div>
      )}
      {(() => {
        const data = pathway.pathwayData as { costContext?: string } | null;
        const costContext = data?.costContext;
        const hasCost = pathway.estimatedTotalCost != null;
        if (!hasCost && !costContext) return null;
        return (
          <div className="mt-2 rounded-lg bg-[rgba(228,201,126,0.05)] p-4">
            {costContext && (
              <p className="text-sm text-[var(--light)]">{costContext}</p>
            )}
            {hasCost && (
              <p className={`mt-1 text-sm font-medium text-[var(--gold)] ${costContext ? "mt-2" : ""}`}>
                Estimated total: £{pathway.estimatedTotalCost!.toLocaleString()}
              </p>
            )}
          </div>
        );
      })()}
      <div className="mt-8 space-y-6">
        {pathway.steps.map((step, i) => {
          const stepData = (pathway.pathwayData as { steps?: Array<{ costNote?: string }> })?.steps?.[i];
          const costNote = stepData?.costNote;
          return (
          <div
            key={step.id}
            className="rounded-xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-display text-lg font-semibold text-[var(--gold)]">
                {step.stepOrder}. {step.title}
              </h3>
              {step.definiteDate && (
                <span className="shrink-0 rounded-full bg-[rgba(228,201,126,0.2)] px-3 py-1 text-xs font-medium text-[var(--gold)]">
                  {step.definiteDate}
                </span>
              )}
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
            {(step.estimatedCost != null || costNote) && (
              <div className="mt-2 rounded-lg bg-[rgba(228,201,126,0.05)] p-3">
                {step.estimatedCost != null && (
                  <p className="text-sm font-medium text-[var(--gold)]">
                    Est. cost: £{step.estimatedCost.toLocaleString()}
                  </p>
                )}
                {costNote && (
                  <p className={`text-sm text-[var(--muted)] ${step.estimatedCost != null ? "mt-1" : ""}`}>
                    {costNote}
                  </p>
                )}
              </div>
            )}
            {step.tips && (
              <div className="mt-3 rounded-lg bg-[rgba(228,201,126,0.05)] p-3">
                <p className="text-xs font-medium text-[var(--gold)]">Tips</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{step.tips}</p>
              </div>
            )}
            {step.sources && (() => {
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
        {pathway.domain === "FINANCE"
          ? "This is information, not financial advice. For personalised advice, speak to a regulated professional."
          : "For personalised support, consider speaking to a relevant professional."}
      </p>
    </div>
  );
}
