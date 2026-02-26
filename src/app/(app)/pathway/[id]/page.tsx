import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { PathwayGenerating } from "@/components/pathway/PathwayGenerating";
import { PathwayView } from "@/components/pathway/PathwayView";

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

  const stepDataList = (pathway.pathwayData as { steps?: Array<{ costNote?: string }> })?.steps ?? [];
  const stepsForView = pathway.steps.map((s, i) => {
    const checklist = s.checklist;
    const checklistArr = Array.isArray(checklist)
      ? checklist.filter((x): x is string => typeof x === "string")
      : null;
    return {
      id: s.id,
      stepOrder: s.stepOrder,
      title: s.title,
      description: s.description,
      stageLabel: s.stageLabel,
      definiteDate: s.definiteDate,
      definiteDateIso: s.definiteDateIso,
      timelineMonths: s.timelineMonths,
      estimatedCost: s.estimatedCost,
      tips: s.tips,
      sources: s.sources,
      checklist: checklistArr,
      costNote: stepDataList[i]?.costNote,
    };
  });

  const data = pathway.pathwayData as { costContext?: string } | null;

  return (
    <PathwayView
      pathwayId={pathway.id}
      goal={pathway.goal ?? ""}
      summaryText={pathway.summaryText}
      estimatedTotalCost={pathway.estimatedTotalCost}
      costContext={data?.costContext ?? null}
      domain={pathway.domain}
      steps={stepsForView}
    />
  );
}
