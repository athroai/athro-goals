"use client";

import { useState } from "react";

export function PlanRow({
  tier,
  name,
  pathways,
  price,
  isCurrent,
  action,
  hasStripe,
}: {
  tier: string;
  name: string;
  pathways: string;
  price: string;
  isCurrent: boolean;
  action: "upgrade" | "downgrade" | "none";
  hasStripe: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (isCurrent || action === "none") return;
    setLoading(true);

    try {
      if (action === "upgrade") {
        await handleStripeUpgrade();
      } else if (action === "downgrade") {
        await handleDowngrade();
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStripeUpgrade() {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    alert(data.error ?? "Checkout unavailable. Please try again later.");
  }

  async function handleDowngrade() {
    if (hasStripe) {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error ?? "Could not open billing portal.");
    }
  }

  const isClickable = !isCurrent && action !== "none";
  const actionLabel =
    action === "upgrade"
      ? "Upgrade"
      : action === "downgrade" && hasStripe
        ? "Downgrade"
        : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable || loading}
      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
        isCurrent
          ? "border-[var(--gold)]/40 bg-[rgba(228,201,126,0.08)]"
          : isClickable
            ? "border-[rgba(228,201,126,0.1)] bg-[rgba(228,201,126,0.02)] hover:border-[var(--gold)]/30 hover:bg-[rgba(228,201,126,0.05)] cursor-pointer"
            : "border-[rgba(228,201,126,0.1)] bg-[rgba(228,201,126,0.02)] opacity-60"
      } disabled:cursor-default`}
    >
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[var(--light)]">{name}</p>
          {isCurrent && (
            <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--gold)]">
              Current
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">{pathways}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[var(--light)]">
          {price}
        </span>
        {actionLabel && (
          <span
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${
              action === "upgrade"
                ? "bg-[var(--gold)] text-[var(--dark-bg)]"
                : "border border-[rgba(228,201,126,0.2)] text-[var(--muted)]"
            }`}
          >
            {loading ? "Processing..." : actionLabel}
          </span>
        )}
      </div>
    </button>
  );
}
