import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/user";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(authUser);
  const { id } = await params;
  const folder = await prisma.folder.findFirst({
    where: { id, userId: dbUser.id },
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name } = (await req.json()) as { name?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.folder.update({
    where: { id: folder.id },
    data: { name: name.trim() },
  });

  return NextResponse.json({ folder: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(authUser);
  const { id } = await params;
  const folder = await prisma.folder.findFirst({
    where: { id, userId: dbUser.id },
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pathway.updateMany({
    where: { folderId: folder.id },
    data: { folderId: null },
  });

  await prisma.folder.delete({ where: { id: folder.id } });

  return NextResponse.json({ ok: true });
}
