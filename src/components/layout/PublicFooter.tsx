import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-[rgba(228,201,126,0.15)] px-4 py-6 text-center text-sm text-[var(--muted)]">
      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/terms" className="transition hover:text-[var(--gold)]">
          Terms &amp; Conditions
        </Link>
        <Link href="/privacy" className="transition hover:text-[var(--gold)]">
          Privacy Policy
        </Link>
        <Link href="/help" className="transition hover:text-[var(--gold)]">
          Help
        </Link>
      </div>
      <p className="mt-3">
        <a
          href="https://athroapps.com"
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-[var(--gold)]"
        >
          Athro Goals — part of the Athro AI ecosystem
        </a>
      </p>
    </footer>
  );
}
