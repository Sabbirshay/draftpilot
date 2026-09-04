'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scrubPII, CustomPiiRule } from '@/lib/pii-scrubber';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

const DEFAULT_SAMPLE_TEXT = `Hello Support,

My name is John Doe, and I need help with my account.
My internal customer ID is CUST-84920 and my email is john.doe@acmecorp.com.
You can reach me at +1 (555) 234-5678 or ship to 742 Evergreen Terrace Apt 4B.
We are currently beta testing Project Phoenix with our core stakeholders.
Our API key for testing is sk-proj-1234567890abcdef1234567890.

Thank you!`;

const PRESET_CUSTOM_RULES: CustomPiiRule[] = [
  {
    id: 'rule-cust-id',
    name: 'Internal Customer ID',
    pattern: 'CUST-\\d{5}',
    replacement: '[CUSTOMER_ID]',
    rule_type: 'regex',
    isRegex: true,
    enabled: true,
  },
  {
    id: 'rule-project-phoenix',
    name: 'Project Phoenix Codename',
    pattern: 'Project Phoenix',
    replacement: '[PROJECT_CODENAME]',
    rule_type: 'keyword',
    isRegex: false,
    enabled: true,
  },
  {
    id: 'rule-patient-mrn',
    name: 'Healthcare Patient MRN',
    pattern: 'MRN-\\d{6,8}',
    replacement: '[PATIENT_MRN]',
    rule_type: 'regex',
    isRegex: true,
    enabled: true,
  },
];

const PRESET_SAMPLES = [
  {
    label: 'Mixed PII & Codename',
    text: DEFAULT_SAMPLE_TEXT,
  },
  {
    label: 'Internal Customer ID',
    text: `Urgent: Customer account CUST-98241 submitted a chargeback request for transaction $350. Please review customer record CUST-98241 immediately.`,
  },
  {
    label: 'Project Codename',
    text: `Executive summary: The rollout of Project Phoenix has begun across European clusters. All Project Phoenix documentation must remain confidential.`,
  },
  {
    label: 'Healthcare & HIPAA',
    text: `Patient record MRN-482910 diagnosed with hypertension. Send follow-up prescription to 456 Broadway Ave Suite 100 for patient MRN-482910.`,
  },
];

export default function PiiPlayground() {
  const { dbUser } = useAuth();
  const [rules, setRules] = useState<CustomPiiRule[]>([]);
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // New Rule Form State
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'regex' | 'keyword'>('regex');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleReplacement, setNewRuleReplacement] = useState('[CUSTOM_REDACTED]');
  const [patternError, setPatternError] = useState<string | null>(null);

  // Load rules on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('draftpilot_custom_pii_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRules(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved PII rules:', e);
    }
    setRules(PRESET_CUSTOM_RULES);
  }, []);

  // Save rules to localStorage and Supabase (if available)
  const saveRules = async (updatedRules: CustomPiiRule[]) => {
    setRules(updatedRules);
    try {
      localStorage.setItem('draftpilot_custom_pii_rules', JSON.stringify(updatedRules));
      const teamId = dbUser?.team_id;
      if (teamId) {
        await supabase
          .from('teams')
          .update({ custom_pii_rules: updatedRules })
          .eq('id', teamId);
      }
    } catch (err) {
      console.warn('Failed to save custom PII rules:', err);
    }
  };

  // Live pattern validator
  useEffect(() => {
    if (!newRulePattern.trim()) {
      setPatternError(null);
      return;
    }
    if (newRuleType === 'regex') {
      try {
        new RegExp(newRulePattern);
        setPatternError(null);
      } catch (err: any) {
        setPatternError(err.message || 'Invalid Regular Expression');
      }
    } else {
      setPatternError(null);
    }
  }, [newRulePattern, newRuleType]);

  // Scrubbed output and metrics
  const { scrubbedText, latencyMs, customRedactionCount, builtinRedactionCount } = useMemo(() => {
    const start = performance.now();
    const result = scrubPII(sampleText, rules);
    const latency = Math.round((performance.now() - start) * 100) / 100;

    // Count custom matches
    let customCount = 0;
    rules.forEach((r) => {
      if (r.enabled && r.replacement) {
        const escaped = r.replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = (result.match(new RegExp(escaped, 'g')) || []).length;
        customCount += matches;
      }
    });

    // Count built-in matches
    const builtinTokens = [
      '\\[CARD_REDACTED\\]',
      '\\[EMAIL_REDACTED\\]',
      '\\[TOKEN_REDACTED\\]',
      '\\[SECRET_REDACTED\\]',
      '\\[SSN_REDACTED\\]',
      '\\[IP_REDACTED\\]',
      '\\[PHONE_REDACTED\\]',
      '\\[ADDRESS_REDACTED\\]',
    ];
    const builtinRegex = new RegExp(builtinTokens.join('|'), 'g');
    const builtinMatches = (result.match(builtinRegex) || []).length;

    return {
      scrubbedText: result,
      latencyMs: latency,
      customRedactionCount: customCount,
      builtinRedactionCount: builtinMatches,
    };
  }, [sampleText, rules]);

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    saveRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    saveRules(updated);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim() || patternError) return;

    const newRule: CustomPiiRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      pattern: newRulePattern.trim(),
      replacement: newRuleReplacement.trim() || '[CUSTOM_REDACTED]',
      rule_type: newRuleType,
      isRegex: newRuleType === 'regex',
      enabled: true,
      created_at: new Date().toISOString(),
    };

    const updated = [newRule, ...rules];
    saveRules(updated);

    // Reset modal form
    setNewRuleName('');
    setNewRulePattern('');
    setNewRuleReplacement('[CUSTOM_REDACTED]');
    setShowAddModal(false);
  };

  const handleCopyScrubbed = () => {
    navigator.clipboard.writeText(scrubbedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render tokens with color-coded badges
  const renderHighlightedOutput = () => {
    // Split tokens by bracketed tags
    const parts = scrubbedText.split(/(\[[A-Z0-9_-]+\])/g);

    return parts.map((part, index) => {
      const isCustom = rules.some((r) => r.replacement === part);
      const isBuiltin = [
        '[CARD_REDACTED]',
        '[EMAIL_REDACTED]',
        '[TOKEN_REDACTED]',
        '[SECRET_REDACTED]',
        '[SSN_REDACTED]',
        '[IP_REDACTED]',
        '[PHONE_REDACTED]',
        '[ADDRESS_REDACTED]',
      ].includes(part);

      if (isCustom) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono text-[11px] font-bold mx-0.5 shadow-sm"
          >
            🛡️ {part}
          </span>
        );
      }

      if (isBuiltin) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-cyan/20 text-cyan border border-cyan/40 font-mono text-[11px] font-bold mx-0.5 shadow-sm"
          >
            🔒 {part}
          </span>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-accent/15 via-elevated to-bg border border-accent/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-xs font-bold mb-3">
            <span>🛡️</span>
            <span>Zero-Knowledge Privacy Vault</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
            Custom PII Scrubbing Rules &amp; Live Tester
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Configure custom regular expressions or sensitive keywords to redact proprietary codenames, internal customer IDs, or HIPAA data before dispatch to AI models.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>+</span>
          <span>Add Custom Rule</span>
        </button>
      </div>

      {/* Rules Management Section */}
      <div className="rounded-3xl border border-border bg-bg-card/90 p-6 sm:p-8 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-bold text-text">Active Scrubbing Rules ({rules.length})</h3>
          </div>
          <span className="text-xs text-text-dim">
            Executed client-side in browser &amp; server-side before storage
          </span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                rule.enabled
                  ? 'border-border bg-elevated/60 hover:border-border-hover'
                  : 'border-border/40 bg-bg/40 opacity-60'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-text">{rule.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      rule.rule_type === 'keyword'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {rule.rule_type || (rule.isRegex ? 'REGEX' : 'KEYWORD')}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-text-dim">
                    <span className="text-[10px] uppercase font-mono">Pattern:</span>
                    <code className="bg-bg px-1.5 py-0.5 rounded text-accent-light font-mono text-[11px] truncate">
                      {rule.pattern}
                    </code>
                  </div>
                  <div className="flex items-center gap-1.5 text-text-dim">
                    <span className="text-[10px] uppercase font-mono">Replaces:</span>
                    <code className="bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      {rule.replacement || '[CUSTOM_REDACTED]'}
                    </code>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => handleToggleRule(rule.id)}
                  className={`text-xs font-semibold cursor-pointer transition-colors ${
                    rule.enabled ? 'text-emerald-400' : 'text-text-dim'
                  }`}
                >
                  {rule.enabled ? '● Active' : '○ Disabled'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-xs text-red-400/80 hover:text-red-400 cursor-pointer transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-text-dim">
              No custom rules yet. Click &quot;Add Custom Rule&quot; to configure your first pattern.
            </div>
          )}
        </div>
      </div>

      {/* Interactive Live Playground */}
      <div className="rounded-3xl border border-border bg-bg-card/90 p-6 sm:p-8 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🧪</span>
              <h3 className="text-base font-bold text-text">Interactive Live PII Playground</h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Type or paste sample support tickets below. Redaction runs in real time with ReDoS protection.
            </p>
          </div>

          {/* Preset Sample Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-dim">Presets:</span>
            {PRESET_SAMPLES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setSampleText(preset.text)}
                className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-white/5 border border-border text-[11px] text-text font-medium cursor-pointer transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two-Pane Editor & Diff Preview */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Pane: Input Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-dim">
              <span className="font-semibold text-text">Raw Support Thread (Input)</span>
              <span>{sampleText.length} characters</span>
            </div>
            <textarea
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              rows={12}
              className="w-full rounded-2xl bg-bg/90 border border-border p-4 text-xs font-mono text-text focus:outline-none focus:border-accent resize-y leading-relaxed shadow-inner"
              placeholder="Paste raw support email with customer PII here..."
            />
          </div>

          {/* Right Pane: Live Redacted Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-dim">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text">Scrubbed Diff Preview</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  {latencyMs}ms
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyScrubbed}
                className="text-accent-light hover:underline cursor-pointer"
              >
                {copied ? '✓ Copied!' : 'Copy Redacted Text'}
              </button>
            </div>
            <div className="w-full h-[280px] rounded-2xl bg-bg/90 border border-border p-4 text-xs text-text overflow-y-auto leading-relaxed whitespace-pre-wrap shadow-inner">
              {renderHighlightedOutput()}
            </div>
          </div>
        </div>

        {/* Live Redaction Telemetry Meter */}
        <div className="p-4 rounded-2xl bg-elevated/40 border border-border flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500/60" />
              <span className="text-text-muted">
                Custom Redactions:{' '}
                <strong className="text-purple-300 font-mono">{customRedactionCount}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan/60" />
              <span className="text-text-muted">
                Standard Built-in Redactions:{' '}
                <strong className="text-cyan font-mono">{builtinRedactionCount}</strong>
              </span>
            </div>
          </div>

          <div className="text-[11px] text-text-dim">
            Total Sensitive Items Redacted:{' '}
            <strong className="text-text font-mono font-bold">
              {customRedactionCount + builtinRedactionCount}
            </strong>
          </div>
        </div>
      </div>

      {/* Add Custom Rule Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-5 relative"
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute right-5 top-5 text-text-dim hover:text-text text-sm p-1 rounded-full bg-elevated border border-border cursor-pointer"
              >
                ✕
              </button>

              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold mb-2">
                  <span>➕</span>
                  <span>New PII Rule</span>
                </div>
                <h3 className="text-xl font-bold text-text">Create Redaction Rule</h3>
                <p className="text-xs text-text-muted mt-1">
                  Define a keyword or regex pattern to scrub before AI synthesis.
                </p>
              </div>

              <form onSubmit={handleAddRule} className="space-y-4 text-xs">
                <div>
                  <label className="block text-text font-semibold mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="e.g. Employee Badge ID"
                    className="w-full rounded-xl bg-bg border border-border px-3.5 py-2 text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-text font-semibold mb-1">Rule Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewRuleType('regex')}
                      className={`py-2 px-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        newRuleType === 'regex'
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                          : 'border-border bg-bg text-text-dim hover:text-text'
                      }`}
                    >
                      Regular Expression
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRuleType('keyword')}
                      className={`py-2 px-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        newRuleType === 'keyword'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                          : 'border-border bg-bg text-text-dim hover:text-text'
                      }`}
                    >
                      Exact Keyword
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-text font-semibold">
                      {newRuleType === 'regex' ? 'Regex Pattern' : 'Keyword String'}
                    </label>
                    {newRuleType === 'regex' && (
                      <span
                        className={`text-[10px] font-bold ${
                          patternError
                            ? 'text-red-400'
                            : newRulePattern.trim()
                            ? 'text-emerald-400'
                            : 'text-text-dim'
                        }`}
                      >
                        {patternError
                          ? '✗ Invalid Regex'
                          : newRulePattern.trim()
                          ? '✓ Valid Regex'
                          : ''}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    placeholder={
                      newRuleType === 'regex' ? 'e.g. EMP-\\d{6}' : 'e.g. Project Apollo'
                    }
                    className={`w-full rounded-xl bg-bg border px-3.5 py-2 text-text font-mono focus:outline-none ${
                      patternError
                        ? 'border-red-500/70 focus:border-red-500'
                        : 'border-border focus:border-accent'
                    }`}
                  />
                  {patternError && (
                    <p className="text-[11px] text-red-400 mt-1">{patternError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-text font-semibold mb-1">
                    Redaction Replacement Tag
                  </label>
                  <input
                    type="text"
                    required
                    value={newRuleReplacement}
                    onChange={(e) => setNewRuleReplacement(e.target.value)}
                    placeholder="[CUSTOM_REDACTED]"
                    className="w-full rounded-xl bg-bg border border-border px-3.5 py-2 text-text font-mono focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-bg border border-border text-text-dim hover:text-text cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(patternError) || !newRulePattern.trim()}
                    className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all cursor-pointer disabled:opacity-50"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
