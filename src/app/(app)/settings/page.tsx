import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { StripePortalButton } from "@/components/ui/StripePortalButton";
import { PlanRow } from "@/components/ui/PlanRow";
import { DeleteAccountButton } from "@/components/ui/DeleteAccountButton";
import { ExportDataButton } from "@/components/ui/ExportDataButton";

const TIER_ORDER = ["FREE", "EXPLORER", "PRO", "ADVISER"] as const;

const TIER_INFO: Record<string, { name: string; description: string; pathways: string; price: string }> = {
  FREE: { name: "Free", description: "Get started", pathways: "1 pathway/month", price: "£0" },
  EXPLORER: { name: "Explorer", description: "More pathways", pathways: "5 pathways/month", price: "—" },
  PRO: { name: "Pro", description: "Full access", pathways: "25 pathways/month", price: "—" },
  ADVISER: { name: "Adviser", description: "For professionals", pathways: "100 pathways/month", price: "—" },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });
  if (!dbUser) return null;

  const currentTierIndex = TIER_ORDER.indexOf(dbUser.subscriptionTier as (typeof TIER_ORDER)[number]);
  const currentInfo = TIER_INFO[dbUser.subscriptionTier] ?? TIER_INFO.FREE;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 pb-20 md:p-6 md:pb-6">
      <h1 className="font-display text-2xl font-bold text-[var(--gold)]">
        Settings
      </h1>

      {/* Current plan */}
      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Current plan</p>
            <h2 className="mt-1 font-display text-xl font-bold text-[var(--gold)]">
              {currentInfo.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{currentInfo.pathways}</p>
          </div>
          <span className="rounded-full bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--gold)]">
            {dbUser.pathwaysUsedThisMonth} used this month
          </span>
        </div>
      </section>

      {/* All plan options */}
      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--light)]">
          Plans
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Configure pricing in Stripe. Set STRIPE_EXPLORER_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_ADVISER_PRICE_ID in your environment.
        </p>
        <div className="mt-4 space-y-3">
          {(["FREE", "EXPLORER", "PRO", "ADVISER"] as const).map((tier) => {
            const info = TIER_INFO[tier];
            const isCurrent = dbUser.subscriptionTier === tier;
            const tierIndex = TIER_ORDER.indexOf(tier);
            const isUpgrade = tierIndex > currentTierIndex;
            const isDowngrade = tierIndex < currentTierIndex;
            const hasSub = !!dbUser.stripeSubId;
            const action = isCurrent ? "none" as const
              : (tier === "FREE" ? (hasSub ? "downgrade" as const : "none" as const)
              : isUpgrade ? "upgrade" as const
              : isDowngrade ? "downgrade" as const
              : "none" as const);

            return (
              <PlanRow
                key={tier}
                tier={tier}
                name={info.name}
                pathways={info.pathways}
                price={info.price}
                isCurrent={isCurrent}
                action={action}
                hasStripe={!!dbUser.stripeSubId}
              />
            );
          })}
        </div>
      </section>

      {/* Billing management */}
      {dbUser.subscriptionTier !== "FREE" && (
        <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
          <h2 className="font-display text-lg font-semibold text-[var(--light)]">
            Billing
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage your subscription, payment methods, or cancel.
          </p>
          <div className="mt-4">
            <StripePortalButton className="btn-secondary text-sm" />
          </div>
        </section>
      )}

      {/* Account */}
      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--light)]">
          Account
        </h2>
        {dbUser.name && (
          <p className="mt-1 text-sm text-[var(--light)]">{dbUser.name}</p>
        )}
        <p className="mt-0.5 text-sm text-[var(--muted)]">{dbUser.email}</p>
        <div className="mt-4 space-y-2">
          <ExportDataButton />
        </div>
        <div className="mt-6 border-t border-[rgba(228,201,126,0.1)] pt-4">
          <DeleteAccountButton />
        </div>
      </section>

      {/* Legal */}
      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--light)]">
          Legal
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          <Link href="/terms" className="text-sm text-[var(--muted)] hover:text-[var(--gold)]">
            Terms & Conditions
          </Link>
          <Link href="/privacy" className="text-sm text-[var(--muted)] hover:text-[var(--gold)]">
            Privacy Policy
          </Link>
          <Link href="/help" className="text-sm text-[var(--muted)] hover:text-[var(--gold)]">
            Help
          </Link>
        </div>
      </section>
    </div>
  );
}
