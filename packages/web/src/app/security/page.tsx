import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security Overview | DraftPilot',
  description: 'Learn about DraftPilot enterprise security architecture: TLS 1.3 encryption, PostgreSQL Row-Level Security (RLS) tenant isolation, Chrome MV3 sandbox, and compliance.',
};

export default function SecurityOverviewPage() {
  const securityPillars = [
    {
      icon: '🔐',
      title: 'Encryption Everywhere',
      description: 'All traffic is encrypted in transit using TLS 1.3 with modern cipher suites. Database records and vector embeddings are encrypted at rest using AES-256.',
      badge: 'TLS 1.3 / AES-256',
    },
    {
      icon: '🏢',
      title: 'PostgreSQL Row-Level Security',
      description: 'Strict PostgreSQL Row-Level Security (RLS) policies enforce multi-tenant isolation at the database kernel level across all 11 tables. Cross-tenant leakage is impossible.',
      badge: 'Kernel RLS Isolation',
    },
    {
      icon: '🧩',
      title: 'Chrome MV3 Sandboxing',
      description: 'Built on Chrome Manifest V3 with isolated content script execution worlds. We forbid remote code execution and scope host permissions strictly to Gmail.',
      badge: 'Manifest V3 Verified',
    },
    {
      icon: '🤖',
      title: 'Edge Bot & Abuse Defense',
      description: 'Edge-level bot detection via Vercel BotID prevents credential stuffing. NestJS Throttler applies strict IP and user-level rate limiting on all API routes.',
      badge: 'Edge BotID Defense',
    },
    {
      icon: '🚫',
      title: 'Zero LLM Model Training',
      description: 'We do not train foundation models on your customer emails, team macros, or drafts. All API interactions with OpenRouter and OpenAI are strictly ephemeral.',
      badge: 'Zero Training Policy',
    },
    {
      icon: '💳',
      title: 'PCI-DSS Compliant Payments',
      description: 'All payment processing is handled exclusively by Stripe, a certified PCI-DSS Level 1 Service Provider. DraftPilot never touches or stores raw credit card data.',
      badge: 'Stripe PCI Level 1',
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
            <span>Security &amp; Compliance</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-text mb-4">
            Security Overview
          </h1>
          <p className="text-sm md:text-base text-text-dim max-w-3xl leading-relaxed">
            DraftPilot is engineered from the ground up to protect your customer relationships, proprietary support macros, and operational data.
          </p>
        </div>

        {/* Security Pillars Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {securityPillars.map((pillar, i) => (
            <div 
              key={i} 
              className="p-6 rounded-3xl bg-bg-card border border-border hover:border-accent/40 transition-all flex flex-col justify-between space-y-4 shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{pillar.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim px-2.5 py-1 rounded-full bg-elevated border border-border">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-text mb-2">{pillar.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{pillar.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Deep Dive 1: Database Multi-Tenancy & RLS */}
        <div className="p-6 md:p-8 rounded-3xl bg-bg-card border border-border shadow-xl mb-12 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 text-accent-light flex items-center justify-center font-bold">
              🛡️
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Kernel-Enforced Tenant Isolation</h2>
              <p className="text-xs text-text-dim">PostgreSQL Row-Level Security (RLS) on all 11 tables</p>
            </div>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Multi-tenant SaaS architectures often rely solely on application-level filtering (e.g. `WHERE team_id = ...`), where a single developer error can leak data across workspaces. DraftPilot enforces data isolation at the database kernel level using PostgreSQL Row-Level Security. Every authenticated query executes within the context of the user&apos;s verified JWT, ensuring:
          </p>
          <div className="p-4 rounded-2xl bg-elevated border border-border/70 font-mono text-xs text-accent-light space-y-1 overflow-x-auto">
            <p className="text-text-dim">// Database policy applied to macros, documents, and draft history:</p>
            <p className="text-emerald-400">CREATE POLICY &quot;Team Isolation Policy&quot; ON macros</p>
            <p className="text-text">  FOR ALL TO authenticated</p>
            <p className="text-text">  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));</p>
          </div>
        </div>

        {/* Deep Dive 2: Chrome Extension Security */}
        <div className="p-6 md:p-8 rounded-3xl bg-bg-card border border-border shadow-xl mb-12 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan/20 text-cyan flex items-center justify-center font-bold">
              🧩
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Chrome Manifest V3 Security Sandbox</h2>
              <p className="text-xs text-text-dim">Zero remote scripts • Scoped permissions • Content script isolation</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-elevated border border-border/60">
              <p className="font-bold text-text mb-1">No Remote Code Execution</p>
              <p className="text-text-muted">Manifest V3 completely forbids evaluating remote strings or loading external scripts. Every line of code running in your browser is bundled and verified.</p>
            </div>
            <div className="p-4 rounded-2xl bg-elevated border border-border/60">
              <p className="font-bold text-text mb-1">Strict Domain Scoping</p>
              <p className="text-text-muted">Host permissions are restricted strictly to `mail.google.com`. DraftPilot cannot read tabs, pages, or DOM elements on any other domain.</p>
            </div>
            <div className="p-4 rounded-2xl bg-elevated border border-border/60">
              <p className="font-bold text-text mb-1">Isolated DOM Worlds</p>
              <p className="text-text-muted">Extension content scripts run in isolated JavaScript contexts, preventing page scripts or malicious browser extensions from accessing DraftPilot state.</p>
            </div>
          </div>
        </div>

        {/* Infrastructure & Compliance Grid */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-text mb-4">Infrastructure &amp; Compliance Standards</h2>
          <div className="rounded-3xl border border-border bg-bg-card overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated text-text font-semibold border-b border-border">
                  <tr>
                    <th className="p-4">Component</th>
                    <th className="p-4">Provider</th>
                    <th className="p-4">Compliance Certifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-text-muted">
                  <tr>
                    <td className="p-4 font-semibold text-text">Database &amp; Vector Store</td>
                    <td className="p-4">Supabase (AWS)</td>
                    <td className="p-4">SOC 2 Type II, ISO 27001, HIPAA compliant</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">Web &amp; Edge Middleware</td>
                    <td className="p-4">Vercel Edge Network</td>
                    <td className="p-4">SOC 2 Type II, ISO 27001</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">Payment Gateway</td>
                    <td className="p-4">Stripe</td>
                    <td className="p-4">PCI-DSS Level 1 Service Provider</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-text">AI Inference Gateway</td>
                    <td className="p-4">OpenRouter / OpenAI</td>
                    <td className="p-4">Zero Data Retention (ZDR) APIs, SOC 2 Type II</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Vulnerability Reporting / Bug Bounty */}
        <div className="p-6 md:p-8 rounded-3xl bg-elevated/60 border border-border space-y-4">
          <div className="flex items-center gap-2 text-text font-bold text-base">
            <span>🛡️</span>
            <span>Vulnerability Disclosure Program</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            We welcome responsible security disclosures from researchers and users. If you discover a potential vulnerability in DraftPilot&apos;s web application, API, or Chrome extension, please report it directly to our security team. We acknowledge all reports within 24 hours and provide rapid remediation.
          </p>
          <div className="p-4 rounded-2xl bg-bg border border-border/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-text">Security Contact</p>
              <p className="text-text-dim">Email: <a href="mailto:security@draftpilot.app" className="text-accent-light">security@draftpilot.app</a></p>
            </div>
            <div className="text-[11px] text-text-dim">
              <span>Response SLA: &lt;24 hours • Triage: &lt;72 hours</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
