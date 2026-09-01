'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export interface GlobalMacro {
  id: string;
  name: string;
  category: string;
  tags: string[];
  content: string;
  adoptionCount: number;
}

const INITIAL_GLOBAL_MACROS: GlobalMacro[] = [
  {
    id: '1',
    name: 'Universal 30-Day Money Back Guarantee',
    category: 'Billing & Refunds',
    tags: ['refund', 'return', 'policy'],
    content: 'Hi {{name}},\n\nThank you for reaching out! You are fully covered by our 30-day money back guarantee. I have initiated your refund process.\n\nOnce processed, your funds will arrive in 3-5 business days on your original payment method.\n\nBest regards,\nSupport Team',
    adoptionCount: 1,
  },
  {
    id: '2',
    name: 'MFA & 2-Factor Authentication Unlock',
    category: 'Account & Security',
    tags: ['auth', 'security', 'login', '2fa'],
    content: 'Hi {{name}},\n\nI can certainly assist you with resetting your two-factor device. I have sent a secure temporary bypass link to your verified email.\n\nPlease follow the link within 15 minutes to confirm your identity.\n\nWarm regards,\nSecurity Support',
    adoptionCount: 1,
  },
  {
    id: '3',
    name: 'Carrier Delay & Package Tracking',
    category: 'Shipping & Logistics',
    tags: ['shipping', 'delay', 'tracking'],
    content: 'Hi {{name}},\n\nThanks for checking in on your order status! Your shipment is actively in transit with our carrier and tracking milestone updates indicate delivery within 2-3 business days.\n\nPlease let us know if you need any further assistance!\n\nBest,\nSupport Team',
    adoptionCount: 1,
  },
  {
    id: '4',
    name: 'Stripe Invoice & Official VAT Receipt',
    category: 'Billing & Invoices',
    tags: ['invoice', 'vat', 'tax', 'receipt'],
    content: 'Hi {{name}},\n\nHere is confirmation of your recent transaction. You can download an itemized PDF copy of all past invoices anytime directly from your billing portal.\n\nLet me know if you need any adjustments to your company billing details!\n\nCheers,\nBilling Team',
    adoptionCount: 1,
  },
];

export default function AdminGlobalMacros() {
  const [macros, setMacros] = useState<GlobalMacro[]>(INITIAL_GLOBAL_MACROS);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPushing, setIsPushing] = useState(false);
  const [pushingMacroId, setPushingMacroId] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMacro, setEditingMacro] = useState<GlobalMacro | null>(null);
  const [deletingMacro, setDeletingMacro] = useState<GlobalMacro | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Billing & Refunds');
  const [formTags, setFormTags] = useState('');
  const [formContent, setFormContent] = useState('');
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

  const fetchGlobalMacros = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/global-macros', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.macros && Array.isArray(data.macros)) {
          setMacros(data.macros);
        }
      }
    } catch (err) {
      console.warn('Could not load global macros from server:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchGlobalMacros();
  }, [fetchGlobalMacros]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormName('');
    setFormCategory('Billing & Refunds');
    setFormTags('');
    setFormContent('');
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (macro: GlobalMacro) => {
    setEditingMacro(macro);
    setFormName(macro.name);
    setFormCategory(macro.category);
    setFormTags(macro.tags.join(', '));
    setFormContent(macro.content);
  };

  // Submit Create or Edit
  const handleSubmitMacro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContent.trim()) return;

    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const parsedTags = formTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

      if (editingMacro) {
        // Edit existing
        const res = await fetch('/api/admin/global-macros', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            id: editingMacro.id,
            name: formName.trim(),
            category: formCategory,
            tags: parsedTags,
            content: formContent.trim(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.macros) setMacros(data.macros);
          setEditingMacro(null);
          setPushNotice(`✓ Global macro "${formName}" updated successfully.`);
          setTimeout(() => setPushNotice(null), 4000);
        } else {
          const errData = await res.json();
          alert(`Error updating macro: ${errData.error || 'Server error'}`);
        }
      } else {
        // Create new
        const res = await fetch('/api/admin/global-macros', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'create',
            name: formName.trim(),
            category: formCategory,
            tags: parsedTags,
            content: formContent.trim(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.macros) setMacros(data.macros);
          setShowCreateModal(false);
          setPushNotice(`✓ New global template "${formName}" created and ready for distribution.`);
          setTimeout(() => setPushNotice(null), 4000);
        } else {
          const errData = await res.json();
          alert(`Error creating macro: ${errData.error || 'Server error'}`);
        }
      }
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Macro
  const handleDeleteMacro = async () => {
    if (!deletingMacro) return;
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/global-macros?id=${deletingMacro.id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.macros) setMacros(data.macros);
        setPushNotice(`✓ Deleted global macro "${deletingMacro.name}".`);
        setTimeout(() => setPushNotice(null), 3500);
        setDeletingMacro(null);
      } else {
        const errData = await res.json();
        alert(`Delete failed: ${errData.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Broadcast all macros
  const handlePushAll = async () => {
    setIsPushing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/global-macros', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'broadcast',
          macros,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPushNotice(`✓ ${data.message || `Broadcasted ${macros.length} standard macros across all workspaces in Supabase!`}`);
        fetchGlobalMacros();
        setTimeout(() => setPushNotice(null), 5000);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Broadcast failed');
      }
    } catch (err: any) {
      alert(`Broadcasting note: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  // Broadcast single macro
  const handleBroadcastSingle = async (macro: GlobalMacro) => {
    setPushingMacroId(macro.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/global-macros', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'broadcast',
          macro,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPushNotice(`✓ Broadcasted "${macro.name}" to ${data.teamsCount || 'all'} workspaces (${data.insertedCount || 0} inserted, ${data.updatedCount || 0} updated)!`);
        fetchGlobalMacros();
        setTimeout(() => setPushNotice(null), 4500);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Broadcast failed');
      }
    } catch (err: any) {
      alert(`Broadcast failed: ${err.message}`);
    } finally {
      setPushingMacroId(null);
    }
  };

  const categories = ['All', 'Billing & Refunds', 'Billing & Invoices', 'Account & Security', 'Shipping & Logistics', 'General'];

  const filteredMacros = macros.filter((m) => {
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-text">Global Knowledge Base &amp; Macro Library</h3>
          <p className="text-xs text-text-dim">
            Standardized macro templates automatically seeded into customer workspaces and synced to Gmail
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(124,58,237,0.35)] cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Create Global Macro</span>
          </button>
          <button
            type="button"
            onClick={handlePushAll}
            disabled={isPushing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <span>📢</span>
            <span>{isPushing ? 'Broadcasting to Workspaces...' : 'Broadcast All to All Workspaces'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search global templates or tags..."
          className="px-3.5 py-1.5 rounded-xl bg-elevated/70 border border-border/80 text-xs text-text focus:outline-none focus:border-accent w-full sm:w-64"
        />
      </div>

      {/* Toast Notice */}
      <AnimatePresence>
        {pushNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
          >
            <span>{pushNotice}</span>
            <span className="text-[10px] text-emerald-300/70">Synced with Cloud DB via Service Role</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid of Global Macros */}
      {loading && macros.length === 0 ? (
        <div className="p-12 text-center text-text-dim text-xs">
          <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
          <p>Loading global macro library...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredMacros.map((macro) => (
            <div
              key={macro.id}
              className="p-5 rounded-3xl bg-elevated/70 border border-border/80 hover:border-accent/40 transition-all flex flex-col justify-between shadow-sm group"
            >
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-[10px] font-bold font-mono">
                    {macro.category}
                  </span>
                  <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(macro)}
                      className="px-2 py-1 rounded-lg bg-bg border border-border text-[10px] font-medium text-text-dim hover:text-text hover:border-accent transition-colors"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingMacro(macro)}
                      className="px-2 py-1 rounded-lg bg-bg border border-border text-[10px] font-medium text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 transition-colors"
                    >
                      🗑️ Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBroadcastSingle(macro)}
                      disabled={pushingMacroId === macro.id}
                      className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-[10px] font-bold text-white transition-all disabled:opacity-50"
                    >
                      {pushingMacroId === macro.id ? 'Pushing...' : '📢 Push'}
                    </button>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-text mb-2">{macro.name}</h4>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {macro.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-bg text-[10px] text-text-dim font-mono">
                      #{t}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-text-muted font-mono bg-bg/80 p-3 rounded-2xl border border-border/50 whitespace-pre-wrap leading-relaxed">
                  {macro.content}
                </p>
              </div>

              <div className="pt-3 mt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-text-dim">
                <span>Adoption: <strong className="text-emerald-400">{macro.adoptionCount || 1} workspace(s)</strong></span>
                <span className="text-accent-light font-semibold">Active in Gmail Co-Pilot</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingMacro) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-bg border border-border rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-text">
                  {editingMacro ? 'Edit Global Macro' : 'Create New Global Macro'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingMacro(null);
                  }}
                  className="text-text-dim hover:text-text text-sm p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitMacro} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1">Macro Title</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. VIP Concierge Expedited Resolution"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-dim mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                    >
                      <option value="Billing & Refunds">Billing & Refunds</option>
                      <option value="Billing & Invoices">Billing & Invoices</option>
                      <option value="Account & Security">Account & Security</option>
                      <option value="Shipping & Logistics">Shipping & Logistics</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-dim mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="refund, return, vip"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1">
                    Macro Template Content (supports &#123;&#123;name&#125;&#125;)
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Hi {{name}},\n\nThank you for reaching out..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border font-mono text-xs text-text focus:outline-none focus:border-accent resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingMacro(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-text-dim hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingMacro ? 'Save Changes' : 'Create Template'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingMacro && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-bg border border-border rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-text">Confirm Deletion</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Are you sure you want to remove the global macro template <strong className="text-text font-bold">"{deletingMacro.name}"</strong>?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingMacro(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-text-dim hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMacro}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Macro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
