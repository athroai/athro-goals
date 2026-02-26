import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="bg-[var(--dark-bg)]">
      <header className="flex items-center justify-between border-b border-[rgba(228,201,126,0.15)] px-3 py-3 md:px-8 md:py-4">
        <span className="font-display text-base font-bold text-[var(--gold)] md:text-xl">
          Athro Goals
        </span>
        <nav className="flex shrink-0 gap-2 md:gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="btn-cta inline-flex items-center justify-center whitespace-nowrap !px-3 !py-1.5 text-xs md:!px-4 md:!py-2 md:text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-secondary inline-flex items-center justify-center whitespace-nowrap !px-3 !py-1.5 text-xs md:!px-4 md:!py-2 md:text-sm"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="btn-cta inline-flex items-center justify-center whitespace-nowrap !px-3 !py-1.5 text-xs md:!px-4 md:!py-2 md:text-sm"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <h1 className="font-display text-4xl font-black tracking-tight md:text-5xl lg:text-6xl">
          <span className="gradient-text-hero">Your path</span>
          <br />
          to any goal
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
          Mortgage, quit smoking, run a marathon, get a dog — tell us your goal and when you want
          to achieve it. We&apos;ll build you a step-by-step pathway with real dates and costs.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          {user ? (
            <Link href="/goal/new" className="btn-cta inline-flex px-8 py-4 text-lg">
              Create a pathway
            </Link>
          ) : (
            <Link
              href="/register"
              className="btn-cta inline-flex items-center justify-center px-8 py-4 text-lg"
            >
              Get started
            </Link>
          )}
          <Link
            href="/login"
            className="btn-secondary inline-flex items-center justify-center px-8 py-4 text-lg"
          >
            I have an account
          </Link>
        </div>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-[rgba(228,201,126,0.15)] bg-[var(--card-bg)] p-6">
            <h3 className="font-display font-semibold text-[var(--gold)]">Definite dates</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Not &quot;in a few years&quot; — real dates like &quot;Apply by March 2027&quot;.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(228,201,126,0.15)] bg-[var(--card-bg)] p-6">
            <h3 className="font-display font-semibold text-[var(--gold)]">Real data</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Timelines and costs from gov.uk, MoneyHelper, and trusted sources.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(228,201,126,0.15)] bg-[var(--card-bg)] p-6">
            <h3 className="font-display font-semibold text-[var(--gold)]">No hallucination</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              We only use information from our tools and knowledge base — never guess.
            </p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
