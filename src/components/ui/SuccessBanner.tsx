"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SuccessBanner() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setShow(true);
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <div className="mx-4 mt-4 rounded-xl border border-[var(--bright-green)]/40 bg-[rgba(79,195,138,0.1)] px-4 py-3 text-center text-sm text-[var(--bright-green)]">
      Thanks for upgrading! You now have access to more pathways.
    </div>
  );
}
