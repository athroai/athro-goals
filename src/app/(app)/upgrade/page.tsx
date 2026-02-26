import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const hasPathway = backUrl.includes("resume=");

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--gold)]">
        Upgrade to get more pathways
      </h1>
      <p className="mt-4 text-[var(--muted)]">
        Free accounts get 1 pathway per month. Upgrade to Explorer or Pro for more pathways
        {hasPathway ? " and to return to your current goal" : ""}.
      </p>
      <div className="mt-8 flex flex-col gap-4">
        <Link
          href={backUrl}
          className="btn-cta inline-block rounded-xl px-8 py-4 font-semibold"
        >
          {hasPathway ? "Return to my pathway" : "Back to goals"}
        </Link>
        <p className="text-sm text-[var(--muted)]">
          Payment options coming soon. For now, you can return to view your pathway.
        </p>
      </div>
    </div>
  );
}
