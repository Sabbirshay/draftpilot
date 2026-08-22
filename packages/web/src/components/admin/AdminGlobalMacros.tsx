'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalMacro {
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
    category: 'E-Commerce & Billing',
    tags: ['refund', 'return', 'policy'],
    content: 'Hi {{customer_name}},\n\nThank you for reaching out! You are covered by our 30-day money back guarantee. I have initiated your return label.\n\nOnce processed, your funds will arrive in 3-5 business days.\n\nBest regards,\n{{agent_name}}',
    adoptionCount: 540,
  },
  {
    id: '2',
    name: 'MFA & 2-Factor Authentication Unlock',
    category: 'SaaS & Security',
    tags: ['auth', 'security', 'login'],
    content: 'Hi {{customer_name}},\n\nI can assist you with resetting your two-factor device. I have sent a secure temporary bypass link to your verified email.\n\nPlease follow the link within 15 minutes.\n\nWarm regards,\n{{agent_name}}',
    adoptionCount: 480,
  },
  {
    id: '3',
    name: 'Carrier Delay & Package Tracking',
    category: 'Logistics',
    tags: ['shipping', 'delay', 'tracking'],
    content: 'Hi {{customer_name}},\n\nYour order is on the way! Carrier tracking indicates delivery is estimated for {{delivery_date}}. Tracking code: {{tracking_id}}.\n\nBest,\n{{agent_name}}',
    adoptionCount: 410,
  },
  {
    id: '4',
    name: 'Stripe Invoice & VAT Receipt',
    category: 'Billing',
    tags: ['invoice', 'vat', 'tax'],
    content: 'Hi {{customer_name}},\n\nHere is the official tax invoice and PDF receipt for your recent transaction: {{invoice_url}}.\n\nLet me know if you need any adjustments to your company billing address!\n\nCheers,\n{{agent_name}}',
    adoptionCount: 320,
  },
];

export default function AdminGlobalMacros() {
  const [macros, setMacros] = useState<GlobalMacro[]>(INITIAL_GLOBAL_MACROS);
  const [isPushing, setIsPushing] = useState(false);
  const [pushNotice, setPushNotice] = useState<string | null>(null);

  const handlePushAll = () => {
    setIsPushing(true);
    setTimeout(() => {
      setIsPushing(false);
      setPushNotice('Pushed 4 official knowledge base macros to all 620 customer workspaces!');
      setTimeout(() => setPushNotice(null), 4000);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-text">Global Knowledge Base &amp; Macro Library</h3>
          <p className="text-xs text-text-dim">
            Standardized macro templates automatically seeded into every new customer workspace upon signup
          </p>
        </div>
        <button
          onClick={handlePushAll}
          disabled={isPushing}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          {isPushing ? 'Broadcasting...' : '📢 Push Updates to All 620 Teams'}
        </button>
      </div>

      {pushNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>⚡ {pushNotice}</span>
          <span className="text-[10px] text-emerald-300/70">Completed in 84ms</span>
        </motion.div>
      )}

      {/* Grid of Global Macros */}
      <div className="grid md:grid-cols-2 gap-4">
        {macros.map((macro) => (
          <div
            key={macro.id}
            className="p-5 rounded-3xl bg-elevated/70 border border-border/80 hover:border-accent/40 transition-all flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-[10px] font-bold font-mono">
                  {macro.category}
                </span>
                <span className="text-xs text-text-dim">
                  Adopted by <strong>{macro.adoptionCount}</strong> workspaces
                </span>
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
              <span>Status: Active Global Seed</span>
              <span className="text-emerald-400 font-semibold">100% Synced</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
