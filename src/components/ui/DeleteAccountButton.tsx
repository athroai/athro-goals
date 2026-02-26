"use client";

import { useState } from "react";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        alert("Failed to delete account. Please contact support.");
        return;
      }
      window.location.href = "/login";
    } catch {
      alert("Failed to delete account.");
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-sm font-medium text-red-300">
          This will permanently delete your account and all pathway data. This cannot be undone.
        </p>
        <div className="mt-3 flex gap-3">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Yes, delete my account"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-full border border-[rgba(228,201,126,0.2)] px-4 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--light)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-red-400/70 hover:text-red-300"
    >
      Delete my account
    </button>
  );
}
