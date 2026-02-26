import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { ConversationChat } from "@/components/chat/ConversationChat";
import { GoalIntakeForm } from "@/components/goal/GoalIntakeForm";

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const { resume } = await searchParams;

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    redirect("/login?next=/goal/new");
  }

  // No resume: show intake form or upgrade if at limit
  if (!resume) {
    const dbUserForLimit = await prisma.user.findUnique({
      where: { supabaseAuthId: authUser.id },
    });
    let limitReached = false;
    if (dbUserForLimit) {
      const { checkPathwayLimit } = await import("@/lib/limit");
      limitReached = checkPathwayLimit(dbUserForLimit).limitReached;
    }
    return (
      <div className="relative min-h-[80vh]">
        {limitReached ? (
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <h2 className="font-display text-xl font-bold text-[var(--gold)]">
              You&apos;ve used your free pathway
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              Free accounts get 1 pathway per month. Upgrade to create more.
            </p>
            <a href="/upgrade" className="btn-cta mt-6 inline-block rounded-xl px-6 py-3 font-semibold">
              Upgrade to continue
            </a>
          </div>
        ) : (
          <GoalIntakeForm />
        )}
      </div>
    );
  }

  // Resume: show chat with existing pathway
  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });
  if (!dbUser) return null;

  const pathway = await prisma.pathway.findFirst({
    where: { id: resume, userId: dbUser.id },
  });
  if (!pathway) redirect("/goal/new");

  const { checkPathwayLimit } = await import("@/lib/limit");
  const { limitReached } = checkPathwayLimit(dbUser);

  const messages = await prisma.chatMessage.findMany({
    where: { pathwayId: pathway.id },
    orderBy: { createdAt: "asc" },
  });

  const initialMessages = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  return (
    <div className="relative h-full">
      <ConversationChat
        initialPathwayId={pathway.id}
        initialMessages={initialMessages}
        initialGoal={pathway.goal}
        initialTarget={
          pathway.targetDate
            ? `By ${pathway.targetDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
            : pathway.targetAge != null
              ? `By age ${pathway.targetAge}`
              : undefined
        }
        initialAttainments={(pathway.attainments as string[] | null) ?? undefined}
        initialLimitReached={limitReached}
      />
    </div>
  );
}
