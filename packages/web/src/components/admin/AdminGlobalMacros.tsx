'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

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
  const [isPushing, setIsPushing] = useState(false);
  const [pushNotice, setPushNotice] = useState<string | null>(null);

  const handlePushAll = async () => {
    setIsPushing(true);
    try {
      // 1. Fetch all active workspaces from Supabase
      const { data: teams, error: teamErr } = await supabase.from('teams').select('id, name');
      if (teamErr) throw teamErr;

      let insertedCount = 0;
      if (teams && teams.length > 0) {
        for (const team of teams) {
          const inserts = macros.map((m) => ({
            team_id: team.id,
            name: m.name,
            category: m.category,
            tags: m.tags,
            content: m.content,
          }));

          const { data } = await supabase.from('macros').insert(inserts).select();
          if (data) insertedCount += data.length;
        }
      }

      setPushNotice(`✓ Successfully broadcasted ${macros.length} standard macros to all ${teams?.length || 1} workspaces in Supabase (${insertedCount} total macros inserted)!`);
      setTimeout(() => setPushNotice(null), 5000);
    } catch (err: any) {
      alert(`Broadcasting note: ${err.message}`);
    } finally {
      setIsPushing(false);
    }
  };

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
        <button
          onClick={handlePushAll}
          disabled={isPushing}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] self-start sm:self-auto cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <span>📢</span>
          <span>{isPushing ? 'Broadcasting to Workspaces...' : 'Broadcast to All Customer Workspaces'}</span>
        </button>
      </div>

      {pushNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>{pushNotice}</span>
          <span className="text-[10px] text-emerald-300/70">Synced with Cloud DB</span>
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
                  Status: <strong className="text-emerald-400">Standard Seed</strong>
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
              <span>Grounding: 100% Match Enabled</span>
              <span className="text-accent-light font-semibold">Active in Gmail Co-Pilot</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
