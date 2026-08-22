'use client';

import React, { useState } from 'react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Agent';
  extensionStatus: 'Paired & Active' | 'Pending Pairing';
  draftsThisMonth: number;
  lastActive: string;
}

const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Alex Morgan',
    email: 'alex@company.com',
    role: 'Admin',
    extensionStatus: 'Paired & Active',
    draftsThisMonth: 1120,
    lastActive: '5 mins ago',
  },
  {
    id: '2',
    name: 'Sarah Chen',
    email: 'sarah@company.com',
    role: 'Agent',
    extensionStatus: 'Paired & Active',
    draftsThisMonth: 890,
    lastActive: '12 mins ago',
  },
  {
    id: '3',
    name: 'Marcus Vance',
    email: 'marcus@company.com',
    role: 'Agent',
    extensionStatus: 'Paired & Active',
    draftsThisMonth: 640,
    lastActive: '1 hour ago',
  },
  {
    id: '4',
    name: 'Elena Rostova',
    email: 'elena@company.com',
    role: 'Agent',
    extensionStatus: 'Paired & Active',
    draftsThisMonth: 190,
    lastActive: '3 hours ago',
  },
];

export default function TeamManager() {
  const [members, setMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Agent'>('Agent');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const totalSeats = 5;
  const usedSeats = members.length;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMember: TeamMember = {
      id: String(Date.now()),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      extensionStatus: 'Pending Pairing',
      draftsThisMonth: 0,
      lastActive: 'Invited just now',
    };

    setMembers([...members, newMember]);
    setInviteEmail('');
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  const handleRemove = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
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
            <p className="text-xs text-text-dim">Extension Paired</p>
            <h3 className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              {members.filter((m) => m.extensionStatus === 'Paired & Active').length} Active
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-sm font-bold">
            🟢
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim">Seat Cost</p>
            <h3 className="text-2xl font-bold text-text font-mono mt-1">
              $19 <span className="text-xs text-text-muted font-normal">/agent/mo</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center text-cyan text-sm font-bold">
            💳
          </div>
        </div>
      </div>

      {/* Invite new agent bar */}
      <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
        <h3 className="text-sm font-bold text-text mb-3">Invite Team Member to Workspace</h3>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="email"
            required
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-accent"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-accent"
          >
            <option value="Agent">Support Agent</option>
            <option value="Admin">Workspace Admin</option>
          </select>
          <button
            type="submit"
            disabled={usedSeats >= totalSeats}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] disabled:opacity-50 cursor-pointer"
          >
            {usedSeats >= totalSeats ? 'Seats Full (Upgrade)' : '+ Send Invite'}
          </button>
        </form>

        {inviteSuccess && (
          <p className="text-xs text-success mt-2 flex items-center gap-1">
            ✓ Invitation link sent to colleague with pairing instructions!
          </p>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-3xl bg-elevated/70 border border-border/80 overflow-hidden shadow-lg">
        <div className="p-5 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Active Team Roster</h3>
          <span className="text-xs text-text-dim">{members.length} members listed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/50 text-text-dim uppercase text-[10px] tracking-wider border-b border-border/40">
              <tr>
                <th className="px-6 py-3 font-semibold">Agent / User</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Gmail Extension</th>
                <th className="px-6 py-3 font-semibold">Drafts (This Mo)</th>
                <th className="px-6 py-3 font-semibold">Last Active</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-accent-light text-xs">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-text">{member.name}</p>
                        <p className="text-[11px] text-text-dim">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full bg-bg border border-border text-[11px] font-mono text-text-muted">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                      member.extensionStatus === 'Paired & Active'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        member.extensionStatus === 'Paired & Active' ? 'bg-emerald-400' : 'bg-yellow-400'
                      }`} />
                      <span>{member.extensionStatus}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-text-muted">
                    {member.draftsThisMonth} drafts
                  </td>
                  <td className="px-6 py-4 text-text-dim">
                    {member.lastActive}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.role !== 'Admin' && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="text-red-400 hover:text-red-300 font-medium text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
