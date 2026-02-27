import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export async function Header() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (authUser) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: authUser.id },
      select: { name: true, email: true },
    });
    displayName = dbUser?.name || dbUser?.email || authUser.email || null;
  }

  return (
    <header className="flex items-center justify-between border-b border-[rgba(228,201,126,0.1)] bg-[var(--darker-bg)]/50 px-4 py-3 backdrop-blur-sm">
      <Link href="/dashboard" className="font-display text-lg font-bold text-[var(--gold)]">
        Athro Goals
      </Link>
      <div className="flex items-center gap-4">
        <a
          href="https://athroapps.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--muted)] transition hover:text-[var(--gold)]"
        >
          Athro Goals — part of the Athro AI ecosystem
        </a>
        {authUser ? (
          <>
            {displayName && (
              <span className="text-xs text-[var(--muted)]">{displayName}</span>
            )}
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="rounded-full border border-[rgba(228,201,126,0.2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--gold)] hover:text-[var(--gold)]">
                Log out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="rounded-full border border-[rgba(228,201,126,0.2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--gold)] hover:text-[var(--gold)]">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
