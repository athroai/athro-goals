import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/user";
import prisma from "@/lib/prisma";

const FOLDER_LIMITS: Record<string, number> = {
  FREE: 3,
  EXPLORER: 10,
  PRO: 999,
  ADVISER: 999,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(authUser);
  const folders = await prisma.folder.findMany({
    where: { userId: dbUser.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { pathways: true } } },
  });

  const limit = FOLDER_LIMITS[dbUser.subscriptionTier] ?? 3;

  return NextResponse.json({ folders, limit, tier: dbUser.subscriptionTier });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(authUser);
  const { name } = (await req.json()) as { name?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const limit = FOLDER_LIMITS[dbUser.subscriptionTier] ?? 3;
  const count = await prisma.folder.count({ where: { userId: dbUser.id } });
  if (count >= limit) {
    return NextResponse.json(
      { error: `You can create up to ${limit} folders on your plan.` },
      { status: 429 }
    );
  }

  const folder = await prisma.folder.create({
    data: { userId: dbUser.id, name: name.trim() },
  });

  return NextResponse.json({ folder });
}
