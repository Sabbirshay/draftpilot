'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&fit=crop&crop=faces',
];

export default function ProfileSettings() {
  const { user, dbUser, refreshUser } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (dbUser || user) {
      const initialName =
        dbUser?.full_name ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        '';
      const initialAvatar =
        dbUser?.avatar_url ||
        user?.user_metadata?.avatar_url ||
        user?.user_metadata?.picture ||
        '';
      setFullName(initialName);
      setAvatarUrl(initialAvatar);
    }
  }, [dbUser, user]);

  const initials = (fullName || user?.email || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const trimmedName = fullName.replace(/<[^>]*>?/gm, '').trim();
    if (!trimmedName) {
      setErrorMessage('Full name is required and cannot be empty.');
      return;
    }
    if (trimmedName.length > 100) {
      setErrorMessage('Full name cannot exceed 100 characters.');
      return;
    }

    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar && !trimmedAvatar.startsWith('http://') && !trimmedAvatar.startsWith('https://')) {
      setErrorMessage('Avatar URL must be a valid HTTP or HTTPS link.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update Supabase Auth user_metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          name: trimmedName,
          avatar_url: trimmedAvatar || null,
          picture: trimmedAvatar || null,
        },
      });

      if (authError) throw authError;

      // 2. Update users table in database if authenticated user exists
      if (user?.id) {
        const { error: dbError } = await supabase
          .from('users')
          .update({
            full_name: trimmedName,
            avatar_url: trimmedAvatar || null,
          })
          .eq('id', user.id);

        if (dbError) {
          console.warn('Could not update users table directly (RLS or column restriction):', dbError);
        }
      }

      // 3. Refresh user state in AuthProvider
      if (refreshUser) {
        await refreshUser();
      }

      setSuccessMessage('Your profile has been successfully updated.');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setErrorMessage(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-text">Profile Information</h3>
        <p className="text-xs text-text-dim">
          Update your agent display name, avatar icon, and public identity in DraftPilot.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Avatar Preview & Customizer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl bg-elevated/50 border border-border/70">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Avatar'}
                className="w-16 h-16 rounded-full object-cover border-2 border-accent shadow-md"
                referrerPolicy="no-referrer"
                onError={() => setAvatarUrl('')}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent via-purple-500 to-cyan flex items-center justify-center text-xl font-extrabold text-white shadow-md border-2 border-accent/60">
                {initials}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-bg flex items-center justify-center text-[10px] text-white">
              ✓
            </span>
          </div>

          <div className="space-y-1.5 flex-1">
            <h4 className="text-xs font-bold text-text">Avatar Preview</h4>
            <p className="text-[11px] text-text-dim">
              This avatar appears in team seats, generated drafts, and the header navigation.
            </p>
            {/* Quick avatar presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-text-dim font-mono">Presets:</span>
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className="w-6 h-6 rounded-full overflow-hidden border border-border hover:border-accent transition-all cursor-pointer"
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-[10px] text-accent-light hover:underline font-medium ml-1 cursor-pointer"
                >
                  Use Initials
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1.5">
              Full Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent shadow-inner transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-dim mb-1.5">
              Account Email
            </label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg/60 border border-border/50 text-xs text-text-dim cursor-not-allowed"
            />
            <span className="text-[10px] text-text-dim mt-1 block">
              Email is managed by Supabase Authentication.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-dim mb-1.5">
            Custom Avatar Image URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent shadow-inner transition-colors"
          />
          <span className="text-[10px] text-text-dim mt-1 block">
            Direct link to JPG, PNG, or WebP image. Leave blank to display dynamic gradient initials.
          </span>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-[0_0_15px_rgba(124,58,237,0.4)] disabled:opacity-50 cursor-pointer transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <span>Save Profile</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
