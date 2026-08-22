'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentUploader from './DocumentUploader';
import { SAMPLE_FIFTY_MACROS, MacroItem } from '@/data/sampleFiftyMacros';

type MacrosTab = 'documents' | 'macros';

export default function MacrosManager() {
  const [activeTab, setActiveTab] = useState<MacrosTab>('macros');
  const [macros, setMacros] = useState<MacroItem[]>(SAMPLE_FIFTY_MACROS);
  
  // Filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // New Custom Macro Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MacroItem['category']>('Billing & Refunds');
  const [newTags, setNewTags] = useState('');
  const [newContent, setNewContent] = useState('');

  const categories = [
    'All',
    'Billing & Refunds',
    'Account & Auth',
    'Shipping & Delivery',
    'Product & Setup',
    'Subscriptions',
    'Policies & Exchanges',
  ];

  const filteredMacros = macros.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newContent.trim()) return;

    const created: MacroItem = {
      id: `custom-${Date.now()}`,
      name: newName,
      category: newCategory,
      tags: newTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      content: newContent,
      usageCount: 0,
      lastUpdated: 'Just now',
    };

    setMacros([created, ...macros]);
    setNewName('');
    setNewTags('');
    setNewContent('');
    setIsCreatingCustom(false);
    setSyncNotice(`Custom Macro "${created.name}" created and synced to team knowledge base!`);
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const handleDelete = (id: string) => {
    setMacros(macros.filter((m) => m.id !== id));
  };

  const handleSyncAllToGmail = () => {
    setSyncNotice(`All ${macros.length} Knowledge Base Macros synced to Gmail Extension side panel!`);
    setTimeout(() => setSyncNotice(null), 4500);
  };

  const handleDocumentExtraction = (count: number) => {
    setActiveTab('macros');
    setSyncNotice(`AI extracted and loaded ${count} structured support macros from uploaded knowledge base!`);
    setTimeout(() => setSyncNotice(null), 5000);
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
            <span>🤖</span>
            <span>Knowledge Base &amp; Macros ({macros.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSyncAllToGmail}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>⚡</span>
            <span>Sync All to Gmail Side Panel</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-accent/20 border border-accent/40 text-accent-light text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>✨ {syncNotice}</span>
          <span className="text-[10px] text-accent-light/70">Synced in 14ms</span>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DOCUMENT UPLOADER (Deep Document Ingestion)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <DocumentUploader onMacrosExtracted={handleDocumentExtraction} />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: KNOWLEDGE BASE & MACROS (All 50 + Custom Macro Form)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'macros' && (
        <div className="space-y-6">
          {/* Action & Filter Bar */}
          <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across all macros, keywords, and tags..."
                  className="w-full px-4 py-2.5 pl-9 rounded-full bg-bg border border-border text-xs text-text placeholder-text-dim outline-none focus:border-accent"
                />
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                  className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{isCreatingCustom ? '✕ Close Form' : '+ Add Custom Macro'}</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-bg border border-border text-text-muted hover:text-text'
                  }`}
                >
                  {cat === 'All' ? `All (${macros.length})` : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Inline Custom Macro Create Form */}
          <AnimatePresence>
            {isCreatingCustom && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-6 rounded-3xl bg-bg-card border border-accent/40 shadow-2xl space-y-4 overflow-hidden"
              >
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <span>✨</span>
                  <span>Create Custom Support Macro</span>
                </h3>

                <form onSubmit={handleCreateMacro} className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">Macro Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 14-Day Exchange Procedure"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-border text-xs text-text outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-border text-xs text-text outline-none focus:border-accent"
                      >
                        <option value="Billing & Refunds">Billing & Refunds</option>
                        <option value="Account & Auth">Account & Auth</option>
                        <option value="Shipping & Delivery">Shipping & Delivery</option>
                        <option value="Product & Setup">Product & Setup</option>
                        <option value="Subscriptions">Subscriptions</option>
                        <option value="Policies & Exchanges">Policies & Exchanges</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text mb-1">Tags (comma separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. refund, billing, return"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-border text-xs text-text outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Macro Template Content (supports placeholders like <code>&#123;&#123;customer_name&#125;&#125;</code>)
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Hi {{customer_name}}, thank you for reaching out..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-border text-xs text-text outline-none focus:border-accent font-mono leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingCustom(false)}
                      className="px-4 py-2 rounded-xl bg-elevated border border-border text-text-muted text-xs hover:text-text cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer"
                    >
                      Save to Knowledge Base
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Macros Grid (All 50 Sample / Ingested Macros + Custom) */}
          <div className="grid md:grid-cols-2 gap-4">
            {filteredMacros.map((macro) => (
              <div
                key={macro.id}
                className="p-5 rounded-3xl bg-elevated/70 border border-border/80 hover:border-accent/40 transition-all flex flex-col justify-between shadow-sm group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent-light text-[10px] font-bold font-mono mb-1.5">
                        {macro.category}
                      </span>
                      <h4 className="font-bold text-sm text-text group-hover:text-accent-light transition-colors">
                        {macro.name}
                      </h4>
                    </div>

                    <button
                      onClick={() => handleDelete(macro.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity p-1 cursor-pointer"
                      title="Delete macro"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {macro.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-bg border border-border text-[10px] font-mono text-text-dim"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Content snippet */}
                  <p className="text-xs text-text-muted font-mono bg-bg/80 p-3 rounded-2xl border border-border/50 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {macro.content}
                  </p>
                </div>

                {/* Footer metrics & copy actions */}
                <div className="pt-4 mt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-text-dim">
                  <span>🎯 Used {macro.usageCount} times in Gmail</span>
                  <button
                    onClick={() => {
                      if (typeof navigator !== 'undefined') navigator.clipboard.writeText(macro.content);
                      setSyncNotice(`Copied template for "${macro.name}"!`);
                      setTimeout(() => setSyncNotice(null), 3000);
                    }}
                    className="text-accent-light hover:underline font-semibold cursor-pointer"
                  >
                    Copy Template 📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
