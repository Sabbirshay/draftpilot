'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentUploader from './DocumentUploader';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export interface MacroItem {
  id: string;
  name: string;
  category: string;
  tags: string[];
  content: string;
  usageCount: number;
  lastUpdated: string;
}

const STARTER_MACROS = [
  {
    name: 'Standard Return & Exchange Policy',
    category: 'Billing & Refunds',
    tags: ['refund', 'return', 'exchange', 'policy'],
    content: `Hi there,\n\nThanks for reaching out! We accept returns within 30 days of delivery in original, unused condition.\n\nTo initiate your return or exchange, please confirm your order number and the item you'd like to return. We'll generate a prepaid return shipping label right away.\n\nLet me know if you have any questions!\n\nBest,\nSupport Team`,
  },
  {
    name: 'Shipping Delay Update',
    category: 'Shipping & Delivery',
    tags: ['shipping', 'delay', 'tracking', 'order'],
    content: `Hi there,\n\nThank you for checking in on your order! We apologize for the slight delay. Our fulfillment center experienced higher volume than usual this week.\n\nYour package is currently in transit with the carrier and is expected to arrive within 2-3 business days. You can track live updates using your original tracking link.\n\nThank you for your patience,\nSupport Team`,
  },
  {
    name: 'Password Reset & Account Access',
    category: 'Account & Auth',
    tags: ['password', 'login', 'account', 'auth'],
    content: `Hi there,\n\nI can help you regain access to your account! I've just sent a secure password reset link to your registered email address.\n\nPlease follow the link in that email to choose a new password. The link will remain valid for 1 hour.\n\nIf you don't see it within 5 minutes, please check your spam/junk folder.\n\nBest regards,\nSupport Team`,
  },
  {
    name: 'Customer Feedback & Appreciation',
    category: 'General',
    tags: ['feedback', 'thank-you', 'customer-love'],
    content: `Hi there,\n\nThank you so much for taking the time to share your feedback with us! We truly appreciate our customers taking the time to help us improve.\n\nI've shared your note directly with our product team for our upcoming sprint review.\n\nHave a wonderful rest of your day!\nSupport Team`,
  },
  {
    name: 'Feature Request Received',
    category: 'Product & Setup',
    tags: ['feature-request', 'product', 'roadmap'],
    content: `Hi there,\n\nThanks for suggesting this feature! That's a great idea, and we're always looking for ways to make our product more helpful for our users.\n\nI've logged your request in our feature backlog and linked it to your account so you'll be notified automatically if and when it gets released.\n\nBest,\nProduct Team`,
  },
];

type MacrosTab = 'documents' | 'macros';

export default function MacrosManager() {
  const { dbUser, user } = useAuth();
  const [activeTab, setActiveTab] = useState<MacrosTab>('macros');
  const [macros, setMacros] = useState<MacroItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [isImportingStarters, setIsImportingStarters] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // New Custom Macro Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Billing & Refunds');
  const [newTags, setNewTags] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const getTeamId = useCallback(async (): Promise<string | null> => {
    if (dbUser?.team_id) return dbUser.team_id;

    const targetUserId = user?.id;
    if (targetUserId) {
      const { data } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', targetUserId)
        .maybeSingle();
      if (data?.team_id) return data.team_id;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authUser) {
        const { data: userRow } = await supabase
          .from('users')
          .select('team_id')
          .eq('id', authUser.id)
          .maybeSingle();

        if (userRow?.team_id) return userRow.team_id;

        const teamName = `${authUser.email?.split('@')[0] || 'My'}'s Team`;
        const { data: newTeam } = await supabase
          .from('teams')
          .insert({ name: teamName })
          .select()
          .single();

        if (newTeam) {
          await supabase.from('users').upsert({
            id: authUser.id,
            team_id: newTeam.id,
            email: authUser.email || '',
            full_name: authUser.email?.split('@')[0] || 'Member',
            role: 'owner',
          });
          return newTeam.id;
        }
      }
    } catch {
      // Ignore
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('draftpilot_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.team_id) return parsed.team_id;
        } catch {
          // Ignore
        }
      }
    }
    return null;
  }, [dbUser, user]);

  const fetchMacros = useCallback(async () => {
    const activeTeamId = await getTeamId();
    if (!activeTeamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('macros')
        .select('*')
        .eq('team_id', activeTeamId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMacros(
          data.map((m: any) => ({
            id: m.id,
            name: m.name,
            category: m.category || 'General',
            tags: Array.isArray(m.tags) ? m.tags : [],
            content: m.content,
            usageCount: m.usage_count || 0,
            lastUpdated: m.updated_at ? new Date(m.updated_at).toLocaleDateString() : 'Recently',
          }))
        );
      }
    } catch (err) {
      console.warn('Could not fetch macros from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [getTeamId]);

  // Initial fetch and Realtime subscription for cross-party sync (admin broadcasts & extension creations)
  useEffect(() => {
    let isMounted = true;
    let activeChannel: any = null;

    async function initAndSubscribe() {
      await fetchMacros();
      const activeTeamId = await getTeamId();
      if (!activeTeamId || !isMounted) return;

      activeChannel = supabase
        .channel(`team-macros-realtime-${activeTeamId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'macros',
            filter: `team_id=eq.${activeTeamId}`,
          },
          (payload) => {
            if (!isMounted) return;
            if (payload.eventType === 'INSERT') {
              const d = payload.new as any;
              const newMacro: MacroItem = {
                id: d.id,
                name: d.name,
                category: d.category || 'General',
                tags: Array.isArray(d.tags) ? d.tags : [],
                content: d.content,
                usageCount: d.usage_count || 0,
                lastUpdated: 'Just now',
              };
              setMacros((prev) => {
                if (prev.some((m) => m.id === newMacro.id)) return prev;
                return [newMacro, ...prev];
              });
              setSyncNotice(`⚡ Live macro update: "${newMacro.name}" synced to your knowledge base!`);
              setTimeout(() => setSyncNotice(null), 4000);
            } else if (payload.eventType === 'UPDATE') {
              const d = payload.new as any;
              setMacros((prev) =>
                prev.map((m) =>
                  m.id === d.id
                    ? {
                        ...m,
                        name: d.name,
                        category: d.category || 'General',
                        tags: Array.isArray(d.tags) ? d.tags : [],
                        content: d.content,
                        usageCount: d.usage_count !== undefined ? d.usage_count : m.usageCount,
                        lastUpdated: 'Just now',
                      }
                    : m
                )
              );
            } else if (payload.eventType === 'DELETE') {
              const d = payload.old as any;
              if (d?.id) {
                setMacros((prev) => prev.filter((m) => m.id !== d.id));
              }
            }
          }
        )
        .subscribe();
    }

    initAndSubscribe();

    return () => {
      isMounted = false;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [fetchMacros, getTeamId]);

  const categories = [
    'All',
    'Billing & Refunds',
    'Account & Auth',
    'Shipping & Delivery',
    'Product & Setup',
    'General',
  ];

  const filteredMacros = macros.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateMacro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newContent.trim()) return;

    const activeTeamId = await getTeamId();
    if (!activeTeamId) {
      alert('Please wait a moment while your team workspace connects...');
      return;
    }

    setIsSaving(true);
    const parsedTags = newTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

    try {
      const { data, error } = await supabase
        .from('macros')
        .insert({
          team_id: activeTeamId,
          name: newName.trim(),
          category: newCategory,
          tags: parsedTags,
          content: newContent.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const created: MacroItem = {
          id: data.id,
          name: data.name,
          category: data.category || newCategory,
          tags: data.tags || parsedTags,
          content: data.content,
          usageCount: 0,
          lastUpdated: 'Just now',
        };
        setMacros((prev) => [created, ...prev]);
        setNewName('');
        setNewTags('');
        setNewContent('');
        setIsCreatingCustom(false);
        setSyncNotice(`✓ Macro "${created.name}" created and synced to team knowledge base!`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to create macro in Supabase:', err);
      alert(`Could not create macro: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportStarters = async () => {
    const activeTeamId = await getTeamId();
    if (!activeTeamId) {
      alert('Please wait a moment while your workspace connects...');
      return;
    }
    setIsImportingStarters(true);

    try {
      const inserts = STARTER_MACROS.map((sm) => ({
        team_id: activeTeamId,
        name: sm.name,
        category: sm.category,
        tags: sm.tags,
        content: sm.content,
      }));

      const { data, error } = await supabase
        .from('macros')
        .insert(inserts)
        .select();

      if (error) throw error;

      if (data) {
        const formatted: MacroItem[] = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          tags: d.tags || [],
          content: d.content,
          usageCount: 0,
          lastUpdated: 'Just now',
        }));
        setMacros((prev) => [...formatted, ...prev]);
        setSyncNotice(`⚡ 5 Starter support macros imported successfully!`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to import starter macros:', err);
      alert(`Could not import starter macros: ${err.message || 'Unknown error'}`);
    } finally {
      setIsImportingStarters(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previousMacros = [...macros];
    const targetMacro = macros.find((m) => m.id === id);
    setMacros((prev) => prev.filter((m) => m.id !== id));
    setErrorNotice(null);

    try {
      const { error } = await supabase.from('macros').delete().eq('id', id);
      if (error) throw error;
      setSyncNotice(`✓ Macro "${targetMacro?.name || 'Item'}" deleted.`);
      setTimeout(() => setSyncNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete macro in Supabase:', err);
      // Rollback optimistic update
      setMacros(previousMacros);
      setErrorNotice(`Failed to delete macro "${targetMacro?.name || ''}": ${err.message || 'Database error'}. Restored to list.`);
      setTimeout(() => setErrorNotice(null), 5000);
    }
  };

  const handleSyncAllToGmail = () => {
    setSyncNotice(`All ${macros.length} Knowledge Base Macros synced to Gmail Extension side panel!`);
    setTimeout(() => setSyncNotice(null), 4500);
  };

  return (
    <div className="space-y-6">
      
      {/* ─────────────────────────────────────────────────────────────
          1. SUB-NAVIGATION TABS: Ingestion vs Macros
      ───────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-bg/80 rounded-2xl border border-border/60">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span>📁</span>
            <span>Upload Knowledge Base (PDF/Word/Excel/MD)</span>
          </button>
          <button
            onClick={() => setActiveTab('macros')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'macros'
                ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span>📝</span>
            <span>Support Macros Library ({macros.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAllToGmail}
            disabled={macros.length === 0}
            className="px-4 py-2 rounded-xl bg-bg hover:bg-elevated border border-border text-text text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span>⚡</span>
            <span>Sync with Gmail</span>
          </button>
          <button
            onClick={() => setIsCreatingCustom(true)}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span>
            <span>Create Macro</span>
          </button>
        </div>
      </div>

      {/* Sync & Error Banner Notifications */}
      <AnimatePresence>
        {syncNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{syncNotice}</span>
            </div>
            <button
              onClick={() => setSyncNotice(null)}
              className="text-emerald-400/70 hover:text-emerald-300 text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
        {errorNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span>⚠️ {errorNotice}</span>
            </div>
            <button
              onClick={() => setErrorNotice(null)}
              className="text-red-400/70 hover:text-red-300 text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          2. DOCUMENT UPLOADER TAB
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'documents' && (
        <DocumentUploader onExtractionComplete={() => { setActiveTab('macros'); fetchMacros(); }} />
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MACROS LIBRARY TAB
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'macros' && (
        <div className="space-y-6">

          {/* Filtering & Search Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-elevated/70 text-text-muted hover:text-text border border-border/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search macros by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 rounded-xl bg-elevated/80 border border-border focus:border-accent text-xs text-text placeholder-text-dim outline-none transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">🔍</span>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="text-center py-12 text-text-muted text-xs">
              <span className="inline-block animate-spin mr-2">⚡</span> Loading your knowledge base...
            </div>
          )}

          {/* Clean Zero-State / Empty Macros Prompt */}
          {!loading && macros.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4 bg-bg-card/40 max-w-xl mx-auto my-6">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-xl">
                📝
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text">No macros in your knowledge base yet</h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  Macros ground your AI co-pilot in Gmail with your team&apos;s verified answers, policies, and tone.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleImportStarters}
                  disabled={isImportingStarters}
                  className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer flex items-center gap-2"
                >
                  <span>⚡</span>
                  <span>{isImportingStarters ? 'Importing...' : 'Import 5 Starter Templates'}</span>
                </button>
                <button
                  onClick={() => setIsCreatingCustom(true)}
                  className="px-4 py-2.5 rounded-xl bg-bg hover:bg-elevated border border-border text-xs font-semibold text-text transition-colors cursor-pointer"
                >
                  + Create Custom Macro
                </button>
              </div>
            </div>
          )}

          {/* Macros Grid */}
          {!loading && macros.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMacros.map((macro) => (
                <div
                  key={macro.id}
                  className="rounded-3xl bg-elevated/70 border border-border/80 p-5 flex flex-col justify-between hover:border-accent/40 transition-all shadow-md group relative overflow-hidden"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-text leading-snug group-hover:text-accent-light transition-colors">
                        {macro.name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg border border-border/80 text-text-dim shrink-0 font-mono">
                        {macro.category}
                      </span>
                    </div>

                    <p className="text-xs text-text-muted leading-relaxed line-clamp-4 font-mono bg-bg/50 p-2.5 rounded-xl border border-border/50 my-3">
                      {macro.content}
                    </p>

                    {macro.tags && macro.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {macro.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-2 py-0.5 rounded-md bg-elevated border border-border text-text-dim"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-text-dim mt-2">
                    <span>{macro.lastUpdated}</span>
                    <button
                      onClick={() => handleDelete(macro.id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. CREATE CUSTOM MACRO MODAL
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCreatingCustom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-5 relative"
            >
              <button
                onClick={() => setIsCreatingCustom(false)}
                className="absolute right-5 top-5 text-text-dim hover:text-text text-sm p-1 rounded-full bg-elevated border border-border cursor-pointer"
              >
                ✕
              </button>

              <div>
                <h3 className="text-lg font-bold text-text">Create Support Macro</h3>
                <p className="text-xs text-text-muted">
                  Add a standardized answer to ground your team&apos;s AI draft suggestions in Gmail.
                </p>
              </div>

              <form onSubmit={handleCreateMacro} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">Macro Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30-Day Return & Exchange Policy"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-bg border border-border focus:border-accent text-xs text-text outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-border focus:border-accent text-xs text-text outline-none"
                    >
                      {categories.filter((c) => c !== 'All').map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      placeholder="refund, return, order"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-bg border border-border focus:border-accent text-xs text-text outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">Approved Macro Content / Reply Template</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Hi [Customer],\n\nThank you for reaching out! Here is our standard policy..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full p-3 rounded-xl bg-bg border border-border focus:border-accent text-xs text-text outline-none font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCustom(false)}
                    className="px-4 py-2 rounded-xl bg-bg border border-border text-xs text-text-dim hover:text-text cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save & Sync Macro'}
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
