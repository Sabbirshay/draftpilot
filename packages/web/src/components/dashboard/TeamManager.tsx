'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Agent';
  extensionStatus: 'Active' | 'Pending Pairing';
  draftsThisMonth: number;
  lastActive: string;
  avatarUrl?: string | null;
}

export default function TeamManager() {
  const { dbUser, user } = useAuth();
  
  const userEmail = dbUser?.email || user?.email || 'user@company.com';
  const fullName =
    dbUser?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    userEmail.split('@')[0];
  const avatarUrl =
    dbUser?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const [livePlan, setLivePlan] = useState<string>(dbUser?.teams?.plan || 'free');

  React.useEffect(() => {
    async function fetchTeamPlan() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);
        if (token) {
          const res = await fetch(`/api/auth/me?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = await res.json();
            if (body.team?.plan) {
              setLivePlan(body.team.plan.toLowerCase());
              return;
            }
          }
        }

        const teamId = dbUser?.team_id;
        if (teamId) {
          const { data } = await supabase
            .from('teams')
            .select('plan, monthly_draft_limit')
            .eq('id', teamId)
            .maybeSingle();

          if (data?.plan) {
            setLivePlan(data.plan.toLowerCase());
          }
        }
      } catch (err) {
        console.warn('Team plan sync note:', err);
      }
    }

    fetchTeamPlan();

    const teamId = dbUser?.team_id;
    if (!teamId) return;

    const channel = supabase
      .channel(`team-manager-live-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` },
        (payload: any) => {
          if (payload.new?.plan) {
            setLivePlan(payload.new.plan.toLowerCase());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbUser?.team_id]);

  const plan = livePlan || dbUser?.teams?.plan || 'free';
  const totalSeats = plan === 'enterprise' ? 15 : plan === 'team' ? 5 : 1;

  const storageKey = `draftpilot_invited_members_${dbUser?.team_id || 'default'}`;
  const [invitedMembers, setInvitedMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Agent'>('Agent');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setInvitedMembers(parsed);
          }
        }
      } catch (err) {
        console.warn('Failed to load cached team invites:', err);
      }
    }
  }, [storageKey]);

  const saveInvitedMembers = (updated: TeamMember[]) => {
    setInvitedMembers(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save team invites to localStorage:', err);
      }
    }
  };

  const allMembers: TeamMember[] = [
    {
      id: dbUser?.id || user?.id || 'owner-1',
      name: fullName,
      email: userEmail,
      role: 'Owner',
      extensionStatus: 'Active',
      draftsThisMonth: 0,
      lastActive: 'Active now',
      avatarUrl,
    },
    ...invitedMembers,
  ];

  const usedSeats = allMembers.length;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInviteSuccessMsg(null);

    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter an email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. agent@yourcompany.com).');
      return;
    }

    if (allMembers.some((m) => m.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      setErrorMsg(`A team member with email "${trimmedEmail}" is already part of this workspace.`);
      return;
    }

    if (usedSeats >= totalSeats) {
      setErrorMsg(`You have reached your seat limit (${totalSeats} seat${totalSeats > 1 ? 's' : ''} on the ${plan.toUpperCase()} plan). Upgrade your plan to invite additional team members.`);
      return;
    }

    const newMember: TeamMember = {
      id: String(Date.now()),
      name: trimmedEmail.split('@')[0],
      email: trimmedEmail,
      role: inviteRole,
      extensionStatus: 'Pending Pairing',
      draftsThisMonth: 0,
      lastActive: 'Invited just now',
    };

    saveInvitedMembers([...invitedMembers, newMember]);
    setInviteEmail('');
    setInviteSuccessMsg(`✓ Invitation sent to ${trimmedEmail} (${inviteRole})! Pairing key and link generated.`);
    setTimeout(() => setInviteSuccessMsg(null), 4500);
  };

  const handleRemove = (id: string) => {
    const target = invitedMembers.find((m) => m.id === id);
    const updated = invitedMembers.filter((m) => m.id !== id);
    saveInvitedMembers(updated);
    if (target) {
      setInviteSuccessMsg(`Removed ${target.name} (${target.email}) from workspace.`);
      setTimeout(() => setInviteSuccessMsg(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Seat Summary Banner */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim">Allocated Seats</p>
            <h3 className="text-2xl font-bold text-text font-mono mt-1">
              {usedSeats} / {totalSeats}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-sm font-bold">
            👥
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim">Current Plan</p>
            <h3 className="text-2xl font-bold text-text font-mono mt-1 capitalize">
              {plan} Tier
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-sm font-bold">
            ✓
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim">Shared Knowledge Base</p>
            <h3 className="text-2xl font-bold text-text font-mono mt-1">
              Synced
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center text-cyan text-sm font-bold">
            ⚡
          </div>
        </div>
      </div>

      {/* Invite Team Member Box */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
        <h3 className="text-sm font-bold text-text mb-1">Invite Team Member</h3>
        <p className="text-xs text-text-muted mb-4">
          Add support agents to your workspace so they can access team macros and draft replies in Gmail.
        </p>

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="email"
            placeholder="agent@yourcompany.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-bg border border-border focus:border-accent text-xs text-text placeholder-text-dim outline-none transition-all"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'Admin' | 'Agent')}
            className="px-3.5 py-2.5 rounded-xl bg-bg border border-border focus:border-accent text-xs text-text outline-none"
          >
            <option value="Agent">Support Agent</option>
            <option value="Admin">Admin</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer shrink-0"
          >
            Send Invite
          </button>
        </form>

        {inviteSuccessMsg && (
          <p className="text-xs text-emerald-400 mt-2 font-medium">
            {inviteSuccessMsg}
          </p>
        )}

        {errorMsg && (
          <p className="text-xs text-amber-400 mt-2 font-medium">
            ⚠️ {errorMsg}
          </p>
        )}
      </div>

      {/* Team Members Roster */}
      <div className="rounded-3xl bg-elevated/70 border border-border/80 shadow-lg overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Active Team Members ({allMembers.length})</h3>
          <span className="text-[11px] text-text-dim">Auto-synced with workspace</span>
        </div>

        <div className="divide-y divide-border/40">
          {allMembers.map((member) => (
            <div key={member.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3.5">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-cyan flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-text">{member.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                      member.role === 'Owner'
                        ? 'bg-accent/20 text-accent-light'
                        : 'bg-elevated border border-border text-text-dim'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-dim mt-0.5">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 text-xs">
                <div className="text-left sm:text-right">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    member.extensionStatus === 'Active' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {member.extensionStatus}
                  </span>
                  <p className="text-[10px] text-text-dim mt-0.5">{member.lastActive}</p>
                </div>

                {member.role !== 'Owner' && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="text-text-dim hover:text-red-400 text-xs transition-colors p-1 cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
