import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { UpgradePlans } from "@/components/upgrade/UpgradePlans";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const backUrl = returnTo || "/goal/new";

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect(`/login?next=${encodeURIComponent(returnTo ? `/upgrade?returnTo=${encodeURIComponent(returnTo)}` : "/upgrade")}`);
  }

  const user = await getOrCreateUser(authUser);
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const currentTier = dbUser?.subscriptionTier ?? "FREE";
  const hasPathway = backUrl.includes("resume=");

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-[var(--gold)] text-center">
        Upgrade to get more pathways
      </h1>
      <p className="mt-4 text-center text-[var(--muted)]">
        Free accounts get 1 pathway per month. Choose a plan for more.
        {hasPathway && " Complete checkout to return to your current goal."}
      </p>
      <UpgradePlans currentTier={currentTier} returnTo={backUrl} />
      <p className="mt-6 text-center">
        <Link href={backUrl} className="text-sm text-[var(--muted)] hover:text-[var(--gold)]">
          ← Back to goals
        </Link>
      </p>
    </div>
  );
}
