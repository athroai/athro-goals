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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);
    const { id } = await params;
    const pathway = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!pathway) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    return NextResponse.json(pathway);
  } catch (error) {
    console.error("Pathway GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
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
    const existing = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status } = body as { status?: string };
    const allowedStatuses = ["ARCHIVED", "GENERATING"];

    if (status === "GENERATING") {
      const limits: Record<string, number> = {
        FREE: 1,
        EXPLORER: 5,
        PRO: 25,
        ADVISER: 100,
      };
      const limit = limits[dbUser.subscriptionTier] ?? 1;
      const now = new Date();

      if (!dbUser.pathwaysResetDate || now > dbUser.pathwaysResetDate) {
        const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { pathwaysUsedThisMonth: 0, pathwaysResetDate: resetDate },
        });
        dbUser.pathwaysUsedThisMonth = 0;
      }

      if (dbUser.pathwaysUsedThisMonth >= limit) {
        return NextResponse.json(
          {
            error: "limit_reached",
            message: "You've used your free pathway this month.",
            tier: dbUser.subscriptionTier,
            used: dbUser.pathwaysUsedThisMonth,
            limit,
          },
          { status: 429 }
        );
      }
    }

    if (status && allowedStatuses.includes(status)) {
      await prisma.pathway.update({
        where: { id },
        data: { status: status as "ARCHIVED" | "GENERATING" },
      });
    }

    const pathway = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    return NextResponse.json(pathway);
  } catch (error) {
    console.error("Pathway PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
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
    const existing = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    const { folderId } = (await req.json()) as { folderId?: string | null };

    if (folderId !== undefined) {
      if (folderId) {
        const folder = await prisma.folder.findFirst({
          where: { id: folderId, userId: dbUser.id },
        });
        if (!folder) {
          return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }
      }
      await prisma.pathway.update({
        where: { id },
        data: { folderId: folderId ?? null },
      });
    }

    const pathway = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    return NextResponse.json(pathway);
  } catch (error) {
    console.error("Pathway PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const existing = await prisma.pathway.findFirst({
      where: { id, userId: dbUser.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pathway not found" }, { status: 404 });
    }

    await prisma.pathway.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pathway DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
