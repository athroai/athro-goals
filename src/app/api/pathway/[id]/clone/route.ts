import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/user";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);
    const { id } = await params;

    const original = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
    });
    if (!original) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { pathwayId: original.id },
      orderBy: { createdAt: "asc" },
    });

    const clone = await prisma.pathway.create({
      data: {
        userId: dbUser.id,
        goal: original.goal,
        goalNormalised: original.goalNormalised,
        domain: original.domain,
        groundingType: original.groundingType,
        targetDate: original.targetDate,
        targetAge: original.targetAge,
        attainments: original.attainments ?? undefined,
        currentSituation: original.currentSituation,
        status: "INTAKE",
        folderId: original.folderId,
      },
    });

    if (messages.length > 0) {
      await prisma.chatMessage.createMany({
        data: messages.map((m) => ({
          pathwayId: clone.id,
          userId: dbUser.id,
          role: m.role,
          content: m.content,
        })),
      });
    }

    return NextResponse.json({ id: clone.id });
  } catch (error) {
    console.error("Pathway clone error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
