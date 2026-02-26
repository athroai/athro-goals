"use client";

import { useState, useEffect } from "react";
import { isNativePlatform } from "@/lib/capacitor";

export function ExportPdfButton({ pathwayId }: { pathwayId: string }) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  async function handlePdfExport() {
    setLoadingPdf(true);
    setError(null);
    try {
      if (native) {
        const blob = await fetchPdfBlob();
        if (!blob) return;
        await sharePdfNative(blob);
      } else {
        const blob = await fetchPdfBlob();
        if (!blob) return;
        downloadPdf(blob);
      }
    } catch {
      setError("Could not export PDF.");
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleShareText() {
    setLoadingShare(true);
    setError(null);
    try {
      const res = await fetch("/api/pathway/export-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathwayId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Could not export.");
        return;
      }
      const { text, title } = (await res.json()) as { text: string; title: string };

      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: `Pathway: ${title}`,
        text,
        dialogTitle: "Save your pathway",
      });
    } catch {
      setError("Could not share pathway.");
    } finally {
      setLoadingShare(false);
    }
  }

  async function fetchPdfBlob(): Promise<Blob | null> {
    const res = await fetch("/api/pathway/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathwayId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Could not export PDF.");
      return null;
    }
    return res.blob();
  }

  function downloadPdf(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pathway.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function sharePdfNative(blob: Blob) {
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: "Pathway",
      url: dataUrl,
      dialogTitle: "Share your pathway PDF",
    });
  }

  const loading = loadingPdf || loadingShare;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {native && (
        <button
          type="button"
          onClick={handleShareText}
          disabled={loading}
          className="rounded-full border border-[rgba(228,201,126,0.3)] px-4 py-2 text-sm font-medium text-[var(--gold)] transition hover:bg-[rgba(228,201,126,0.1)] disabled:opacity-50"
        >
          {loadingShare ? "Preparing..." : "Share to Notes"}
        </button>
      )}
      <button
        type="button"
        onClick={handlePdfExport}
        disabled={loading}
        className="rounded-full border border-[rgba(228,201,126,0.3)] px-4 py-2 text-sm font-medium text-[var(--gold)] transition hover:bg-[rgba(228,201,126,0.1)] disabled:opacity-50"
      >
        {loadingPdf ? "Preparing PDF..." : native ? "Share PDF" : "Download PDF"}
      </button>
      {error && <span className="text-sm text-red-300">{error}</span>}
    </div>
  );
}
