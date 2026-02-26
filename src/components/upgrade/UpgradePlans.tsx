"use client";

import { useState } from "react";

const PLANS = [
  { tier: "EXPLORER" as const, name: "Explorer", pathways: "5 pathways/month", price: "£4.99", priceNote: "/month" },
  { tier: "PRO" as const, name: "Pro", pathways: "25 pathways/month", price: "£9.99", priceNote: "/month", popular: true },
  { tier: "ADVISER" as const, name: "Adviser", pathways: "100 pathways/month", price: "£29.99", priceNote: "/month" },
];

export function UpgradePlans({
  currentTier,
  returnTo,
}: {
  currentTier: string;
  returnTo: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(tier: "EXPLORER" | "PRO" | "ADVISER") {
    setLoading(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, returnTo: returnTo || undefined }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error ?? "Checkout unavailable. Please try again later.");
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {PLANS.map((plan) => {
        const isCurrent = currentTier === plan.tier;
        const TIER_ORDER = ["FREE", "EXPLORER", "PRO", "ADVISER"];
        const isUpgrade = TIER_ORDER.indexOf(currentTier) < TIER_ORDER.indexOf(plan.tier);

        return (
          <div
            key={plan.tier}
            className={`rounded-xl border p-4 ${
              plan.popular
                ? "border-[var(--gold)]/50 bg-[rgba(228,201,126,0.06)]"
                : "border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-semibold text-[var(--light)]">{plan.name}</h3>
                  {plan.popular && (
                    <span className="rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--gold)]">
                      Best value
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--gold)]">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{plan.pathways}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="font-semibold text-[var(--light)]">
                  {plan.price}
                  <span className="text-xs font-normal text-[var(--muted)]">{plan.priceNote}</span>
                </span>
                {!isCurrent && isUpgrade && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={!!loading}
                    className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--dark-bg)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {loading === plan.tier ? "Processing..." : "Upgrade"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
