import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);
    const { id } = await params;

    const pathway = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
    });
    if (!pathway) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    const progress = await prisma.pathwayProgress.findUnique({
      where: {
        userId_pathwayId: { userId: dbUser.id, pathwayId: id },
      },
    });

    return NextResponse.json({
      stepCompletions: (progress?.stepCompletions as Record<string, boolean[]>) ?? {},
      customDates: (progress?.customDates as Record<string, string>) ?? {},
    });
  } catch (error) {
    console.error("Progress GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);
    const { id } = await params;

    const pathway = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
    });
    if (!pathway) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      stepCompletions?: Record<string, boolean[]>;
      customDates?: Record<string, string>;
    };

    const { stepCompletions, customDates } = body;

    const progress = await prisma.pathwayProgress.upsert({
      where: {
        userId_pathwayId: { userId: dbUser.id, pathwayId: id },
      },
      create: {
        userId: dbUser.id,
        pathwayId: id,
        stepCompletions: stepCompletions ?? undefined,
        customDates: customDates ?? undefined,
      },
      update: {
        ...(stepCompletions !== undefined && { stepCompletions: stepCompletions as object }),
        ...(customDates !== undefined && { customDates: customDates as object }),
      },
    });

    return NextResponse.json({
      stepCompletions: (progress.stepCompletions as Record<string, boolean[]>) ?? {},
      customDates: (progress.customDates as Record<string, string>) ?? {},
    });
  } catch (error) {
    console.error("Progress PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
