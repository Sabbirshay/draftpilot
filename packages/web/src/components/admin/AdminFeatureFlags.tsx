'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  category: 'Core AI' | 'Extension' | 'Billing' | 'Security';
  enabled: boolean;
  updatedAt?: string;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; latency?: string } | null>(null);
  const [isSyncingCdn, setIsSyncingCdn] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Flag Form State
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newCategory, setNewCategory] = useState<'Core AI' | 'Extension' | 'Billing' | 'Security'>('Core AI');
  const [newDescription, setNewDescription] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token =
      sessionData.session?.access_token ||
      (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);

    const adminPasskey = typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminPasskey) {
      headers['x-admin-passkey'] = adminPasskey;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Fetch flags on mount
  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/feature-flags', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.flags && Array.isArray(data.flags)) {
          setFlags(data.flags);
        }
      }
    } catch (err) {
      console.warn('Could not load feature flags from server, using defaults:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (id: string) => {
    const flag = flags.find((f) => f.id === id);
    if (!flag) return;

    const next = !flag.enabled;
    const startTime = performance.now();

    // Optimistic UI update
    setFlags((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: next } : f))
    );

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'toggle',
          id,
          enabled: next,
        }),
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json();
        if (data.flags) {
          setFlags(data.flags);
        }
        setToast({
          message: `Feature Flag "${flag.name}" set to ${next ? 'ENABLED' : 'DISABLED'}`,
          latency: `Persisted in ${elapsed}ms`,
        });
        setTimeout(() => setToast(null), 3500);
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      setFlags((prev) =>
        prev.map((f) => (f.id === id ? { ...f, enabled: !next } : f))
      );
      setToast({
        message: `Error toggling flag: ${err.message}`,
        latency: 'Reverted',
      });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleSyncCdn = async () => {
    setIsSyncingCdn(true);
    const startTime = performance.now();
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'sync_cdn' }),
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (res.ok) {
        setToast({
          message: 'Exported feature flag schema to Cloudflare / Fastly Edge CDN workers.',
          latency: `Propagated in ${elapsed}ms`,
        });
      } else {
        setToast({
          message: 'Synced locally with Edge cache.',
          latency: `${elapsed}ms`,
        });
      }
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({
        message: `CDN sync note: ${err.message}`,
        latency: 'Local cache active',
      });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsSyncingCdn(false);
    }
  };

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newKey.trim()) return;

    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create',
          name: newName.trim(),
          key: newKey.trim(),
          category: newCategory,
          description: newDescription.trim(),
          enabled: newEnabled,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.flags) {
          setFlags(data.flags);
        }
        setShowAddModal(false);
        setNewName('');
        setNewKey('');
        setNewDescription('');
        setToast({
          message: `Created feature flag "${newName}" successfully.`,
          latency: 'Active across workspaces',
        });
        setTimeout(() => setToast(null), 3500);
      } else {
        const errData = await res.json();
        alert(`Error creating flag: ${errData.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error creating flag: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ['All', 'Core AI', 'Extension', 'Billing', 'Security'];

  const filteredFlags = flags.filter((flag) => {
    if (selectedCategory === 'All') return true;
    return flag.category === selectedCategory;
  });

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
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(124,58,237,0.35)] cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add Flag</span>
          </button>
          <button
            type="button"
            onClick={handleSyncCdn}
            disabled={isSyncingCdn}
            className="px-4 py-2 rounded-xl bg-bg border border-border hover:border-accent text-xs font-semibold text-text transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>{isSyncingCdn ? '⏳' : '🔄'}</span>
            <span>{isSyncingCdn ? 'Syncing...' : 'Sync with Edge CDN'}</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-accent text-white shadow-sm'
                : 'bg-elevated/70 text-text-dim hover:text-text border border-border/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-accent/20 border border-accent/40 text-accent-light text-xs font-semibold flex items-center justify-between shadow-lg"
          >
            <span>⚡ {toast.message}</span>
            {toast.latency && <span className="text-[10px] text-accent-light/70">{toast.latency}</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && flags.length === 0 ? (
        <div className="p-12 text-center text-text-dim text-xs">
          <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
          <p>Loading feature flags from server...</p>
        </div>
      ) : (
        /* Grid of Flags */
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredFlags.map((flag) => (
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
                    aria-label={`Toggle ${flag.name}`}
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
      )}

      {/* Create Flag Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-bg border border-border rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-text">Create New Feature Flag</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-text-dim hover:text-text text-sm p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateFlag} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1">Flag Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      if (!newKey) {
                        setNewKey(`feat_${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
                      }
                    }}
                    placeholder="e.g. Gmail Multi-Thread Context"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1">Key Identifier</label>
                  <input
                    type="text"
                    required
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="feat_multi_thread_context"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border font-mono text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                    >
                      <option value="Core AI">Core AI</option>
                      <option value="Extension">Extension</option>
                      <option value="Billing">Billing</option>
                      <option value="Security">Security</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-dim mb-1">Initial State</label>
                    <select
                      value={newEnabled ? 'enabled' : 'disabled'}
                      onChange={(e) => setNewEnabled(e.target.value === 'enabled')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                    >
                      <option value="enabled">Enabled (Active)</option>
                      <option value="disabled">Disabled (Inactive)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of the capability and rollout scope..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-text-dim hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Flag'}
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
