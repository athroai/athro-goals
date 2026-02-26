"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PathwayData = {
  id: string;
  goal: string;
  status: string;
  totalSteps: number | null;
  estimatedYears: number | null;
  estimatedTotalCost: number | null;
  pathwayData: unknown;
  folderId: string | null;
  updatedAt: string;
  chatMessages: { content: string }[];
};

type FolderData = {
  id: string;
  name: string;
  pathwayCount: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  INTAKE: { label: "In conversation", color: "text-blue-400" },
  GENERATING: { label: "Building pathway", color: "text-yellow-400" },
  COMPLETE: { label: "Complete", color: "text-[var(--bright-green)]" },
  ERROR: { label: "Failed", color: "text-red-400" },
  ARCHIVED: { label: "Archived", color: "text-[var(--muted)]" },
};

export function DashboardClient({
  pathways: initialPathways,
  folders: initialFolders,
  folderLimit,
  tier,
}: {
  pathways: PathwayData[];
  folders: FolderData[];
  folderLimit: number;
  tier: string;
}) {
  const router = useRouter();
  const [pathways, setPathways] = useState(initialPathways);
  const [folders, setFolders] = useState(initialFolders);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null);

  const filtered = activeFolder
    ? pathways.filter((p) => p.folderId === activeFolder)
    : pathways;

  const active = filtered.filter(
    (p) => p.status === "COMPLETE" || p.status === "GENERATING"
  );
  const conversations = filtered.filter((p) => p.status === "INTAKE");
  const failed = filtered.filter((p) => p.status === "ERROR");

  const [cloning, setCloning] = useState<string | null>(null);

  const closeMenus = useCallback(() => {
    setMenuOpen(null);
    setMoveTarget(null);
    setFolderMenuOpen(null);
  }, []);

  async function handleEdit(pathway: PathwayData) {
    if (pathway.status === "INTAKE") {
      router.push(`/goal/new?resume=${pathway.id}`);
      return;
    }
    setCloning(pathway.id);
    try {
      const res = await fetch(`/api/pathway/${pathway.id}/clone`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/goal/new?resume=${data.id}`);
      } else {
        alert(data.error ?? "Could not clone pathway");
        setCloning(null);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setCloning(null);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/pathway/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPathways((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    }
  }

  async function handleMove(pathwayId: string, folderId: string | null) {
    const res = await fetch(`/api/pathway/${pathwayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (res.ok) {
      setPathways((prev) =>
        prev.map((p) => (p.id === pathwayId ? { ...p, folderId } : p))
      );
      setFolders((prev) =>
        prev.map((f) => ({
          ...f,
          pathwayCount:
            f.id === folderId
              ? f.pathwayCount + 1
              : f.pathwayCount -
                (pathways.find((p) => p.id === pathwayId)?.folderId === f.id
                  ? 1
                  : 0),
        }))
      );
    }
    closeMenus();
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    const data = await res.json();
    if (res.ok && data.folder) {
      setFolders((prev) =>
        [...prev, { id: data.folder.id, name: data.folder.name, pathwayCount: 0 }].sort(
          (a, b) => a.name.localeCompare(b.name)
        )
      );
      setNewFolderName("");
      setShowNewFolder(false);
    } else {
      alert(data.error ?? "Could not create folder");
    }
  }

  async function handleRenameFolder(id: string) {
    if (!renameValue.trim()) return;
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    if (res.ok) {
      setFolders((prev) =>
        prev
          .map((f) => (f.id === id ? { ...f, name: renameValue.trim() } : f))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    setRenamingFolder(null);
    setFolderMenuOpen(null);
  }

  async function handleDeleteFolder(id: string) {
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setPathways((prev) =>
        prev.map((p) => (p.folderId === id ? { ...p, folderId: null } : p))
      );
      if (activeFolder === id) setActiveFolder(null);
    }
    setDeleteFolderConfirm(null);
    setFolderMenuOpen(null);
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="mx-auto max-w-5xl space-y-6 p-4 pb-20 md:p-6 md:pb-6 lg:p-8 lg:pb-8"
      onClick={() => closeMenus()}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-[var(--gold)]">
          My pathways
        </h1>
        <Link
          href="/goal/new"
          className="btn-cta inline-flex w-fit items-center justify-center"
        >
          New pathway
        </Link>
      </div>

      {/* Folder chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveFolder(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeFolder === null
              ? "bg-[var(--gold)] text-[var(--dark-bg)]"
              : "border border-[rgba(228,201,126,0.2)] text-[var(--muted)] hover:border-[var(--gold)]/40"
          }`}
        >
          All ({pathways.length})
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="relative">
            {renamingFolder === folder.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRenameFolder(folder.id);
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameFolder(folder.id)}
                  className="w-24 rounded-full border border-[var(--gold)]/40 bg-transparent px-3 py-1 text-xs text-[var(--light)] outline-none"
                />
              </form>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFolder(folder.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFolderMenuOpen(folderMenuOpen === folder.id ? null : folder.id);
                }}
                className={`group rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeFolder === folder.id
                    ? "bg-[var(--gold)] text-[var(--dark-bg)]"
                    : "border border-[rgba(228,201,126,0.2)] text-[var(--muted)] hover:border-[var(--gold)]/40"
                }`}
              >
                {folder.name}
                <span className="ml-1 opacity-60">
                  ({folder.pathwayCount})
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setFolderMenuOpen(
                      folderMenuOpen === folder.id ? null : folder.id
                    );
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-60"
                >
                  ···
                </span>
              </button>
            )}
            {folderMenuOpen === folder.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-1 w-36 rounded-xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-1 shadow-lg"
              >
                <button
                  onClick={() => {
                    setRenamingFolder(folder.id);
                    setRenameValue(folder.name);
                    setFolderMenuOpen(null);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--light)] hover:bg-[rgba(228,201,126,0.08)]"
                >
                  Rename
                </button>
                <button
                  onClick={() => setDeleteFolderConfirm(folder.id)}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10"
                >
                  Delete folder
                </button>
              </div>
            )}
            {deleteFolderConfirm === folder.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-red-400/30 bg-[var(--card-bg)] p-3 shadow-lg"
              >
                <p className="text-xs text-[var(--light)]">
                  Delete &ldquo;{folder.name}&rdquo;? Pathways won&apos;t be deleted.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setDeleteFolderConfirm(null);
                      setFolderMenuOpen(null);
                    }}
                    className="rounded-lg border border-[rgba(228,201,126,0.2)] px-3 py-1.5 text-xs text-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {showNewFolder ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateFolder();
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => {
                if (!newFolderName.trim()) setShowNewFolder(false);
              }}
              placeholder="Folder name"
              className="w-28 rounded-full border border-[var(--gold)]/40 bg-transparent px-3 py-1 text-xs text-[var(--light)] outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--gold)]/20 px-2 py-1 text-xs text-[var(--gold)]"
            >
              Add
            </button>
          </form>
        ) : (
          folders.length < folderLimit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewFolder(true);
              }}
              className="rounded-full border border-dashed border-[rgba(228,201,126,0.2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
            >
              + Folder
            </button>
          )
        )}
      </div>

      {/* Pathway sections */}
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Pathways
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <PathwayCard
                key={p.id}
                pathway={p}
                folders={folders}
                menuOpen={menuOpen === p.id}
                deleteConfirm={deleteConfirm === p.id}
                moveTarget={moveTarget === p.id}
                tier={tier}
                onMenuToggle={(id) => {
                  setMenuOpen(menuOpen === id ? null : id);
                  setMoveTarget(null);
                }}
                onDeleteStart={() => {
                  setDeleteConfirm(p.id);
                  setMenuOpen(null);
                }}
                onDeleteConfirm={() => handleDelete(p.id)}
                onDeleteCancel={() => setDeleteConfirm(null)}
                onMoveStart={() => {
                  setMoveTarget(p.id);
                  setMenuOpen(null);
                }}
                onMove={(folderId) => handleMove(p.id, folderId)}
                onEdit={() => handleEdit(p)}
                cloning={cloning === p.id}
              />
            ))}
          </ul>
        </section>
      )}

      {conversations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Conversations in progress
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conversations.map((p) => (
              <PathwayCard
                key={p.id}
                pathway={p}
                folders={folders}
                isConversation
                menuOpen={menuOpen === p.id}
                deleteConfirm={deleteConfirm === p.id}
                moveTarget={moveTarget === p.id}
                tier={tier}
                onMenuToggle={(id) => {
                  setMenuOpen(menuOpen === id ? null : id);
                  setMoveTarget(null);
                }}
                onDeleteStart={() => {
                  setDeleteConfirm(p.id);
                  setMenuOpen(null);
                }}
                onDeleteConfirm={() => handleDelete(p.id)}
                onDeleteCancel={() => setDeleteConfirm(null)}
                onMoveStart={() => {
                  setMoveTarget(p.id);
                  setMenuOpen(null);
                }}
                onMove={(folderId) => handleMove(p.id, folderId)}
                onEdit={() => handleEdit(p)}
                cloning={cloning === p.id}
              />
            ))}
          </ul>
        </section>
      )}

      {failed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Failed
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {failed.map((p) => (
              <PathwayCard
                key={p.id}
                pathway={p}
                folders={folders}
                menuOpen={menuOpen === p.id}
                deleteConfirm={deleteConfirm === p.id}
                moveTarget={moveTarget === p.id}
                tier={tier}
                onMenuToggle={(id) => {
                  setMenuOpen(menuOpen === id ? null : id);
                  setMoveTarget(null);
                }}
                onDeleteStart={() => {
                  setDeleteConfirm(p.id);
                  setMenuOpen(null);
                }}
                onDeleteConfirm={() => handleDelete(p.id)}
                onDeleteCancel={() => setDeleteConfirm(null)}
                onMoveStart={() => {
                  setMoveTarget(p.id);
                  setMenuOpen(null);
                }}
                onMove={(folderId) => handleMove(p.id, folderId)}
                onEdit={() => handleEdit(p)}
                cloning={cloning === p.id}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PathwayCard({
  pathway,
  folders,
  isConversation,
  menuOpen,
  deleteConfirm,
  moveTarget,
  tier,
  onMenuToggle,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
  onMoveStart,
  onMove,
  onEdit,
  cloning,
}: {
  pathway: PathwayData;
  folders: FolderData[];
  isConversation?: boolean;
  menuOpen: boolean;
  deleteConfirm: boolean;
  moveTarget: boolean;
  tier: string;
  onMenuToggle: (id: string) => void;
  onDeleteStart: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onMoveStart: () => void;
  onMove: (folderId: string | null) => void;
  onEdit: () => void;
  cloning?: boolean;
}) {
  const status = STATUS_LABELS[pathway.status] ?? {
    label: pathway.status,
    color: "text-[var(--muted)]",
  };

  const displayName =
    pathway.goal.length > 80
      ? pathway.goal.substring(0, 80) + "..."
      : pathway.goal.length > 0
        ? pathway.goal
        : pathway.chatMessages[0]?.content
          ? pathway.chatMessages[0].content.length > 60
            ? pathway.chatMessages[0].content.substring(0, 60) + "..."
            : pathway.chatMessages[0].content
          : "Untitled goal";

  const href = isConversation
    ? `/goal/new?resume=${pathway.id}`
    : `/pathway/${pathway.id}`;

  const timeAgo = getTimeAgo(new Date(pathway.updatedAt));
  const canEdit = tier !== "FREE" || isConversation;
  const currentFolderName = folders.find(
    (f) => f.id === pathway.folderId
  )?.name;

  return (
    <li className="relative">
      <Link
        href={href}
        className="card-hover block rounded-2xl border border-[rgba(228,201,126,0.15)] bg-[var(--card-bg)] p-4 transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-[var(--light)] line-clamp-2">
            {displayName}
          </h3>
          <span className="w-6 shrink-0" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
          <span className="text-xs text-[var(--muted)]">· {timeAgo}</span>
          {currentFolderName && (
            <span className="rounded-full bg-[rgba(228,201,126,0.08)] px-2 py-0.5 text-[10px] text-[var(--gold)]/70">
              {currentFolderName}
            </span>
          )}
        </div>
        {pathway.status === "COMPLETE" && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            {pathway.totalSteps != null && pathway.totalSteps > 0 && (
              <span>{pathway.totalSteps} steps</span>
            )}
            {pathway.estimatedYears != null && (
              <span>~{pathway.estimatedYears} years</span>
            )}
            {pathway.estimatedTotalCost != null && (
              <span className="text-[var(--gold)]">
                {pathway.estimatedTotalCost === 0
                  ? "Fully funded"
                  : `£${pathway.estimatedTotalCost.toLocaleString()} estimated cost`}
              </span>
            )}
          </div>
        )}
        {pathway.status === "GENERATING" && (
          <p className="mt-2 text-xs text-yellow-400/70">
            Building your pathway...
          </p>
        )}
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMenuToggle(pathway.id);
        }}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[rgba(228,201,126,0.1)] hover:text-[var(--light)]"
        aria-label="Pathway actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 top-10 z-20 w-40 rounded-xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-1 shadow-lg"
        >
          {canEdit && (pathway.status === "COMPLETE" || pathway.status === "ERROR") && (
            <button
              onClick={onEdit}
              disabled={cloning}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--light)] hover:bg-[rgba(228,201,126,0.08)] disabled:opacity-50"
            >
              <EditIcon /> {cloning ? "Cloning..." : "Edit (creates copy)"}
            </button>
          )}
          {folders.length > 0 && (
            <button
              onClick={onMoveStart}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--light)] hover:bg-[rgba(228,201,126,0.08)]"
            >
              <FolderIcon /> Move to folder
            </button>
          )}
          <button
            onClick={onDeleteStart}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10"
          >
            <TrashIcon /> Delete
          </button>
        </div>
      )}

      {moveTarget && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 top-10 z-20 w-44 rounded-xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-1 shadow-lg"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Move to
          </p>
          {pathway.folderId && (
            <button
              onClick={() => onMove(null)}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--muted)] hover:bg-[rgba(228,201,126,0.08)]"
            >
              Remove from folder
            </button>
          )}
          {folders
            .filter((f) => f.id !== pathway.folderId)
            .map((f) => (
              <button
                key={f.id}
                onClick={() => onMove(f.id)}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--light)] hover:bg-[rgba(228,201,126,0.08)]"
              >
                {f.name}
              </button>
            ))}
        </div>
      )}

      {deleteConfirm && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-[var(--dark-bg)]/90 backdrop-blur-sm"
        >
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--light)]">
              Delete this pathway?
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              This cannot be undone.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={onDeleteConfirm}
                className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={onDeleteCancel}
                className="rounded-lg border border-[rgba(228,201,126,0.2)] px-4 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--gold)]/40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
