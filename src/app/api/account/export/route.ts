import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);

    const pathways = await prisma.pathway.findMany({
      where: { userId: dbUser.id },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        chatMessages: { orderBy: { createdAt: "asc" } },
      },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        email: dbUser.email,
        name: dbUser.name,
        createdAt: dbUser.createdAt,
        subscriptionTier: dbUser.subscriptionTier,
      },
      pathways: pathways.map((p) => ({
        goal: p.goal,
        status: p.status,
        summary: p.summaryText,
        estimatedYears: p.estimatedYears,
        estimatedCost: p.estimatedTotalCost,
        pathwayData: p.pathwayData,
        createdAt: p.createdAt,
        steps: p.steps.map((s) => ({
          stepOrder: s.stepOrder,
          title: s.title,
          description: s.description,
          stageLabel: s.stageLabel,
          definiteDate: s.definiteDate,
          timelineMonths: s.timelineMonths,
          estimatedCost: s.estimatedCost,
          tips: s.tips,
        })),
        conversation: p.chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      })),
    };

    const json = JSON.stringify(exportData, null, 2);

    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="athro-goals-data.json"',
      },
    });
  } catch (error) {
    console.error("Export data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
