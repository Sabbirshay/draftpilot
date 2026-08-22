import React from 'react';
import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'Sign Up | DraftPilot',
  description: 'Create your DraftPilot account to start drafting AI support replies in Gmail.',
};

export default function JoinPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8">
      <AuthForm initialMode="signup" />
    </div>
  );
}
