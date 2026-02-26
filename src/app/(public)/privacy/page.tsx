import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="mb-8 inline-block text-sm text-[var(--muted)] hover:text-[var(--gold)]">
        ← Back
      </Link>
      <h1 className="font-display text-3xl font-bold text-[var(--gold)]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: February 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">1. Who We Are</h2>
          <p>
            Athro Goals is operated by Athro AI Ltd, registered in Wales, United Kingdom. We are the data controller for your personal data. Contact:{" "}
            <a href="mailto:support@athrogoals.co.uk" className="text-[var(--gold)] hover:underline">
              support@athrogoals.co.uk
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">2. What Data We Collect</h2>
          <p>We collect the following data:</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li><strong className="text-[var(--light)]">Account data:</strong> email address, name (optional), password (hashed, stored by Supabase)</li>
            <li><strong className="text-[var(--light)]">Conversation data:</strong> messages you exchange with the AI about your goals</li>
            <li><strong className="text-[var(--light)]">Pathway data:</strong> generated life-goal pathways, steps, and associated metadata</li>
            <li><strong className="text-[var(--light)]">Payment data:</strong> processed by Stripe — we store your Stripe customer ID but never your card details</li>
            <li><strong className="text-[var(--light)]">Usage data:</strong> number of pathways generated, subscription tier</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">3. How We Use Your Data</h2>
          <p>We use your data to:</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li>Provide and improve the life-goal pathway service</li>
            <li>Generate personalised pathways based on your conversations</li>
            <li>Process payments and manage subscriptions</li>
            <li>Send essential service communications (e.g., email confirmation)</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p className="mt-2">
            We do <strong className="text-[var(--light)]">not</strong> sell your data to third parties. We do not use your data for advertising.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">4. AI Processing</h2>
          <p>
            Your conversation messages are sent to Anthropic&apos;s Claude AI to generate responses and pathways. Anthropic processes this data under their data processing agreement and does not use your data to train their models. See{" "}
            <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:underline">
              Anthropic&apos;s Privacy Policy
            </a>{" "}
            for details.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">5. Data Storage & Security</h2>
          <p>
            Your data is stored in a PostgreSQL database hosted by Supabase (EU/UK data centres). Authentication is handled by Supabase Auth. All data is encrypted in transit (TLS) and at rest. Payments are processed by Stripe, which is PCI-DSS compliant.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">6. Third-Party Processors</h2>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li><strong className="text-[var(--light)]">Supabase:</strong> authentication and database hosting</li>
            <li><strong className="text-[var(--light)]">Anthropic:</strong> AI processing for conversations and pathway generation</li>
            <li><strong className="text-[var(--light)]">Stripe:</strong> payment processing</li>
            <li><strong className="text-[var(--light)]">Vercel/Netlify:</strong> application hosting</li>
            <li><strong className="text-[var(--light)]">Resend:</strong> transactional email delivery</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">7. Your Rights (UK GDPR)</h2>
          <p>Under UK data protection law, you have the right to:</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li><strong className="text-[var(--light)]">Access:</strong> request a copy of your data (available via &quot;Download my data&quot; in Settings)</li>
            <li><strong className="text-[var(--light)]">Rectification:</strong> correct inaccurate personal data</li>
            <li><strong className="text-[var(--light)]">Erasure:</strong> delete your account and all associated data (available via &quot;Delete my account&quot; in Settings)</li>
            <li><strong className="text-[var(--light)]">Portability:</strong> receive your data in a structured, machine-readable format (JSON export)</li>
            <li><strong className="text-[var(--light)]">Object:</strong> object to processing of your data</li>
            <li><strong className="text-[var(--light)]">Complaint:</strong> lodge a complaint with the ICO (Information Commissioner&apos;s Office)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">8. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. When you delete your account, all data is permanently removed within 30 days. Backup copies may persist for up to 90 days before being purged.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">9. Cookies</h2>
          <p>
            We use essential cookies only for authentication and session management. We do not use tracking cookies, analytics cookies, or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">10. Children</h2>
          <p>
            The Service is intended for users aged 13 and over. Users under 13 must have parental or guardian consent. We do not knowingly collect data from children under 13 without such consent.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">11. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify registered users of material changes by email.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[var(--light)]">12. Contact</h2>
          <p>
            For privacy-related queries, contact{" "}
            <a href="mailto:support@athrogoals.co.uk" className="text-[var(--gold)] hover:underline">
              support@athrogoals.co.uk
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
