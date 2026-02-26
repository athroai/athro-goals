import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-6">
      <Link href="/" className="mb-2 inline-block text-sm text-[var(--muted)] hover:text-[var(--gold)]">
        &larr; Back
      </Link>
      <h1 className="font-display text-2xl font-bold text-[var(--gold)]">
        Help &amp; Support
      </h1>

      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--light)]">
          How it works
        </h2>
        <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-xs font-bold text-[var(--gold)]">1</span>
            <p>Tell us your goal — mortgage, marathon, quit smoking, get a dog — and when you want to achieve it.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-xs font-bold text-[var(--gold)]">2</span>
            <p>Share your situation: where you&apos;re starting from, what you&apos;ve tried, what&apos;s in your way.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-xs font-bold text-[var(--gold)]">3</span>
            <p>We build a step-by-step pathway with real dates, costs, and guidance from trusted sources.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-xs font-bold text-[var(--gold)]">4</span>
            <p>Revisit your pathways any time from your dashboard. Organise them in folders.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--light)]">
          Frequently asked questions
        </h2>
        <div className="mt-3 space-y-4 text-sm">
          <div>
            <p className="font-medium text-[var(--light)]">Is the information accurate?</p>
            <p className="mt-1 text-[var(--muted)]">
              We use data from gov.uk, MoneyHelper, and other trusted sources where relevant. For finance goals we cite sources. However, it is guidance — always confirm important details with qualified advisors.
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--light)]">Can I edit my pathway after it&apos;s built?</p>
            <p className="mt-1 text-[var(--muted)]">
              You can start a new conversation and build a fresh pathway any time. Each conversation is saved so you can pick up where you left off. Paid plans can edit existing pathways (creates a copy).
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--light)]">How do subscriptions work?</p>
            <p className="mt-1 text-[var(--muted)]">
              Free accounts can generate 1 pathway per month. Explorer and Pro plans offer more. You can upgrade or cancel any time from Settings.
            </p>
          </div>
          <div>
            <p className="font-medium text-[var(--light)]">Can I delete my account?</p>
            <p className="mt-1 text-[var(--muted)]">
              Yes. Go to Settings and choose &quot;Delete my account&quot;. You can download your data first. Deletion is permanent.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(228,201,126,0.2)] bg-[var(--card-bg)] p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--light)]">
          Contact us
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Need help? Get in touch at{" "}
          <a href="mailto:support@athrogoals.co.uk" className="text-[var(--gold)] hover:underline">
            support@athrogoals.co.uk
          </a>
        </p>
      </section>
    </div>
  );
}
