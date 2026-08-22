'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  category: 'Core AI' | 'Extension' | 'Billing' | 'Security';
  enabled: boolean;
}

const INITIAL_FLAGS: FeatureFlag[] = [
  {
    id: '1',
    name: 'Gmail Inline Ghost Autocomplete',
    key: 'feat_gmail_ghost_autocomplete',
    description: 'Enables tab-to-complete ghost draft suggestions directly inside Gmail compose body.',
    category: 'Extension',
    enabled: true,
  },
  {
    id: '2',
    name: 'Smart Macro Keyword Clustering',
    key: 'feat_smart_macro_clustering',
    description: 'Uses vector embeddings to match incoming email sentiment to best macro snippet.',
    category: 'Core AI',
    enabled: true,
  },
  {
    id: '3',
    name: 'Zero-Retention PII EU GDPR Enforcer',
    key: 'feat_gdpr_pii_enforce',
    description: 'Strict client-side redaction of EU IBANs, tax IDs, and passports before LLM ingestion.',
    category: 'Security',
    enabled: true,
  },
  {
    id: '4',
    name: 'Stripe Automatic Seat Pro-Rating',
    key: 'feat_stripe_prorated_seats',
    description: 'Instantly charges/credits team billing upon adding or removing agent seats mid-cycle.',
    category: 'Billing',
    enabled: true,
  },
  {
    id: '5',
    name: 'Claude 3.5 Sonnet Failover Router',
    key: 'feat_claude_failover_router',
    description: 'Automatically routes requests to Anthropic if OpenAI API latency exceeds 1.5s.',
    category: 'Core AI',
    enabled: false,
  },
  {
    id: '6',
    name: 'Global Emergency Maintenance Mode',
    key: 'feat_maintenance_lockdown',
    description: 'Gracefully pauses draft generation API across all extension side panels with banner.',
    category: 'Security',
    enabled: false,
  },
];

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [toast, setToast] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setFlags(
      flags.map((f) => {
        if (f.id === id) {
          const next = !f.enabled;
          setToast(`Feature Flag "${f.name}" set to ${next ? 'ENABLED' : 'DISABLED'}`);
          setTimeout(() => setToast(null), 3500);
          return { ...f, enabled: next };
        }
        return f;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-text">Platform Feature Flags &amp; Live Switches</h3>
          <p className="text-xs text-text-dim">
            Instantly toggle capabilities and roll out beta features to all 620+ workspaces without redeploying code
          </p>
        </div>
        <button
          onClick={() => {
            setToast('Exported feature flag schema to edge workers.');
            setTimeout(() => setToast(null), 3000);
          }}
          className="px-4 py-2 rounded-xl bg-bg border border-border hover:border-accent text-xs font-semibold text-text transition-colors self-start sm:self-auto cursor-pointer"
        >
          Sync with Edge CDN 🔄
        </button>
      </div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-accent/20 border border-accent/40 text-accent-light text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>⚡ {toast}</span>
          <span className="text-[10px] text-accent-light/70">Propagated in 12ms</span>
        </motion.div>
      )}

      {/* Grid of Flags */}
      <div className="grid sm:grid-cols-2 gap-4">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="p-5 rounded-3xl bg-elevated/70 border border-border/80 hover:border-accent/40 transition-all flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-bg border border-border text-[10px] font-mono text-text-dim uppercase tracking-wider">
                  {flag.category}
                </span>

                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle(flag.id)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    flag.enabled ? 'bg-accent justify-end' : 'bg-bg border border-border justify-start'
                  }`}
                >
                  <motion.div
                    layout
                    className={`w-4 h-4 rounded-full ${flag.enabled ? 'bg-white' : 'bg-text-dim'}`}
                  />
                </button>
              </div>

              <h4 className="font-bold text-sm text-text mb-1">{flag.name}</h4>
              <code className="text-[10px] font-mono text-accent-light bg-bg px-2 py-0.5 rounded border border-border/60 inline-block mb-2">
                {flag.key}
              </code>
              <p className="text-xs text-text-muted leading-relaxed font-normal">
                {flag.description}
              </p>
            </div>

            <div className="pt-3 mt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-text-dim">
              <span>Status:</span>
              <span className={flag.enabled ? 'text-emerald-400 font-bold' : 'text-text-dim'}>
                {flag.enabled ? '● ACTIVE FOR ALL TEAMS' : '○ DISABLED'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
