"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STUCK_MS = 90_000; // 90 seconds

export function PathwayGenerating({
  pathwayId,
  startedAt,
}: {
  pathwayId: string;
  startedAt?: string;
}) {
  const router = useRouter();
  const alreadyStuck =
    startedAt && Date.now() - new Date(startedAt).getTime() > STUCK_MS;
  const [stuck, setStuck] = useState(alreadyStuck);

  useEffect(() => {
    let cancelled = false;
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/pathway/${pathwayId}`);
        if (!res.ok) return;
        const pathway = await res.json();
        if (pathway.status === "COMPLETE") {
          router.refresh();
          return;
        }
        if (pathway.status === "ERROR") {
          router.refresh();
          return;
        }
      } catch {
        /* ignore */
      }
      if (Date.now() - start > STUCK_MS && !stuck) {
        setStuck(true);
        return;
      }
      setTimeout(poll, 3000);
    };

    if (!stuck) poll();
    return () => {
      cancelled = true;
    };
  }, [pathwayId, router, startedAt, stuck]);

  if (stuck) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-[var(--gold)]">Taking longer than expected</h2>
        <p className="mt-2 text-[var(--muted)]">
          Pathway generation may have timed out. You can try again from the chat or start a new goal.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/goal/new?resume=${pathwayId}`}
            className="rounded-xl border border-[rgba(228,201,126,0.3)] px-6 py-3 font-semibold text-[var(--gold)] hover:bg-[rgba(228,201,126,0.1)]"
          >
            Go back to chat
          </Link>
          <Link href="/goal/new" className="btn-cta inline-block rounded-xl px-6 py-3 font-semibold">
            Start new goal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--gold)] border-t-transparent mx-auto" />
      <h2 className="mt-4 text-xl font-semibold text-[var(--light)]">Building your pathway</h2>
      <p className="mt-2 text-[var(--muted)]">This usually takes 30-60 seconds.</p>
    </div>
  );
}
