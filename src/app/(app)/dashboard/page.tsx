import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });
  if (!dbUser) return null;

  const pathways = await prisma.pathway.findMany({
    where: { userId: dbUser.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      goal: true,
      status: true,
      totalSteps: true,
      estimatedYears: true,
      estimatedTotalCost: true,
      pathwayData: true,
      folderId: true,
      updatedAt: true,
      steps: { select: { id: true }, take: 1 },
      chatMessages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        select: { content: true },
        take: 1,
      },
    },
  });

  if (pathways.length === 0) {
    redirect("/goal/new");
  }

  const folders = await prisma.folder.findMany({
    where: { userId: dbUser.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { pathways: true } } },
  });

  const FOLDER_LIMITS: Record<string, number> = {
    FREE: 3,
    EXPLORER: 10,
    PRO: 999,
    ADVISER: 999,
  };

  const serialised = pathways.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <DashboardClient
      pathways={serialised}
      folders={folders.map((f) => ({
        id: f.id,
        name: f.name,
        pathwayCount: f._count.pathways,
      }))}
      folderLimit={FOLDER_LIMITS[dbUser.subscriptionTier] ?? 3}
      tier={dbUser.subscriptionTier}
    />
  );
}
