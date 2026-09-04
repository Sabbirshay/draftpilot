'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=profile');
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-xs text-text-dim">Redirecting to Account Settings...</p>
      </div>
    </div>
  );
}
