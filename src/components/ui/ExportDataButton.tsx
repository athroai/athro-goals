"use client";

import { useState } from "react";

export function ExportDataButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/export", { method: "POST" });
      if (!res.ok) {
        alert("Failed to export data. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "athro-goals-data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="text-sm text-[var(--muted)] hover:text-[var(--gold)] disabled:opacity-50"
    >
      {loading ? "Preparing download..." : "Download my data"}
    </button>
  );
}
