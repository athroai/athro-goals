import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { generatePathwayPdf } from "@/lib/pdf";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);

    const body = await req.json();
    const { pathwayId } = body as { pathwayId: string };

    const pathway = await prisma.pathway.findFirst({
      where: { id: pathwayId, userId: dbUser.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!pathway) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    if (pathway.status !== "COMPLETE") {
      return NextResponse.json(
        { error: "Pathway must be complete to export" },
        { status: 400 }
      );
    }

    const data = pathway.pathwayData as Record<string, unknown> | null;
    const stepDataList = (data?.steps as Array<Record<string, unknown>>) ?? [];
    const steps = pathway.steps.map((s, i) => {
      const stepData = stepDataList[i];
      const checklist = s.checklist;
      const checklistArr = Array.isArray(checklist)
        ? checklist.filter((x): x is string => typeof x === "string")
        : [];
      return {
        stepOrder: s.stepOrder,
        title: s.title,
        description: s.description,
        stageLabel: s.stageLabel,
        definiteDate: s.definiteDate ?? undefined,
        timelineMonths: s.timelineMonths ?? undefined,
        estimatedCost: s.estimatedCost ?? undefined,
        costNote: stepData?.costNote as string | undefined,
        tips: s.tips ?? undefined,
        checklist: checklistArr,
        sources: (() => {
          const src = s.sources;
          if (Array.isArray(src)) return src.filter((x): x is string => typeof x === "string");
          const o = src as { names?: string[] } | null;
          return o?.names ?? [];
        })(),
      };
    });

    const pathwayData = {
      goal: pathway.goal,
      summary: pathway.summaryText ?? (data?.summary as string),
      totalEstimatedYears:
        pathway.estimatedYears ?? (data?.totalEstimatedYears as number),
      totalEstimatedCost:
        pathway.estimatedTotalCost ?? (data?.totalEstimatedCost as number),
      costContext: data?.costContext as string | undefined,
      steps,
    };

    const buffer = await generatePathwayPdf(
      pathwayData,
      pathway.goal ?? "Pathway"
    );
    const pdfBytes = new Uint8Array(buffer);

    const safeGoal = (pathway.goal ?? "pathway")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .slice(0, 40)
      .trim()
      .replace(/\s+/g, "-");
    const filename = `${safeGoal || "pathway"}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Export PDF error:", msg, error);
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 }
    );
  }
}
