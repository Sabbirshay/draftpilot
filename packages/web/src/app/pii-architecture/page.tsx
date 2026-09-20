import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'PII Architecture & Pre-Flight Sanitization | DraftPilot',
  description: 'Technical deep dive into DraftPilot client-side pre-flight PII redaction engine. How we scrub 8 sensitive data categories locally in your browser before network transmission.',
};

export default function PiiArchitecturePage() {
  const piiCategories = [
    {
      id: 'cards',
      icon: '💳',
      name: 'Credit Cards & CVVs',
      token: '[CARD_REDACTED]',
      pattern: '13–19 digit PANs, Visa/Mastercard/Amex/Discover, CVVs',
      exampleBefore: 'Refund to card 4111-2222-3333-4444 (CVV: 892)',
      exampleAfter: 'Refund to card [CARD_REDACTED]',
    },
    {
      id: 'emails',
      icon: '📧',
      name: 'Email Addresses',
      token: '[EMAIL_REDACTED]',
      pattern: 'RFC 5322 regex matching customer emails in thread body',
      exampleBefore: 'Contact my personal email at sarah.m@private.com',
      exampleAfter: 'Contact my personal email at [EMAIL_REDACTED]',
    },
    {
      id: 'ssn',
      icon: '🪪',
      name: 'Social Security Numbers',
      token: '[SSN_REDACTED]',
      pattern: 'US 9-digit SSNs (xxx-xx-xxxx or xxxxxxxxx)',
      exampleBefore: 'Identity verification: SSN is 123-45-6789',
      exampleAfter: 'Identity verification: SSN is [SSN_REDACTED]',
    },
    {
      id: 'phones',
      icon: '📞',
      name: 'Phone Numbers',
      token: '[PHONE_REDACTED]',
      pattern: 'International E.164 & North American 7–15 digit phone patterns',
      exampleBefore: 'Call me back at +1 (555) 439-8201 today',
      exampleAfter: 'Call me back at [PHONE_REDACTED] today',
    },
    {
      id: 'addresses',
      icon: '📍',
      name: 'Physical Street Addresses',
      token: '[ADDRESS_REDACTED]',
      pattern: 'Street number, street name, city, state, and postal code',
      exampleBefore: 'Ship replacement to 742 Evergreen Terrace, Springfield, OR 97477',
      exampleAfter: 'Ship replacement to [ADDRESS_REDACTED]',
    },
    {
      id: 'ip',
      icon: '🌐',
      name: 'IPv4 & Network Addresses',
      token: '[IP_REDACTED]',
      pattern: 'Dotted quad IPv4 addresses and private network subnets',
      exampleBefore: 'Originating connection from IP 192.168.1.105',
      exampleAfter: 'Originating connection from IP [IP_REDACTED]',
    },
    {
      id: 'tokens',
      icon: '🔑',
      name: 'API Keys & JWT Tokens',
      token: '[TOKEN_REDACTED]',
      pattern: 'Bearer tokens, OpenAI keys (sk-), GitHub tokens (ghp-), AWS keys, JWTs',
      exampleBefore: 'Auth Header: Bearer eyJhbGciOiJIUzI1NiIsInR5c...',
      exampleAfter: 'Auth Header: [TOKEN_REDACTED]',
    },
    {
      id: 'passwords',
      icon: '🔒',
      name: 'Passwords & Secrets',
      token: '[SECRET_REDACTED]',
      pattern: 'Password labels, passcodes, temporary 2FA tokens, secret keys',
      exampleBefore: 'Temporary passcode: SecretReset2026! for emergency access',
      exampleAfter: 'Temporary passcode: [SECRET_REDACTED] for emergency access',
    },
  ];

  return (
    <div className="py-16 md:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Top Header / Breadcrumb */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent-light transition-colors mb-4"
          >
            <span>← Back to Home</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent-light text-xs font-semibold uppercase tracking-wider mb-3">
            <span>Security &amp; Architecture</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-text mb-4">
            PII Architecture &amp; Pre-Flight Scrubbing
          </h1>
          <p className="text-sm md:text-base text-text-dim max-w-3xl leading-relaxed">
            How DraftPilot ensures zero customer personally identifiable information (PII) ever leaves your browser or reaches an external AI model.
          </p>
        </div>

        {/* The Core Principle Box */}
        <div className="p-6 md:p-8 rounded-3xl bg-bg-card border border-border shadow-2xl mb-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              🛡️
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">The Pre-Flight Principle</h2>
              <p className="text-xs text-text-dim">Execution Order: Browser Local Memory &gt; Network Transmission</p>
            </div>
          </div>
          <p className="text-xs md:text-sm text-text-muted leading-relaxed mb-6">
            In standard AI customer support tools, entire customer email threads—including credit cards, home addresses, and phone numbers—are uploaded to remote servers and passed straight to LLM providers.
            <br /><br />
            <strong>DraftPilot reverses this pattern:</strong> Our client-side Content Script intercepts email text in your Gmail tab, executes a multi-stage regex sanitization cascade entirely in local memory, and replaces sensitive data with neutral tokens before any HTTP request is dispatched.
          </p>

          {/* Flow Diagram */}
          <div className="p-4 md:p-6 rounded-2xl bg-elevated border border-border/70 space-y-4">
            <p className="text-xs font-bold text-text uppercase tracking-wider">Sanitization Pipeline Flow</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-bg border border-border/60">
                <span className="text-[10px] font-mono text-cyan block mb-1">01. INGESTION</span>
                <p className="font-semibold text-text mb-1">Gmail DOM Extraction</p>
                <p className="text-text-dim text-[11px]">MutationObserver extracts visible message text from Gmail compose thread.</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] font-mono text-emerald-400 block mb-1">02. CLIENT SCRUBBER</span>
                <p className="font-semibold text-emerald-300 mb-1">Local Regex Engine</p>
                <p className="text-text-dim text-[11px]">8 pattern groups match cards, SSNs, phones, and secrets in browser memory.</p>
              </div>
              <div className="p-3 rounded-xl bg-bg border border-border/60">
                <span className="text-[10px] font-mono text-accent-light block mb-1">03. DISPATCH</span>
                <p className="font-semibold text-text mb-1">Sanitized TLS Payload</p>
                <p className="text-text-dim text-[11px]">Redacted payload sent to API. Raw PII has already been destroyed locally.</p>
              </div>
              <div className="p-3 rounded-xl bg-bg border border-border/60">
                <span className="text-[10px] font-mono text-purple-400 block mb-1">04. INFERENCE</span>
                <p className="font-semibold text-text mb-1">Zero-Training AI</p>
                <p className="text-text-dim text-[11px]">AI model generates draft using tokens. Discarded immediately after response.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Redaction Categories Grid */}
        <div className="mb-14">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-text mb-2">The 8 Redaction Pattern Categories</h2>
            <p className="text-xs text-text-dim">
              Every incoming thread is checked against these pattern classes in real-time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {piiCategories.map((cat) => (
              <div 
                key={cat.id} 
                className="p-5 rounded-3xl bg-bg-card border border-border hover:border-accent/40 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{cat.icon}</span>
                    <h3 className="text-sm font-bold text-text">{cat.name}</h3>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent-light font-bold">
                    {cat.token}
                  </span>
                </div>

                <p className="text-xs text-text-dim">{cat.pattern}</p>

                <div className="p-3 rounded-xl bg-elevated border border-border/50 text-[11px] font-mono space-y-1">
                  <div className="text-red-400/80 truncate">
                    <span className="text-text-dim select-none mr-2">BEFORE:</span>
                    {cat.exampleBefore}
                  </div>
                  <div className="text-emerald-400 truncate">
                    <span className="text-text-dim select-none mr-2">AFTER: </span>
                    {cat.exampleAfter}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison: Traditional Helpdesks vs. DraftPilot */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-text mb-4">Architecture Comparison</h2>
          <div className="rounded-3xl border border-border bg-bg-card overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated text-text font-semibold border-b border-border">
                  <tr>
                    <th className="p-4">Criteria</th>
                    <th className="p-4 text-accent-light bg-accent/10">DraftPilot Architecture</th>
                    <th className="p-4 text-text-muted">Traditional Help Desks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-text-muted">
                  <tr>
                    <td className="p-4 font-semibold text-text">Where PII is Scrubbed</td>
                    <td className="p-4 font-bold text-emerald-400 bg-accent/5">Client-side in browser memory</td>
                    <td className="p-4">Server-side after ingestion (or not at all)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">Customer Data Ingestion</td>
                    <td className="p-4 font-bold text-emerald-400 bg-accent/5">Zero persistent thread storage</td>
                    <td className="p-4">Millions of emails stored permanently</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">LLM Exposure</td>
                    <td className="p-4 font-bold text-emerald-400 bg-accent/5">Sees only redacted tokens</td>
                    <td className="p-4">Exposed to raw customer conversation</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">Breach Surface</td>
                    <td className="p-4 font-bold text-emerald-400 bg-accent/5">Minimal: no stored customer database</td>
                    <td className="p-4">Massive: centralized high-value target</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">GDPR Compliance Effort</td>
                    <td className="p-4 font-bold text-emerald-400 bg-accent/5">Zero &ldquo;Right to Erasure&rdquo; friction for emails</td>
                    <td className="p-4">Complex multi-system deletion workflows</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Whitelisting & Support Contacts */}
        <div className="p-6 md:p-8 rounded-3xl bg-elevated/60 border border-border space-y-4">
          <h2 className="text-lg font-bold text-text">Smart Name &amp; Greeting Preservation</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            While confidential identifiers (cards, SSNs, phone numbers) are masked aggressively, DraftPilot&apos;s name extraction engine specifically extracts the customer&apos;s first name from the email header (`From:` field) to allow natural greetings like <code className="text-accent-light">&ldquo;Hi Sarah,&rdquo;</code> without exposing their private email or correspondence history to the AI.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link 
              href="/privacy" 
              className="text-xs text-accent-light hover:underline flex items-center gap-1"
            >
              <span>View Privacy Policy</span>
              <span>→</span>
            </Link>
            <Link 
              href="/security" 
              className="text-xs text-accent-light hover:underline flex items-center gap-1"
            >
              <span>View Security Overview</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
