import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | DraftPilot',
  description: 'Learn how DraftPilot safeguards your data with client-side PII scrubbing, zero model training, and ephemeral email processing.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="py-16 md:py-24 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb / Top Tag */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent-light transition-colors mb-4"
          >
            <span>← Back to Home</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent-light text-xs font-semibold uppercase tracking-wider mb-3">
            <span>Legal &amp; Privacy</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-text mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-text-dim">
            <strong>Effective Date:</strong> September 2026 • <strong>Version:</strong> 2.0 (Chrome MV3 &amp; Global AI Compliance)
          </p>
        </div>

        {/* Executive Summary Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-bg-card border border-border shadow-xl mb-12 space-y-4">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <span>🛡️</span>
            <span>Privacy Summary at a Glance</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-elevated border border-border/60">
              <p className="font-bold text-emerald-400 mb-1">Local PII Redaction</p>
              <p className="text-text-muted">Sensitive customer data (cards, phones, emails, passwords) is scrubbed client-side before ever leaving your browser.</p>
            </div>
            <div className="p-4 rounded-2xl bg-elevated border border-border/60">
              <p className="font-bold text-cyan mb-1">Zero AI Training</p>
              <p className="text-text-muted">Your emails, customer data, and macros are never used to train OpenAI, OpenRouter, or any third-party AI models.</p>
            </div>
            <div className="p-4 rounded-2xl bg-elevated border border-border/60">
              <p className="font-bold text-accent-light mb-1">Ephemeral Processing</p>
              <p className="text-text-muted">Email thread text is held in memory only for the duration of the draft generation request and immediately discarded.</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-10 text-sm text-text-muted leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">1. Introduction</h2>
            <p>
              DraftPilot (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) provides an AI-assisted customer support drafting co-pilot that operates directly within Gmail via a Chrome Manifest V3 extension, backed by our web dashboard.
            </p>
            <p>
              We believe privacy is a fundamental right. Unlike traditional helpdesks that ingest and store millions of customer support conversations into centralized databases, DraftPilot is architected with a <strong>Privacy-by-Design</strong> foundation. This policy explains what information we collect, what we do not collect, and how your data is handled.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">2. What Data We Collect</h2>
            <p>We only collect and process data strictly required to deliver our drafting assistance:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-text">Account Information:</strong> When you create an account, we collect your email address, name, and encrypted authentication credentials (managed via Supabase Auth).
              </li>
              <li>
                <strong className="text-text">Team Macros &amp; Knowledge Base:</strong> The templates, canned responses, and documentation snippets you explicitly upload to teach DraftPilot your company&apos;s policies and tone of voice.
              </li>
              <li>
                <strong className="text-text">Ephemeral Email Thread Context:</strong> When you trigger draft generation in Gmail, the extension reads the active thread text. <strong className="text-emerald-400">All recognizable Personally Identifiable Information (PII) is scrubbed client-side in your browser before the text leaves your machine.</strong>
              </li>
              <li>
                <strong className="text-text">Usage Telemetry &amp; Quotas:</strong> Non-sensitive metadata such as draft counts, timestamp of generation, and active seats to enforce subscription tiers and rate limits.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">3. What Data We DO NOT Collect or Store</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-text">No Raw Customer PII:</strong> Credit cards, Social Security numbers, phone numbers, passwords, and private tokens are masked locally. We never receive or store raw customer personal data.
              </li>
              <li>
                <strong className="text-text">No Permanent Email Storage:</strong> We do not store your inbox emails, attachments, or conversation histories on our servers. Once a draft response is generated and delivered to your extension, the thread text is purged from volatile memory.
              </li>
              <li>
                <strong className="text-text">No AI Model Training:</strong> None of your data, macros, customer messages, or generated drafts are sold or used to train foundational AI models.
              </li>
              <li>
                <strong className="text-text">No Unrelated Gmail Access:</strong> Our Chrome extension is scoped strictly to active reply contexts. It does not index, read, or catalog emails outside of the thread you are actively replying to.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">4. How Data Flows During Draft Generation</h2>
            <ol className="list-decimal pl-5 space-y-2.5">
              <li><strong className="text-text">Detection:</strong> You open a conversation in Gmail (`mail.google.com`).</li>
              <li><strong className="text-text">Client-Side Scrubbing:</strong> The browser extension runs regular-expression sanitization across 8 sensitive categories, replacing confidential details with tokens like `[CARD_REDACTED]` or `[EMAIL_REDACTED]`.</li>
              <li><strong className="text-text">Secure Dispatch:</strong> The sanitized text is transmitted over TLS 1.3 to our API.</li>
              <li><strong className="text-text">AI Inference:</strong> The API forwards the sanitized prompt along with your team&apos;s matching macros to our inference providers (OpenRouter / OpenAI).</li>
              <li><strong className="text-text">Draft Return &amp; Memory Purge:</strong> The drafted reply is returned to your extension sidepanel and injected into your Gmail compose box upon your confirmation. The thread context is discarded.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">5. Third-Party Subprocessors</h2>
            <p>We work with trusted infrastructure providers that adhere to rigorous security and privacy standards:</p>
            <div className="border border-border rounded-2xl overflow-hidden mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated text-text font-semibold border-b border-border">
                  <tr>
                    <th className="p-3">Subprocessor</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Data Handled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="p-3 font-medium text-text">Supabase Inc.</td>
                    <td className="p-3">Database &amp; Authentication</td>
                    <td className="p-3">User accounts, team macros, subscription status</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-text">Stripe Inc.</td>
                    <td className="p-3">Payment Processing</td>
                    <td className="p-3">Billing details, seat subscriptions (PCI-DSS compliant)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-text">OpenRouter / OpenAI</td>
                    <td className="p-3">AI Model Inference</td>
                    <td className="p-3">Ephemeral, PII-scrubbed thread context &amp; macro prompts</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-text">Vercel Inc.</td>
                    <td className="p-3">Web Hosting &amp; Edge Protection</td>
                    <td className="p-3">Application delivery, edge anti-bot telemetry</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">6. Data Retention &amp; Deletion</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-text">Account Information &amp; Macros:</strong> Retained for the duration of your active subscription. You can edit or delete macros at any time from your dashboard.</li>
              <li><strong className="text-text">Account Deletion:</strong> Upon account termination or written request, all associated user data, macros, and team records are permanently purged within 30 days.</li>
              <li><strong className="text-text">Draft History Snippets:</strong> Truncated generation logs stored for quota audit purposes are automatically expired after 90 days.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">7. Your Rights (GDPR &amp; CCPA/CPRA Compliance)</h2>
            <p>Regardless of your geographic location, DraftPilot provides all users with the following rights:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-text">Right of Access:</strong> Request an export of all personal data held in your account.</li>
              <li><strong className="text-text">Right to Rectification:</strong> Update inaccurate account or team information.</li>
              <li><strong className="text-text">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Delete your workspace and all corresponding records.</li>
              <li><strong className="text-text">No Sale of Personal Information:</strong> We do not sell, rent, or lease your personal information to any third parties for monetary or other considerations.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us directly at <a href="mailto:privacy@draftpilot.app" className="text-accent-light underline">privacy@draftpilot.app</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">8. Chrome Web Store Compliance</h2>
            <p>
              DraftPilot adheres to the Chrome Web Store Developer Program Policies, specifically the User Data FAQ and Limited Use requirements:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>We request only the minimum permissions necessary (`sidePanel`, `storage`, `activeTab`, `tabs`, and `mail.google.com`).</li>
              <li>We do not transfer user data to third parties for advertising or credit determination purposes.</li>
              <li>All operations are strictly aligned with our single declared purpose: drafting customer support replies inside Gmail.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text">9. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data protection practices, please contact our Data Protection Officer at:
            </p>
            <div className="p-4 rounded-2xl bg-elevated border border-border text-xs space-y-1">
              <p className="text-text font-semibold">DraftPilot Privacy &amp; Legal Team</p>
              <p>Email: <a href="mailto:privacy@draftpilot.app" className="text-accent-light">privacy@draftpilot.app</a></p>
              <p>Security Team: <a href="mailto:security@draftpilot.app" className="text-accent-light">security@draftpilot.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
