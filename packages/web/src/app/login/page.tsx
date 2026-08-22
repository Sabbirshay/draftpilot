import React from 'react';
import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'Sign In | DraftPilot',
  description: 'Sign in to your DraftPilot account to access AI support drafting in Gmail.',
};

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8">
      <AuthForm initialMode="signin" />
    </div>
  );
}
