'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { provisionUser } from '@/lib/api';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Completing sign in...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically picks up the OAuth tokens from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setStatus('Authentication failed. Redirecting to login...');
          setTimeout(() => window.location.href = '/login', 2000);
          return;
        }

        if (!session) {
          // Session might not be ready yet, wait a moment
          setStatus('Waiting for session...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (!retrySession) {
            setStatus('No session found. Redirecting to login...');
            setTimeout(() => window.location.href = '/login', 2000);
            return;
          }

          // Provision user in our DB
          setStatus('Setting up your account...');
          const result = await provisionUser(retrySession.access_token);
          
          window.location.href = '/dashboard';
          return;
        }

        // Provision user in our DB
        setStatus('Setting up your account...');
        const result = await provisionUser(session.access_token);

        // Store in localStorage for backward compat
        localStorage.setItem('draftpilot_token', session.access_token);
        localStorage.setItem('draftpilot_user', JSON.stringify(result.user));

        setStatus('Success! Redirecting to your dashboard...');
        window.location.href = '/dashboard';
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('Something went wrong. Redirecting...');
        setTimeout(() => window.location.href = '/dashboard', 1500);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
          <svg className="w-6 h-6 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">{status}</p>
      </div>
    </div>
  );
}
